# AZM Bounded Context - Behavior Specifications

These are behavior specifications (Gherkin) for Authorization Management (AZM). They cover Role and Permission lifecycle, role-assignment request flows (integration with OCS), Guard Streams uniqueness for Role names per Product, propagation triggers (`RolePermissionsChangedEvent`) and the contract for revocation hints that AZM may include for ACM to act upon.

References: `docs/iam/iam-architecture.md` (ADR-IAM-7, ADR-IAM-9, ADR-IAM-10) and `docs/iam/azm/azm-domain-model.md`.

## 1. Kịch bản hành vi (Functional Behavior Specifications)

### Create Role

```gherkin
Feature: Create Role
  As an admin
  I want to create a Role within a Product
  So that the Product has named roles with assigned permissions

  Scenario: Create Role success (unique name within product)
    Given `productId` exists and `roleName` normalized
    And no other Role in that product exists with the same `roleName`
    When `CreateRoleCommand` is executed with `productId`, `roleName`, `scope`, and optional `permissions`
    Then emit `RoleCreatedEvent` with `roleId`, `productId`, `roleName`, `scope`, `permissions`, `createdAt`
    And append to `iam-role-<roleId>` stream
    And (if necessary) append Guard Stream lock atomically to enforce uniqueness per `productId` (see ADR-IAM-7)

  Scenario: Create Role fails due to duplicate name
    Given an existing Guard Stream or Role with same `roleName` in product
    When `CreateRoleCommand` is executed
    Then return error `RoleNameAlreadyTaken`
    And no `RoleCreatedEvent` is appended
```

---

### Update Role Metadata

```gherkin
Feature: Update Role
  As an admin
  I want to update a Role's metadata (name, description, active flag)
  So that role definitions remain accurate

  Scenario: Update role name and description
    Given `Role` exists
    When `UpdateRoleCommand` executed with changes
    Then validate invariants (uniqueness if name changed, scope compatibility)
    And emit `RoleUpdatedEvent` with `roleId`, `changes`, `updatedAt`
    And if `roleName` changed ensure Guard Streams atomic swap to acquire new name and release old name
```

---

### Role Permissions Change (trigger for revocation)

```gherkin
Feature: Role Permissions Changed
  As AZM
  I want to change permissions for a Role and signal affected actors
  So that ACM can perform authoritative revocation (ACM owns revocation events)

  Scenario: Remove permissions from role (emit trigger with hints)
    Given `Role` exists and currently has `permissionIds`
    When `UpdateRolePermissionsCommand` removes a set of permissions
    Then emit `RolePermissionsChangedEvent` containing:
      - `roleId`
      - `removedPermissionIds` (explicit list)
      - `addedPermissionIds` (optional)
      - `affectedMembershipIds?` / `affectedUserIds?` if computable
      - optional token-level hints: `affectedTokenReferenceHashes?`, `affectedFids?`
      - `changedAt`
    And persist to `iam-role-<roleId>` stream
    And AZM MUST NOT emit `AccessTokensRevokedEvent`/`SessionsRevokedEvent` directly — ACM is authoritative for revocation

  Scenario: AZM provides no token-level hints
    Given AZM cannot compute token-level hints
    When `RolePermissionsChangedEvent` is emitted
    Then ACM will compute affected sessions via projections and decide revocation actions
```

---

### Role Delete (soft-delete)

```gherkin
Feature: Delete Role
  As an admin
  I want to soft-delete a Role
  So that the Role is no longer assignable but can be audited

  Scenario: Delete role success (no active memberships)
    Given `Role` exists and has no active memberships
    When `DeleteRoleCommand` executed
    Then emit `RoleDeletedEvent` with `roleId`, `deletedAt`

  Scenario: Delete role fails due to active membership
    Given `Role` has active memberships
    When `DeleteRoleCommand` executed
    Then return `CannotDeleteRoleWithActiveMemberships` and do not emit `RoleDeletedEvent`
```

---

### Permission Registry (register / update / deprecate)

```gherkin
Feature: Permission Registry
  As AZM operator
  I want to register and manage Permissions
  So that permissions are versioned, discoverable and can be deprecated safely

  Scenario: Register permission success
    Given `permissionKey`, `productId`, `version` provided
    And no existing permission has same `permissionKey` for product
    When `RegisterPermissionCommand` executed
    Then emit `PermissionRegisteredEvent` with `permissionId`, `permissionKey`, `productId`, `version`, `createdAt`

  Scenario: Deprecate permission
    Given `Permission` exists
    When `DeprecatePermissionCommand` executed with optional `replacementPermissionId`
    Then emit `PermissionDeprecatedEvent` with `permissionId`, `deprecatedAt`, `replacementPermissionId?`
```

