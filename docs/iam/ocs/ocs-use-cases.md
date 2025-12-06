# OCS Bounded Context - Behavior Specifications

## 1. Kịch bản hành vi (Functional Behavior Specifications)

This document lists canonical behavior specifications (Gherkin) for the Organization & Context Scoping (OCS) bounded context. It focuses on Tenant, Product, Enrollment and Membership lifecycles, uniqueness constraints enforced via Guard Streams, RYOW guidance, and the contract with ACM/AZM for revocation triggers/hints. Follow ADRs referenced in `docs/iam/iam-architecture.md` (notably ADR-IAM-7, ADR-IAM-9 and revocation guidance in ADR-IAM-10).

---

### Create Tenant

```gherkin
Feature: Create Tenant
  As an Administrator or Self-Service Flow
  I want to create a Tenant with an unique display name
  So that the Tenant becomes a manageable scoping unit

  Scenario: Create Tenant successfully (name available)
    Given no Tenant exists with normalized `tenantName`
    When `CreateTenantCommand` is executed with `tenantName`, `ownerId` and optional `metadata`
    Then `TenantCreatedEvent` is emitted containing `tenantId`, `tenantName`, `ownerId`, `createdAt`
    And Stream: `TenantCreatedEvent` is appended to `ocs-tenant-<tenantId>` (aggregate stream)
    And Guard Streams (Multi-Stream Atomic Write): append `TenantNameLockAcquiredEvent` -> `unique-tenantname-<normalizedTenantName>` in the same atomic write

  Scenario: Create Tenant fails due to name conflict
    Given Guard Stream `unique-tenantname-<normalizedTenantName>` already has a lock
    When `CreateTenantCommand` is executed with the same `tenantName`
    Then command returns business error `TenantNameAlreadyTaken`
    And no `TenantCreatedEvent` is appended
```

---

### Update Tenant

```gherkin
Feature: Update Tenant
  As a Tenant Admin
  I want to update tenant metadata and display name
  So that tenant properties reflect administrative changes

  Scenario: Update tenant metadata successfully
    Given Tenant exists with `tenantId`
    When `UpdateTenantCommand` is executed with `changes` (metadata, other editable fields)
    Then `TenantUpdatedEvent` is emitted and appended to `ocs-tenant-<tenantId>`

  Scenario: Change tenant name (rename) with uniqueness
    Given Tenant exists and new `tenantName` is normalized
    And Guard Stream `unique-tenantname-<normalizedNewName>` not locked
    When `ChangeTenantNameCommand` is executed with `newTenantName`
    Then append atomically:
      * `TenantNameChangedEvent` -> `ocs-tenant-<tenantId>` (contains `oldName`, `newName`, `changedAt`)
      * `TenantNameLockReleasedEvent` -> `unique-tenantname-<normalizedOldName>`
      * `TenantNameLockAcquiredEvent` -> `unique-tenantname-<normalizedNewName>`
    And projection/read-models update tenant display name

  Scenario: Rename fails due to name taken
    Given Guard Stream `unique-tenantname-<normalizedNewName>` locked
    When `ChangeTenantNameCommand` executed
    Then return `TenantNameAlreadyTaken`
```

---

### Suspend / Activate Tenant

```gherkin
Feature: Suspend / Activate Tenant
  As a Platform Admin
  I want to suspend or reactivate a tenant
  So that tenant users and related resources can be disabled/enabled

  Scenario: Suspend tenant
    Given Tenant exists and `tenantStatus = Active`
    When `SuspendTenantCommand` executed with optional `reason`
    Then `TenantSuspendedEvent` is emitted (contains `suspendedAt`, `reason`)
    And Stream: appended to `ocs-tenant-<tenantId>`
    And OCS emits a trigger hint (not a revocation) for ACM: include `initiatedBy`, `affectedTenantId`, and optional `revocationHints` (e.g. `affectedFids` or `affectedTokenReferenceHashes`) so ACM can revoke sessions if policy requires

  Scenario: Activate tenant
    Given Tenant exists and `tenantStatus = Suspended`
    When `ActivateTenantCommand` executed
    Then `TenantActivatedEvent` is emitted and appended
```

---

### Delete Tenant (Soft-delete) with Atomic Name Release

