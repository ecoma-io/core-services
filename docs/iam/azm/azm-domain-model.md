# Authorization Management (AZM) Domain Model

Tài liệu này mô tả chi tiết thiết kế miền cho Bounded Context **Authorization Management (AZM)**, chịu trách nhiệm định nghĩa và quản lý các Vai trò (Role) và Quyền (Permission).

## 1. Aggregate Roots

### Role Aggregate Root

Đại diện cho một vai trò (role) trong một Product. Role gom các Permission để định nghĩa quyền của User trong bối cảnh Product cụ thể.

| Field         | Type                                         | Description                                      |
| ------------- | -------------------------------------------- | ------------------------------------------------ |
| `roleId`      | [`RoleId`](#RoleId)                          | UUID v7 — id aggregate (readonly)                |
| `roleName`    | [`RoleName`](#RoleName)                      | Tên hiển thị / unique trong Product              |
| `productId`   | [`ProductId`](#ProductId)                    | Product sở hữu role                              |
| `scope`       | [`Scope`](#Scope)                            | Phạm vi áp dụng: `product` / `tenant` (required) |
| `description` | `string`                                     | Mô tả (i18n/summary)                             |
| `permissions` | [`Set<PermissionId>`](#PermissionId)         | Tập Permission gán cho role                      |
| `isActive`    | `boolean`                                    | Role có đang active không                        |
| `createdAt`   | `DateTime`                                   | Thời điểm tạo                                    |
| `createdBy`   | [`UserId`](/iam/idm/idm-domain-model#UserId) | Người tạo                                        |
| `updatedAt`   | `DateTime`                                   | Thời điểm cập nhật                               |
| `deletedAt?`  | `DateTime`                                   | Soft-delete (nếu có)                             |

- **Business Invariants:**
  - Tên role phải unique trong cùng một Product. Việc enforce unique constraint này phải được thực hiện bằng Guard Streams kết hợp Atomic Write/Transaction của EventStoreDB như quy định tại [ADR-IAM-7](/iam/ADR-IAM-7.md).
  - `scope` phải được khai báo khi tạo `Role` và có giá trị trong `product` | `tenant`.
  - Nếu `product` đã được cấu hình `tenancyMode = Tenantless` thì **không** cho phép tạo `Role` với `scope = tenant` (validator phải reject).
  - Các `Permission` gán cho `Role` phải tương thích với `scope` của `Role` (ví dụ: nếu `Role.scope = product` thì không được gán `Permission.scope = tenant`).
  - Role không thể bị xóa nếu đang được gán cho User (active Membership).
  - Permissions gán cho Role phải tồn tại và đang active.
  - Thay đổi permissions phải trigger cập nhật quyền hiệu lực cho Users liên quan.
  - Khi **bất kỳ permission** nào đã tồn tại tại thời điểm grant bị loại bỏ (ví dụ: permission bị remove khỏi role hoặc permission bị deleted/deprecated làm mất hiệu lực runtime), AZM **phải** phát ra `RolePermissionsChangedEvent` (mô tả phạm vi ảnh hưởng) chứa `removedPermissionIds` và các định danh ảnh hưởng (ví dụ `affectedMembershipIds`/`affectedUserIds`). AZM **có thể** kèm theo token-level hints như `affectedTokenReferenceHashes` hoặc `affectedFids` nếu nó có khả năng resolve, nhưng các trường này chỉ là "hints" — hành động phát chính thức `AccessTokensRevokedEvent`/`SessionsRevokedEvent` là trách nhiệm của ACM (Access Management). Revocation do permission change kích hoạt nhắm tới **access tokens** (token-level invalidation) và không nhất thiết buộc phải revoke toàn bộ session; thu hồi phiên vẫn được biểu diễn bằng `SessionRevokedEvent`.
  - Nếu AZM không trực tiếp có mapping token-level (ví dụ không có projection `tokenReferenceHashes`), `RolePermissionsChangedEvent` **phải** bao gồm `affectedUserIds`/`affectedMembershipIds` để ACM hoặc token service có thể xác định các phiên/sessions và `tokenReferenceHashes` liên quan.
  - AZM **không** được phát `AccessTokensRevokedEvent`/`SessionsRevokedEvent` trực tiếp. AZM chỉ phát trigger `RolePermissionsChangedEvent`; ACM chịu trách nhiệm thực thi thu hồi, đảm bảo dedupe và ghi provenance (xem `initiatedBy` trong ACM spec).

- **Value Objects:** [`RoleId`](#RoleId), [`RoleName`](#RoleName), [`ProductId`](#ProductId), [`PermissionId`](#PermissionId)
- **Ports:** [`IRoleRepository`](#IRoleRepository), [`IEventStore`](#IEventStore), [`ISnapshotStore`](#ISnapshotStore)
- **Events:** [`RoleCreatedEvent`](#RoleCreatedEvent), [`RoleUpdatedEvent`](#RoleUpdatedEvent), [`RoleDeletedEvent`](#RoleDeletedEvent), [`PermissionAddedToRoleEvent`](#PermissionAddedToRoleEvent), [`PermissionRemovedFromRoleEvent`](#PermissionRemovedFromRoleEvent)

### Permission Aggregate Root

Quản lý registry của Permission (logical actions). Permission có thể versioned và có cấu trúc phân cấp.

| Field                 | Type                                  | Description                                      |
| --------------------- | ------------------------------------- | ------------------------------------------------ |
| `permissionId`        | [`PermissionId`](#PermissionId)       | id aggregate (readonly)                          |
| `permissionKey`       | [`PermissionKey`](#PermissionKey)     | Khóa logic như ví dụ                             |
| `productId`           | [`ProductId`](#ProductId)             | Product sở hữu permission                        |
| `scope`               | [`Scope`](#Scope)                     | Phạm vi áp dụng: `product` / `tenant` (required) |
| `version`             | [`SemanticVersion`](#SemanticVersion) | Semantic version của permission                  |
| `parentPermissionId?` | `PermissionId`                        | Parent (nếu có)                                  |
| `description`         | `I18nString`                          | Mô tả đa ngôn ngữ                                |
| `isActive`            | `boolean`                             | Flag active                                      |
| `isDeprecated`        | `boolean`                             | Flag deprecated                                  |
| `createdAt`           | `DateTime`                            | Thời điểm tạo                                    |
| `updatedAt`           | `DateTime`                            | Thời điểm cập nhật                               |

- **Business Invariants:**
  - `permissionKey` và `productId` phải unique trong toàn hệ thống (khong thể có 2 permission cùng key trong 1 product).
  - `scope` phải được khai báo khi đăng ký permission và có giá trị trong `product` | `tenant`.
  - Nếu `product` đã được cấu hình `tenancyMode = Tenantless` thì **không** cho phép đăng ký permission với `scope = tenant` (validator phải reject).
  - `version` follow semantic versioning.
  - Không được xóa permission nếu đang được Role sử dụng.
  - Nếu có parent thì parent phải tồn tại.
  - Khi deprecated cần có replacement hoặc sunset policy.

- **Value Objects:** [`PermissionId`](#PermissionId), [`PermissionKey`](#PermissionKey), [`SemanticVersion`](#SemanticVersion), [`I18nString`](#I18nString)
- **Ports:** [`IPermissionRepository`](#ipermissionrepository), [`IEventStore`](#ieventstore), [`ISnapshotStore`](#isnapshotstore)
- **Events:** [`PermissionRegisteredEvent`](#permissionregisteredevent), [`PermissionUpdatedEvent`](#permissionupdatedevent), [`PermissionDeprecatedEvent`](#permissiondeprecatedevent), [`PermissionDeletedEvent`](#permissiondeletedevent)

## 2. Value Objects

### RoleId

- **Type:** string
- **Business Invariants:** UUIDv7, Immutable.

### RoleName

- **Type:** string
- **Business Invariants:** Non-empty, unique per Product.

### PermissionId

- **Type:** string
- **Business Invariants:** UUIDv7, Immutable.

### PermissionKey

- **Type:** string
- **Business Invariants:** unique per Product.

### SemanticVersion

- **Type:** object
- **Fields:** `major`, `minor`, `patch`
- **Business Invariants:** Non-negative integers, SemVer compliant.

### I18nString

- **Type:** object
- **Fields:** `entries` (Record<string, string>)
- **Business Invariants:** Non-empty values, valid locale keys.

### Scope

- **Type:** Enum
- **Values:** `product`, `tenant`
- **Business Invariants:**
  - `Scope` được dùng để xác định mức áp dụng của `Role` hoặc `Permission` và phải được validate so với `Product.tenancyMode` (ví dụ `Tenantless` products không cho phép `tenant` scope).

## 3. Events

### Role Events

Role lifecycle and permission assignment events.

#### RoleCreatedEvent

Được phát khi một `Role` mới được tạo

| Field         | Type              | Description                           |
| ------------- | ----------------- | ------------------------------------- |
| `roleId`      | `RoleId`          | Định danh `Role`                      |
| `productId`   | `ProductId`       | `Product` chủ sở hữu                  |
| `scope`       | [`Scope`](#Scope) | Phạm vi áp dụng: `product` / `tenant` |
| `roleName`    | `RoleName`        | Tên hiển thị                          |
| `permissions` | `PermissionId[]`  | Các `PermissionId` ban đầu            |
| `createdAt`   | `DateTime`        | Thời điểm tạo                         |

#### RoleUpdatedEvent

Được phát khi metadata của `Role` thay đổi (tên/mô tả/cờ active)

| Field       | Type       | Description            |
| ----------- | ---------- | ---------------------- |
| `roleId`    | `RoleId`   | Định danh `Role`       |
| `changes`   | `object`   | Các cập nhật từng phần |
| `updatedAt` | `DateTime` | Thời điểm cập nhật     |

#### RolePermissionsChangedEvent

Được phát khi permissions của một `Role` thay đổi (ví dụ thêm/bỏ permission). Event **phải** chỉ rõ các permission đã bị **bỏ** so với trạng thái tại thời điểm grant; event này là tín hiệu để kích hoạt quá trình thu hồi access tokens liên quan. AZM **không được** phát `AccessTokensRevokedEvent`/`SessionsRevokedEvent` trực tiếp — thay vào đó AZM **phải** phát `RolePermissionsChangedEvent` chứa đủ bối cảnh ảnh hưởng (ví dụ `removedPermissionIds`, `affectedMembershipIds`, `affectedUserIds`) và, nếu có thể, token-level _hints_ (`affectedTokenReferenceHashes?: string[]`, `affectedFids?: string[]`) để ACM/TokenService thực hiện revocation theo chính sách hệ thống (dedupe, provenance, audit).

| Field                           | Type             | Description                                                                                                                                                                                                            |
| ------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `roleId`                        | `RoleId`         | Định danh Role                                                                                                                                                                                                         |
| `addedPermissionIds?`           | `PermissionId[]` | Danh sách permission được thêm                                                                                                                                                                                         |
| `removedPermissionIds?`         | `PermissionId[]` | Danh sách permission bị bỏ — **một bản list cụ thể của permissions mà membership/role đã từng có tại thời điểm cấp nhưng hiện không còn** (dùng để xác định whether revoke is required)                                |
| `affectedMembershipIds?`        | `MembershipId[]` | (tùy chọn) Danh sách memberships bị ảnh hưởng                                                                                                                                                                          |
| `affectedUserIds?`              | `UserId[]`       | (tùy chọn) Danh sách user bị ảnh hưởng                                                                                                                                                                                 |
| `affectedTokenReferenceHashes?` | `string[]`       | (tùy chọn) Danh sách `tokenReferenceHashes` (hashes of `jti`) mà AZM đã xác định cần bị thu hồi — nếu có, AZM **có thể** bao gồm danh sách này như hint để hỗ trợ revoke nhanh; ACM vẫn là actor thực hiện revocation. |
| `affectedFids?`                 | `string[]`       | (tùy chọn) Danh sách `fid` (family id) mà AZM đã xác định liên quan đến invalidation hàng loạt — được coi là hint cho ACM để thực hiện fast-path invalidation.                                                         |
| `changedAt`                     | `DateTime`       | Thời điểm thay đổi                                                                                                                                                                                                     |

#### RoleDeletedEvent

Được phát khi một `Role` bị soft-delete

| Field       | Type       | Description      |
| ----------- | ---------- | ---------------- |
| `roleId`    | `RoleId`   | Định danh `Role` |
| `deletedAt` | `DateTime` | Thời điểm xóa    |

#### PermissionAddedToRoleEvent

Được phát khi một `Permission` được thêm vào `Role`

| Field          | Type           | Description               |
| -------------- | -------------- | ------------------------- |
| `roleId`       | `RoleId`       | Định danh `Role`          |
| `permissionId` | `PermissionId` | `Permission` bị ảnh hưởng |
| `changedAt`    | `DateTime`     | Thời điểm thay đổi        |

#### PermissionRemovedFromRoleEvent

Được phát khi một `Permission` bị xóa khỏi `Role`

| Field          | Type           | Description               |
| -------------- | -------------- | ------------------------- |
| `roleId`       | `RoleId`       | Định danh `Role`          |
| `permissionId` | `PermissionId` | `Permission` bị ảnh hưởng |
| `changedAt`    | `DateTime`     | Thời điểm thay đổi        |

### Permission Events

#### PermissionRegisteredEvent

Được phát khi một `Permission` mới được đăng ký vào registry

| Field           | Type              | Description                  |
| --------------- | ----------------- | ---------------------------- | -------- |
| `permissionId`  | `PermissionId`    | Định danh `Permission`       |
| `permissionKey` | `PermissionKey`   | Khóa logic định danh quyền   |
| `productId`     | `ProductId`       | `Product` chủ sở hữu         |
| `scope`         | [`Scope`](#Scope) | Phạm vi áp dụng: `product`   | `tenant` |
| `version`       | `SemanticVersion` | Phiên bản ban đầu            |
| `description?`  | `I18nString`      | Mô tả đa ngôn ngữ (tùy chọn) |
| `createdAt`     | `DateTime`        | Thời điểm tạo                |

#### PermissionUpdatedEvent

Được phát khi metadata hoặc version của `Permission` được cập nhật

| Field          | Type           | Description            |
| -------------- | -------------- | ---------------------- |
| `permissionId` | `PermissionId` | Định danh `Permission` |
| `changes`      | `object`       | Các thay đổi từng phần |
| `updatedAt`    | `DateTime`     | Thời điểm cập nhật     |

#### PermissionDeprecatedEvent

Được phát khi một `Permission` bị deprecated

| Field                      | Type           | Description                      |
| -------------------------- | -------------- | -------------------------------- |
| `permissionId`             | `PermissionId` | Định danh `Permission`           |
| `deprecatedAt`             | `DateTime`     | Thời điểm deprecated             |
| `replacementPermissionId?` | `PermissionId` | `Permission` thay thế (tùy chọn) |

#### PermissionDeletedEvent

Được phát khi một `Permission` bị xóa khỏi registry

| Field          | Type           | Description            |
| -------------- | -------------- | ---------------------- |
| `permissionId` | `PermissionId` | Định danh `Permission` |
| `deletedAt`    | `DateTime`     | Thời điểm xóa          |

#### RoleAssignmentRequestedEvent

Được phát khi AZM muốn gán một `Role` cho `User`. AZM phát event này như một request — OCS là authoritative owner cho `Membership` và sẽ xử lý event để tạo `Membership` hoặc trả về lỗi/rejection.

| Field          | Type        | Description                      |
| -------------- | ----------- | -------------------------------- | ----- | ----- | ----- | ------- | ------------------------ |
| `requestId`    | `string`    | UUID v7 — id cho request         |
| `userId`       | `UserId`    | Người dùng được yêu cầu gán role |
| `productId?`   | `ProductId` | Product liên quan (nếu có)       |
| `roleId`       | `RoleId`    | Role được gán                    |
| `tenantId?`    | `TenantId`  | Tenant nếu applicable            |
| `requestedAt`  | `DateTime`  | Thời điểm yêu cầu                |
| `initiatedBy?` | `object`    | Provenance `{ context: 'azm'     | 'idm' | 'ocs' | 'acm' | 'admin' | 'system', id?: string }` |

OCS sẽ subscribe event này và thực thi `assignMembership` theo invariant của OCS. Nếu việc gán thành công OCS phát `MembershipCreatedEvent`; nếu không, OCS phát `MembershipRejectedEvent` (với reason).

## 4. Domain Services

Phần này liệt kê các Domain Services chính cần có cho BC AZM. Mỗi dịch vụ mô tả API (method), các bất biến nghiệp vụ chính, Aggregate Roots liên quan và các Ports (interfaces) cần để kết nối với hạ tầng hoặc repository.

### PermissionRegistryService

Quản lý registry permission (register, versioning, deprecate).

- `register(permission: { key: string, productId: string, version: string }): Promise<PermissionId>`: Đăng ký permission mới.
- `publishVersion(permissionId: string, version: string): Promise<void>`: Publish version mới cho permission.
- `deprecate(permissionId: string, replacement?: PermissionId): Promise<void>`: Đánh dấu permission là deprecated, có thể kèm replacement.

- **Business Invariants:**
  - `permissionKey` phải unique; versioning tuân thủ semver.
- **Aggregate Root:** [Permission Aggregate Root](#permission-aggregate-root)
- **Ports:** [`IPermissionRepository`](#ipermissionrepository), [`IEventStore`](#ieventstore)

### RoleService

Quản lý role-level operations và propagation của permission changes.

- `createRole(payload: any): Promise<RoleId>`: Tạo role mới.
- `updatePermissions(roleId: string, permissionIds: string[]): Promise<void>`: Cập nhật permissions cho role (trigger events).
- `requestRoleAssignment(userId: string, roleId: string, tenantId?: string): Promise<{requestId: string}>`: Yêu cầu gán role cho user. AZM KHÔNG trực tiếp tạo `Membership` — AZM sẽ phát `RoleAssignmentRequestedEvent` để OCS thực thi gán membership (xem contract OCS).
- `removeRoleFromUser(membershipId: string): Promise<void>`: Thu hồi role/membership (đề xuất: AZM emits `RoleRevokedRequest` hoặc tương tự; OCS vẫn là authoritative owner for membership lifecycle).

**Business Invariants:**

- Role permissions phải tồn tại và active; thay đổi phải trigger cập nhật session hoặc revocation nếu cần.
  **Aggregate Roots:** [`Role Aggregate Root`](#role-aggregate-root)
  **Ports:** [`IRoleRepository`](#irolerepository), [`IEventPublisher`](#ieventpublisher)

## 5. Ports

Dưới đây là danh sách tổng hợp các ports (interfaces) cần thiết cho AZM bounded context. Mỗi port mô tả các phương thức chính mà nó phải cung cấp và một mô tả ngắn để các bên triển khai có thể viết adapter phù hợp với yêu cầu của domain.

### IPermissionRepository

Repositories cho registry Permission — dùng bởi domain services và commands để truy xuất và lưu trữ metadata permission.

- `IPermissionRepository.findById(permissionId: string): Promise<Permission | null>`: Tìm permission theo id.
- `IPermissionRepository.findByKey(key: string): Promise<Permission | null>`: Tìm permission theo key unique (product-scoped).
- `IPermissionRepository.save(permission: Permission): Promise<void>`: Lưu hoặc cập nhật permission.

### IRoleRepository

Repository quản lý aggregate Role — hỗ trợ truy vấn theo id/product và lưu trạng thái role.

- `IRoleRepository.findById(roleId: string): Promise<Role | null>`: Tìm role theo id.
- `IRoleRepository.findByProduct(productId: string): Promise<Role[]>`: Liệt kê các role thuộc product.
- `IRoleRepository.save(role: Role): Promise<void>`: Lưu hoặc cập nhật role (append events / snapshot theo impl).

### IMembershipRepository

Repository quản lý membership (gán role → user) — dùng cho assign/revoke và truy vấn membership theo user/product/tenant.

- `IMembershipRepository.findById(membershipId: string): Promise<Membership | null>`: Tìm membership theo id.
- `IMembershipRepository.findByUserProductTenant(userId: string, productId: string, tenantId?: string): Promise<Membership | null>`: Tìm membership theo user/product/tenant.
- `IMembershipRepository.save(membership: Membership): Promise<void>`: Lưu hoặc cập nhật membership.
- `IMembershipRepository.revoke(membershipId: string, reason?: string): Promise<void>`: Thu hồi membership (soft-delete / emit events).

### IEventStore

Source-of-truth event store (EventStoreDB semantics assumed). Adapter must support append and read semantics used by aggregates and workers.

- `append(streamId: string, events: DomainEvent[]): Promise<void>`: Ghi events vào stream (append-only).
- `read(streamId: string, fromPosition?: number, limit?: number): Promise<DomainEvent[]>`: Đọc events từ stream.
- `subscribe(streamId: string, handler: (e: DomainEvent)=>Promise<void>): Promise<Subscription>`: Subscribe / persistent subscription support.

### ISnapshotStore

Snapshot store used to speed up aggregate rehydration (ADR-IAM-5).

- `saveSnapshot(aggregateId: string, snapshot: any, version?: string): Promise<void>`: Lưu snapshot.
- `loadSnapshot(aggregateId: string): Promise<{snapshot: any, version?: string} | undefined>`: Lấy snapshot mới nhất.
- `deleteSnapshot(aggregateId: string): Promise<void>`: Xóa snapshot.