---

### Role Assignment Request (AZM -> OCS integration)

```gherkin
Feature: Role Assignment Request
  As AZM
  I want to request role assignment for a User via OCS
  So that OCS remains authoritative for Membership lifecycle

  Scenario: Request role assignment
    Given admin requests assign `roleId` to `userId` (with optional tenantId)
    When `RequestRoleAssignmentCommand` executed
    Then emit `RoleAssignmentRequestedEvent` with `requestId`, `userId`, `roleId`, `productId?`, `tenantId?`, `requestedAt`, `initiatedBy?`
    And OCS will handle assignment and emit `MembershipCreatedEvent` or `MembershipRejectedEvent`

  Scenario: Handle membership rejection
    Given `RoleAssignmentRequestedEvent` was emitted and OCS responds with `MembershipRejectedEvent`
    When AZM receives rejection
    Then AZM records rejection (audit) and may emit `RoleAssignmentRequestFailedEvent` with `reason`
```

---

### Guard Streams & Uniqueness (RoleName per Product)

```gherkin
Feature: Guard Streams for Role uniqueness
  As AZM
  I want to enforce unique `roleName` per `productId` using Guard Streams
  So that concurrent create/update operations cannot violate uniqueness

  Scenario: Atomic create with Guard Stream
    Given no guard lock exists for `productId:roleName`
    When `CreateRoleCommand` executes
    Then AZM uses `IEventStore.appendAtomic` to append `RoleCreatedEvent` to `iam-role-<roleId>` and `RoleNameLockAcquiredEvent` to `unique-roleName-<productId>-<normalizedRoleName>` in single atomic write

  Scenario: Concurrent create results in lock conflict
    Given concurrent `CreateRoleCommand` attempts for same `roleName` and product
    When both attempt atomic append
    Then one succeeds and the other receives `RoleNameAlreadyTaken` due to Guard Stream conflict
```

## 2. Yêu cầu phi chức năng (Non-functional Behavior Specifications)

### AZM Command Liveness Health Check

```gherkin
Feature: Azm Command Liveness Health Check
  Scenario: Kiểm tra liveness healthy trả về trạng thái healthy
    Given tiến trình dịch vụ `azm-command` đã được khởi động và đang chạy
    When operator hoặc orchestrator gọi `GET /health/liveness`
    Then dịch vụ trả về HTTP 200
    And nội dung response có trường `message` = "Service still alive"
```

### AZM Command Readiness Health Check

```gherkin
Feature: Azm Command Readiness Health Check
  Scenario: Kiểm tra readiness healthy trả về trạng thái healthy
    When operator hoặc orchestrator gọi `GET /health/ready` trên `azm-command`
    Then dịch vụ trả về HTTP 200
    And body của response là `ISuccessResponse<HealthDetails>` với `data` ánh xạ các keys component tới `ServiceHealthStatus.UP` (ví dụ `{ eventstoredb: 'up' }`)

  Scenario: Readiness khi EventStoreDB (event store) bị down
    Given EventStoreDB (event store) không khả dụng cho `azm-command`
    When operator gọi `GET /health/ready` trên `azm-command`
    Then dịch vụ trả về HTTP 503
    And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ eventstoredb: ServiceHealthStatus.DOWN }`

  Scenario: Readiness khi RabbitMQ (message bus) bị down (non-critical for write path)
    Given RabbitMQ (message bus) không khả dụng nhưng EventStoreDB vẫn UP
    When operator gọi `GET /health/ready` trên `azm-command`
    Then dịch vụ có thể trả HTTP 200 (ready with degraded) hoặc HTTP 503 tuỳ cấu hình
    And body nên phản ánh `data.rabbitmq` = `ServiceHealthStatus.UNKNOWN` hoặc `DOWN` theo policy
```

### AZM Query Liveness Health Check

```gherkin
Feature: Azm Query Liveness Health Check
  Scenario: Kiểm tra liveness của `azm-query`
    Given tiến trình dịch vụ `azm-query` đã được khởi động và đang chạy
    When operator hoặc orchestrator gọi `GET /health/liveness` trên `azm-query`
    Then dịch vụ trả về HTTP 200
    And nội dung response có trường `message` = "Service still alive"