```gherkin
Feature: Delete Tenant
  As a Platform Admin
  I want to soft-delete a tenant and release its `tenantName` for reuse
  So that unique keys can be reclaimed safely

  Scenario: Delete tenant successfully (atomic name release)
    Given Tenant exists and no blocking preconditions
    When `DeleteTenantCommand` executed
    Then append atomically:
      * `TenantDeletedEvent` -> `ocs-tenant-<tenantId>` (contains `deletedAt`)
      * `TenantNameLockReleasedEvent` -> `unique-tenantname-<normalizedTenantName>`
    And this atomic write must respect ADR-IAM-7 Guard Streams semantics

  Scenario: Delete blocked by active enrollments or policy
    Given Tenant has active `TenantProductEnrollment` or active Memberships with non-revocable constraints
    When `DeleteTenantCommand` executed
    Then return `CannotDeleteTenantDueToActiveEnrollments` or other domain error
    And no events appended
```

---

### Register Product

```gherkin
Feature: Register Product
  As a System Admin or Self-Service Flow
  I want to register a Product with a unique productName and tenancyMode
  So that OCS knows product identity and tenancy rules

  Scenario: Register product successfully (name available)
    Given no Product exists with normalized `productName`
    When `RegisterProductCommand` executed with `productName`, `tenancyMode`, `metadata`, `registeredBy`
    Then `ProductRegisteredEvent` emitted and appended to `ocs-product-<productId>`
    And Guard Streams: append `ProductNameLockAcquiredEvent` -> `unique-productname-<normalizedProductName>` atomically

  Scenario: Register product fails due to name conflict
    Given `unique-productname-<normalizedProductName>` locked
    When `RegisterProductCommand` executed
    Then return `ProductNameAlreadyTaken`
```

---

### Update / Deactivate Product

```gherkin
Feature: Update / Deactivate Product
  As a Product Admin
  I want to update product metadata and deactivate when necessary
  So that product lifecycle is managed and enrollment preconditions respected

  Scenario: Update product metadata successfully
    Given Product exists
    When `UpdateProductCommand` executed with `changes`
    Then `ProductUpdatedEvent` emitted and appended to `ocs-product-<productId>`

  Scenario: Deactivate product with active enrollments prevention
    Given Product exists and has active Enrollments
    When `DeactivateProductCommand` executed
    Then return `CannotDeactivateProductWithActiveEnrollments`
    And no `ProductDeactivatedEvent` appended

  Scenario: Deactivate product successfully (no active enrollments)
    Given Product exists and no active Enrollments
    When `DeactivateProductCommand` executed
    Then `ProductDeactivatedEvent` emitted and appended
```

---

### Tenant ↔ Product Enrollment (TenantProductEnrollment)

```gherkin
Feature: Tenant Product Enrollment
  As an Organization Admin
  I want to link/unlink a Tenant to a Product (enroll/unenroll)
  So that members of tenant can use the product according to tenancy rules

  Scenario: Link tenant to product successfully
    Given Tenant exists and Product exists and both Active
    And no active Enrollment exists for (tenantId, productId)
    When `LinkTenantToProductCommand` executed
    Then `TenantLinkedToProductEvent` emitted (contains `enrollmentId`, `tenantId`, `productId`, `createdAt`)
    And Stream: appended to `ocs-enrollment-<enrollmentId>`

  Scenario: Link fails due to existing active enrollment
    Given Enrollment already active for (tenantId, productId)
    When `LinkTenantToProductCommand` executed
    Then return `EnrollmentAlreadyExists`

  Scenario: Unlink tenant from product (unlink)
    Given Enrollment exists and can be revoked
    When `UnlinkTenantFromProductCommand` executed
    Then `TenantUnlinkedFromProductEvent` emitted and appended
    And downstream systems (e.g., ACM, AZM) may need to adjust sessions/assignments; OCS should emit a trigger-hint including `affectedTenantId`, `productId`, `initiatedBy` and optional `revocationHints` such as `affectedFids` if available
```

---

### Membership (Assign / Revoke Role in Product/Tenant)

```gherkin
Feature: Assign / Revoke Membership
  As an Admin or delegated operator
  I want to assign a User a Role within a Product and optional Tenant
  So that access is granted within the correct scope

  Scenario: Assign membership successfully
    Given User exists and Role exists and (if tenant-scoped) Tenant is enrolled with Product
    And no active Membership exists for same (userId, productId, tenantId)
    When `AssignMembershipCommand` executed with `userId`, `productId`, `roleId`, optional `tenantId`
    Then `MembershipCreatedEvent` is emitted and appended to `ocs-membership-<membershipId>`

  Scenario: Assign fails due to existing active membership for same scope
    Given active Membership exists for (userId, productId, tenantId)
    When `AssignMembershipCommand` executed
    Then return `MembershipAlreadyExists`

  Scenario: Revoke membership
    Given Membership exists
    When `RevokeMembershipCommand` executed
    Then `MembershipRevokedEvent` emitted and appended
    And OCS emits a trigger hint for ACM/AZM: include `userId`, `membershipId`, `productId`, optional `tenantId`, `initiatedBy` and optional `revocationHints` to allow ACM to revoke sessions or step-up authentications as required
```

---

### Guard Streams and Uniqueness Semantics (Guidance)

```gherkin
Feature: Guard Streams for Uniqueness
  As an implementer
  I want unique Tenant/Product names enforced at write-time
  So that naming collisions cannot occur even under concurrent writes

  Scenario: Enforce name uniqueness with Guard Streams
    Given a change requires reserving a unique key (tenantName/productName)
    When a command executes that modifies or creates the entity
    Then the command handler must perform an atomic write that appends both the aggregate event(s) and the Guard Stream lock event(s) (e.g., `TenantNameLockAcquiredEvent` -> `unique-tenantname-<normalized>`)
    And on release (delete/rename) the handler must append the corresponding `LockReleased` events in the same atomic write
```

---

### Integration Contracts: OCS → ACM / AZM (Triggers & Hints)

```gherkin
Feature: Emit Trigger Events and Revocation Hints
  As OCS
  I want to emit well-formed trigger events that include revocation hints
  So that ACM (authoritative for revocation) can perform correct and auditable revocation decisions

  Scenario: Tenant suspension or membership revocation requires session revocation
    Given `TenantSuspendedEvent` or `MembershipRevokedEvent` emitted
    When event is published by OCS
    Then event MUST include `initiatedBy`, `affectedTenantId`/`userId`, and optional `revocationHints` fields (e.g., `affectedFids`, `affectedTokenReferenceHashes`) as defined in the canonical events contract
    And OCS MUST NOT emit `AccessTokensRevokedEvent` or `SessionsRevokedEvent` directly; ACM is the authoritative publisher for revocation events

  Scenario: OCS needs fast-path for high-confidence revocation
    Given OCS can enumerate affected token references (e.g., sessions previously annotated with tenant/product context)
    When it emits a trigger event
    Then include `affectedTokenReferenceHashes` and/or `affectedFids` to enable ACM to revoke quickly
```

---

### Read-Your-Own-Writes (RYOW) Guidance

```gherkin
Feature: Read-Your-Own-Writes Guidance for OCS
  As implementer of command handlers and projectors
  I want to ensure callers can observe their writes within a small bounded time
  So that UIs and synchronous operations behave correctly

  Scenario: RYOW after creating or updating an aggregate
    Given a command successfully appends events to ESDB
    When the client requires immediate consistency for subsequent reads
    Then the system should support RYOW by either using per-request projector checkpoints (ADR-IAM-9) or a short polling/timeout loop that waits for projection checkpoint advancement
    And guidance: use stable projection checkpoints saved as part of projector transactions and provide query endpoints that accept `waitForProjection` or `expectedCheckpoint` hints for acceptance tests
```

---

## 2. Yêu cầu phi chức năng (Non-functional Behavior Specifications)

### OCS Command Liveness Health Check

```gherkin
Feature: Ocs Command Liveness Health Check
  Scenario: Kiểm tra liveness healthy trả về trạng thái healthy
    Given tiến trình dịch vụ `ocs-command` đã được khởi động và đang chạy
    When operator hoặc orchestrator gọi `GET /health/liveness`
    Then dịch vụ trả về HTTP 200
    And nội dung response có trường `message` = "Service still alive"
```

### OCS Command Readiness Health Check