```

### AZM Query Readiness Health Check

```gherkin
Feature: Azm Query Readiness Health Check
  Scenario: Kiểm tra readiness healthy cho `azm-query`
    When operator gọi `GET /health/ready` trên `azm-query`
    Then body của response là `ISuccessResponse<HealthDetails>` với `data` ánh xạ các keys component tới `ServiceHealthStatus.UP` (ví dụ `{ postgresql: 'up', redis: 'up', elasticsearch: 'up' }`) và optional `metadata.checkedAt`

  Scenario: Readiness khi PostgreSQL (read models) cho `azm-query` bị down
    Given PostgreSQL (read models) không khả dụng cho `azm-query`
    When operator gọi `GET /health/ready` trên `azm-query`
    Then dịch vụ trả về HTTP 503
    And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ postgresql: ServiceHealthStatus.DOWN }`

  Scenario: Readiness khi Redis (cache) cho `azm-query` bị down
    Given Redis (cache) không khả dụng cho `azm-query`
    When operator gọi `GET /health/ready` trên `azm-query`
    Then dịch vụ trả về HTTP 503
    And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ redis: ServiceHealthStatus.DOWN }`

  Scenario: Readiness khi Elasticsearch (search/index) cho `azm-query` bị down (degraded)
    Given Elasticsearch (search/index) không khả dụng cho `azm-query`
    When operator gọi `GET /health/ready` trên `azm-query`
    Then dịch vụ có thể trả HTTP 200 (ready with degraded) hoặc HTTP 503 tuỳ policy
    And body nên phản ánh `data.elasticsearch` = `ServiceHealthStatus.DOWN` hoặc `UNKNOWN` cùng với `metadata.checkedAt`
```

### AZM Projector Liveness Health Check

```gherkin
Feature: Azm Projector Liveness Health Check
  Scenario: Kiểm tra liveness của `azm-projector`
    Given tiến trình dịch vụ `azm-projector` đã được khởi động và đang chạy
    When operator hoặc orchestrator gọi `GET /health/liveness` trên `azm-projector`
    Then dịch vụ trả về HTTP 200
    And nội dung response có trường `message` = "Service still alive"
```

### AZM Projector Readiness Health Check

```gherkin
Feature: Azm Projector Readiness Health Check
  Scenario: Kiểm tra readiness healthy cho `azm-projector`
    When operator gọi `GET /health/ready` trên `azm-projector`
    Then body của response là `ISuccessResponse<HealthDetails>` với `data` ánh xạ các keys component tới `ServiceHealthStatus.UP` (ví dụ `{ eventstoredb: 'up', postgresql: 'up', redis: 'up', elasticsearch: 'up' }`) và optional `metadata.checkedAt`

  Scenario: Readiness khi EventStoreDB (event source) bị down
    Given EventStoreDB không khả dụng cho `azm-projector`
    When operator gọi `GET /health/ready` trên `azm-projector`
    Then dịch vụ trả về HTTP 503
    And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ eventstoredb: ServiceHealthStatus.DOWN }`

  Scenario: Readiness khi PostgreSQL (projections) bị down
    Given PostgreSQL (projections) không khả dụng cho `azm-projector`
    When operator gọi `GET /health/ready` trên `azm-projector`
    Then dịch vụ trả về HTTP 503
    And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ postgresql: ServiceHealthStatus.DOWN }`

  Scenario: Readiness khi RabbitMQ (publish) bị down (non-critical)
    Given RabbitMQ không khả dụng nhưng EventStoreDB và PostgreSQL vẫn UP
    When operator gọi `GET /health/ready` trên `azm-projector`
    Then dịch vụ có thể trả HTTP 200 (ready with degraded) hoặc HTTP 503 tuỳ cấu hình
    And body nên phản ánh `data.rabbitmq` = `ServiceHealthStatus.UNKNOWN` hoặc `DOWN` theo policy
```

## 3. Commands

### CreateRoleCommand

- Payload: `productId`, `roleName`, `scope`, optional `permissions`, `initiatedBy`
- Validation: `productId` exists, `roleName` normalized, uniqueness per product (Guard Stream)
- Aggregate: `iam-role-<roleId>` stream and `unique-roleName-<productId>-<normalizedRoleName>` guard stream
- Events emitted: `RoleCreatedEvent`, `RoleNameLockAcquiredEvent` (guard stream)
- Notes: use atomic append to ensure uniqueness per ADR-IAM-7.

### UpdateRoleCommand

- Payload: `roleId`, `changes`, `initiatedBy`
- Validation: role exists, if name changed ensure new name guard stream available
- Aggregate: `iam-role-<roleId>` stream
- Events emitted: `RoleUpdatedEvent`, optional `RoleNameLockAcquired/ReleasedEvent` for name changes

### UpdateRolePermissionsCommand

- Payload: `roleId`, `addedPermissionIds[]`, `removedPermissionIds[]`, `initiatedBy`
- Validation: role exists; permissions exist and are applicable to product
- Aggregate: `iam-role-<roleId>` stream
- Events emitted: `RolePermissionsChangedEvent`
- Notes: include `affectedMembershipIds?` or token hints if computable for fast revocation.

### DeleteRoleCommand

- Payload: `roleId`, `initiatedBy`
- Validation: role has no active memberships (precondition)
- Aggregate: `iam-role-<roleId>` stream
- Events emitted: `RoleDeletedEvent`

### RegisterPermissionCommand

- Payload: `permissionKey`, `productId`, `version`, metadata
- Validation: uniqueness per product and key
- Aggregate: `iam-permission-<permissionId>` stream
- Events emitted: `PermissionRegisteredEvent`

### DeprecatePermissionCommand

- Payload: `permissionId`, optional `replacementPermissionId`, `initiatedBy`
- Validation: permission exists
- Aggregate: `iam-permission-<permissionId>` stream
- Events emitted: `PermissionDeprecatedEvent`

### RequestRoleAssignmentCommand

- Payload: `requestId`, `userId`, `roleId`, optional `productId`, optional `tenantId`, `initiatedBy`
- Validation: role and user existence, product/tenant enrollment checks delegated to OCS
- Aggregate: `iam-roleassignmentrequest-<requestId>` stream
- Events emitted: `RoleAssignmentRequestedEvent`

## 4. Queries

### GetRoleById

- Payload: `roleId`
- Returns: role metadata, permissions, active flag
- Source: role projection (Postgres/ES)

### FindRolesByProduct

- Payload: `productId`, optional filters
- Returns: list of roles for product
- Source: role projection

### FindRoleByName

- Payload: `productId`, `roleName`
- Returns: single role or null
- Source: role projection (note: guard stream is authoritative for writes only)

### GetPermissionsByProduct

- Payload: `productId`
- Returns: list of permission keys and versions
- Source: permission projection

### GetRoleAssignmentRequest

- Payload: `requestId`
- Returns: request status and history (requested, handled, result)
- Source: role assignment request projection

### CheckRoleNameAvailability

- Payload: `productId`, `roleName`
- Returns: `{ available: boolean }` (eventual consistency)
- Source: role projection (for write-time uniqueness rely on Guard Stream)

---

## 5. Workflows

### Giới thiệu

AZM quản lý vòng đời Role, Permission, assignment request, uniqueness (Guard Streams), và phát trigger cho ACM khi thay đổi quyền. Một số quy trình nghiệp vụ gồm nhiều bước, có trạng thái trung gian, cần orchestration hoặc xử lý sự kiện bất đồng bộ.

### Danh sách các Workflow chính

- **Quy trình tạo/cập nhật/xóa Role:**
  - CreateRoleCommand, UpdateRoleCommand, DeleteRoleCommand, đảm bảo uniqueness qua Guard Streams, atomic append.
  - Khi cập nhật tên, thực hiện atomic swap lock.

- **Quy trình quản lý Permission:**
  - RegisterPermissionCommand, DeprecatePermissionCommand, đảm bảo uniqueness, versioning, deprecate an toàn.

- **Thay đổi quyền Role (trigger ACM):**
  - UpdateRolePermissionsCommand → emit RolePermissionsChangedEvent (có thể kèm affectedMembershipIds, affectedUserIds, token-level hints), ACM sẽ xử lý revocation.

- **Yêu cầu gán Role (AZM → OCS):**
  - RequestRoleAssignmentCommand → emit RoleAssignmentRequestedEvent, chờ MembershipCreatedEvent/MembershipRejectedEvent từ OCS, ghi nhận kết quả, có thể emit RoleAssignmentRequestFailedEvent.

- **Guard Streams uniqueness:**
  - Khi tạo/cập nhật Role, sử dụng Guard Streams để enforce uniqueness, atomic append để tránh race condition.

---

## 6. Process Manager

### Giới thiệu

Process Manager (Saga/Orchestrator) trong AZM điều phối các workflow nhiều bước, lắng nghe sự kiện, phát sinh command tiếp theo, xử lý timeout, retry, hoặc orchestration giữa nhiều aggregate/stream.

### Đề xuất các Process Manager

- **RoleAssignmentRequestProcessManager:** Orchestrate luồng request role assignment (AZM → OCS), theo dõi trạng thái, chờ MembershipCreated/MembershipRejected, ghi nhận kết quả, timeout/retry nếu cần.
- **RoleNameUniquenessProcessManager:** Orchestrate atomic create/update role với Guard Streams, xử lý conflict, retry nếu cần.

### Lưu ý thực thi

- Các process manager nên event-driven, subscribe các event liên quan, lưu trạng thái process (saga state), đảm bảo idempotency và khả năng retry.
- Có thể bổ sung bảng trạng thái process (process state table) để tracking các workflow dài hơi.