```gherkin
Feature: Ocs Command Readiness Health Check
  Scenario: Kiểm tra readiness healthy trả về trạng thái healthy
    When operator hoặc orchestrator gọi `GET /health/ready` trên `ocs-command`
    Then dịch vụ trả về HTTP 200
    And body của response là `ISuccessResponse<HealthDetails>` với `data` ánh xạ các keys component tới `ServiceHealthStatus.UP` (ví dụ `{ eventstoredb: 'up' }`)

  Scenario: Readiness khi EventStoreDB (event store) bị down
    Given EventStoreDB (event store) không khả dụng cho `ocs-command`
    When operator gọi `GET /health/ready` trên `ocs-command`
    Then dịch vụ trả về HTTP 503
    And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ eventstoredb: ServiceHealthStatus.DOWN }`

  Scenario: Readiness khi RabbitMQ (message bus) bị down (non-critical for write path)
    Given RabbitMQ (message bus) không khả dụng nhưng EventStoreDB vẫn UP
    When operator gọi `GET /health/ready` trên `ocs-command`
    Then dịch vụ có thể trả HTTP 200 (ready with degraded) hoặc HTTP 503 tuỳ cấu hình
    And body nên phản ánh `data.rabbitmq` = `ServiceHealthStatus.UNKNOWN` hoặc `DOWN` theo policy
```

### OCS Query Liveness Health Check

```gherkin
Feature: Ocs Query Liveness Health Check
  Scenario: Kiểm tra liveness của `ocs-query`
    Given tiến trình dịch vụ `ocs-query` đã được khởi động và đang chạy
    When operator hoặc orchestrator gọi `GET /health/liveness` trên `ocs-query`
    Then dịch vụ trả về HTTP 200
    And nội dung response có trường `message` = "Service still alive"
```

### OCS Query Readiness Health Check

```gherkin
Feature: Ocs Query Readiness Health Check
  Scenario: Kiểm tra readiness healthy cho `ocs-query`
    When operator gọi `GET /health/ready` trên `ocs-query`
    Then body của response là `ISuccessResponse<HealthDetails>` với `data` ánh xạ các keys component tới `ServiceHealthStatus.UP` (ví dụ `{ postgresql: 'up', redis: 'up', elasticsearch: 'up' }`) và optional `metadata.checkedAt`

  Scenario: Readiness khi PostgreSQL (read models) cho `ocs-query` bị down
    Given PostgreSQL (read models) không khả dụng cho `ocs-query`
    When operator gọi `GET /health/ready` trên `ocs-query`
    Then dịch vụ trả về HTTP 503
    And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ postgresql: ServiceHealthStatus.DOWN }`

  Scenario: Readiness khi Redis (cache) cho `ocs-query` bị down
    Given Redis (cache) không khả dụng cho `ocs-query`
    When operator gọi `GET /health/ready` trên `ocs-query`
    Then dịch vụ trả về HTTP 503
    And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ redis: ServiceHealthStatus.DOWN }`

  Scenario: Readiness khi Elasticsearch (search/index) cho `ocs-query` bị down (degraded)
    Given Elasticsearch (search/index) không khả dụng cho `ocs-query`
    When operator gọi `GET /health/ready` trên `ocs-query`
    Then dịch vụ có thể trả HTTP 200 (ready with degraded) hoặc HTTP 503 tuỳ policy
    And body nên phản ánh `data.elasticsearch` = `ServiceHealthStatus.DOWN` hoặc `UNKNOWN` cùng với `metadata.checkedAt`
```

### OCS Projector Liveness Health Check

```gherkin
Feature: Ocs Projector Liveness Health Check
  Scenario: Kiểm tra liveness của `ocs-projector`
    Given tiến trình dịch vụ `ocs-projector` đã được khởi động và đang chạy
    When operator hoặc orchestrator gọi `GET /health/liveness` trên `ocs-projector`
    Then dịch vụ trả về HTTP 200
    And nội dung response có trường `message` = "Service still alive"
```

### OCS Projector Readiness Health Check

```gherkin
Feature: Ocs Projector Readiness Health Check
  Scenario: Kiểm tra readiness healthy cho `ocs-projector`
    When operator gọi `GET /health/ready` trên `ocs-projector`
    Then body của response là `ISuccessResponse<HealthDetails>` với `data` ánh xạ các keys component tới `ServiceHealthStatus.UP` (ví dụ `{ eventstoredb: 'up', postgresql: 'up', redis: 'up', elasticsearch: 'up' }`) và optional `metadata.checkedAt`

  Scenario: Readiness khi EventStoreDB (event source) bị down
    Given EventStoreDB không khả dụng cho `ocs-projector`
    When operator gọi `GET /health/ready` trên `ocs-projector`
    Then dịch vụ trả về HTTP 503
    And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ eventstoredb: ServiceHealthStatus.DOWN }`

  Scenario: Readiness khi PostgreSQL (projections) bị down
    Given PostgreSQL (projections) không khả dụng cho `ocs-projector`
    When operator gọi `GET /health/ready` trên `ocs-projector`
    Then dịch vụ trả về HTTP 503
    And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ postgresql: ServiceHealthStatus.DOWN }`

  Scenario: Readiness khi RabbitMQ (publish) bị down (non-critical)
    Given RabbitMQ không khả dụng nhưng EventStoreDB và PostgreSQL vẫn UP
    When operator gọi `GET /health/ready` trên `ocs-projector`
    Then dịch vụ có thể trả HTTP 200 (ready with degraded) hoặc HTTP 503 tuỳ cấu hình
    And body nên phản ánh `data.rabbitmq` = `ServiceHealthStatus.UNKNOWN` hoặc `DOWN` theo policy
```

## 3. Commands

### CreateTenantCommand

- Payload: `tenantName`, `ownerId`, optional `metadata`, `initiatedBy`
- Validation: `tenantName` normalization, availability via Guard Stream
- Aggregate: `ocs-tenant-<tenantId>` stream and `unique-tenantname-<normalizedTenantName>` guard stream
- Events emitted: `TenantCreatedEvent`, `TenantNameLockAcquiredEvent`
- Notes: atomic append required to reserve name per ADR-IAM-7.

### UpdateTenantCommand

- Payload: `tenantId`, `changes`, `initiatedBy`
- Validation: tenant exists, permission checks
- Aggregate: `ocs-tenant-<tenantId>` stream
- Events emitted: `TenantUpdatedEvent`

### ChangeTenantNameCommand

- Payload: `tenantId`, `newTenantName`, `initiatedBy`
- Validation: new name normalized and available via guard stream
- Aggregate: `ocs-tenant-<tenantId>` and guard streams for old/new names
- Events emitted: `TenantNameChangedEvent`, `TenantNameLockReleasedEvent`, `TenantNameLockAcquiredEvent` (atomic)

### SuspendTenantCommand / ActivateTenantCommand

- Payload: `tenantId`, optional `reason`, `initiatedBy`
- Validation: tenant exists, status preconditions
- Aggregate: `ocs-tenant-<tenantId>` stream
- Events emitted: `TenantSuspendedEvent` / `TenantActivatedEvent`
- Notes: emit revocation trigger hints (not revocation events) for ACM with `initiatedBy` and optional `revocationHints`.

### DeleteTenantCommand

- Payload: `tenantId`, `initiatedBy`
- Validation: no blocking enrollments/memberships
- Aggregate: `ocs-tenant-<tenantId>` and `unique-tenantname-<normalizedTenantName>` guard stream
- Events emitted: `TenantDeletedEvent`, `TenantNameLockReleasedEvent` (atomic)

### RegisterProductCommand

- Payload: `productName`, `tenancyMode`, `metadata`, `registeredBy`
- Validation: product name uniqueness via guard stream
- Aggregate: `ocs-product-<productId>` stream and `unique-productname-<normalizedProductName>` guard stream
- Events emitted: `ProductRegisteredEvent`, `ProductNameLockAcquiredEvent`

### UpdateProductCommand / DeactivateProductCommand

- Payload: `productId`, `changes` / `productId`, `initiatedBy`
- Validation: product exists, preconditions for deactivation (no active enrollments)
- Aggregate: `ocs-product-<productId>` stream
- Events emitted: `ProductUpdatedEvent` / `ProductDeactivatedEvent`

### LinkTenantToProductCommand / UnlinkTenantFromProductCommand

- Payload: `tenantId`, `productId`, `initiatedBy`
- Validation: tenant and product active and enrollment preconditions
- Aggregate: `ocs-enrollment-<enrollmentId>` stream
- Events emitted: `TenantLinkedToProductEvent` / `TenantUnlinkedFromProductEvent`
- Notes: on unlink emit trigger hints for ACM/AZM as needed.

### AssignMembershipCommand / RevokeMembershipCommand

- Payload: `userId`, `productId`, `roleId`, optional `tenantId`, `initiatedBy`
- Validation: user exists, role exists, enrollment exists if tenant-scoped, uniqueness for membership per scope
- Aggregate: `ocs-membership-<membershipId>` stream
- Events emitted: `MembershipCreatedEvent` / `MembershipRevokedEvent`

## 4. Queries

### GetTenantById

- Payload: `tenantId`
- Returns: tenant details and status
- Source: tenant projection (Postgres/ES)

### FindTenantByName

- Payload: `tenantName`
- Returns: tenant summary or null
- Source: tenant projection (eventual consistency)

### CheckTenantNameAvailability

- Payload: `tenantName`
- Returns: `{ available: boolean }` (eventual consistency; for write-time reserve rely on Guard Streams)
- Source: tenant projection

### GetProductById

- Payload: `productId`
- Returns: product details and tenancyMode
- Source: product projection

### FindProductByName

- Payload: `productName`
- Returns: product summary or null
- Source: product projection

### ListEnrollmentsForTenant

- Payload: `tenantId`, pagination
- Returns: list of enrollments with `enrollmentId`, `productId`, `status`
- Source: enrollment projection

### GetMembershipById

- Payload: `membershipId`
- Returns: membership detail
- Source: membership projection

### ListMembershipsForUser

- Payload: `userId`, optional filters
- Returns: list of memberships across products/tenants
- Source: membership projection

---

## 5. Workflows

### Tenant Lifecycle Workflow

1. **Create Tenant**: Nhận lệnh `CreateTenantCommand` → kiểm tra uniqueness → phát sự kiện `TenantCreatedEvent` và lock tên.
2. **Update Tenant**: Nhận lệnh `UpdateTenantCommand` → cập nhật metadata, phát sự kiện `TenantUpdatedEvent`.
3. **Change Tenant Name**: Nhận lệnh `ChangeTenantNameCommand` → kiểm tra uniqueness → phát sự kiện đổi tên, release và acquire lock atomically.
4. **Suspend/Activate Tenant**: Nhận lệnh `SuspendTenantCommand`/`ActivateTenantCommand` → phát sự kiện tương ứng, gửi trigger hint cho ACM nếu cần.
5. **Delete Tenant**: Nhận lệnh `DeleteTenantCommand` → kiểm tra precondition → phát sự kiện xóa và release lock atomically.

### Product Lifecycle Workflow

1. **Register Product**: Nhận lệnh `RegisterProductCommand` → kiểm tra uniqueness → phát sự kiện đăng ký và lock tên.
2. **Update Product**: Nhận lệnh `UpdateProductCommand` → cập nhật metadata, phát sự kiện cập nhật.
3. **Deactivate Product**: Nhận lệnh `DeactivateProductCommand` → kiểm tra enrollments → phát sự kiện hoặc trả về lỗi.

### Enrollment Workflow (Tenant ↔ Product)

1. **Link Tenant to Product**: Nhận lệnh `LinkTenantToProductCommand` → kiểm tra trạng thái → phát sự kiện liên kết.
2. **Unlink Tenant from Product**: Nhận lệnh `UnlinkTenantFromProductCommand` → kiểm tra precondition → phát sự kiện unlink, gửi trigger hint cho ACM/AZM nếu cần.

### Membership Workflow

1. **Assign Membership**: Nhận lệnh `AssignMembershipCommand` → kiểm tra uniqueness và precondition → phát sự kiện tạo membership.
2. **Revoke Membership**: Nhận lệnh `RevokeMembershipCommand` → phát sự kiện revoke, gửi trigger hint cho ACM/AZM nếu cần.

---

## 6. Process Manager (nếu cần)

### Khi nào cần Process Manager?

Process Manager (PM) chỉ cần thiết cho các workflow kéo dài, nhiều bước, hoặc cần orchestration/phối hợp nhiều aggregate/stream. Đa số các use-case OCS là atomic, nhưng có thể cân nhắc PM cho các trường hợp:

- **Tenant Deletion Orchestration**: Khi xóa tenant cần kiểm tra và thu hồi enrollments, memberships, phát các trigger hint cho ACM/AZM, đảm bảo atomicity hoặc rollback nếu có lỗi.
- **Bulk Membership Revocation**: Khi suspend tenant hoặc deactivate product, có thể cần PM để thu hồi hàng loạt memberships và phát trigger hint đồng bộ.

### Ví dụ Process Manager: Tenant Deletion

1. Nhận lệnh xóa tenant.
2. Kiểm tra enrollments/memberships liên quan.
3. Nếu có thể xóa, phát sự kiện xóa tenant và release lock atomically.
4. Nếu cần, phát các trigger hint cho ACM/AZM để revoke session/membership liên quan.
5. Nếu có lỗi ở bước nào, rollback hoặc phát domain error.

---

- Payload: guard stream key (e.g., `unique-tenantname-<normalized>`)
- Returns: lock status (locked/unlocked), owner metadata (if available)
- Source: Guard Stream inspection (EventStore metadata) and projections
