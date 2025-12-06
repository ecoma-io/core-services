# Organization & Context Scoping (OCS) Domain Model

Tài liệu này mô tả chi tiết thiết kế miền cho Bounded Context **Organization & Context Scoping (OCS)**, chịu trách nhiệm quản lý cấu trúc tổ chức (Tenant), Sản phẩm (Product) và sự tham gia (Membership/Enrollment).

## 1. Aggregate Roots

### Tenant Aggregate Root

Đại diện cho đơn vị tổ chức trong mô hình multi-tenancy. Tenant gom Users và resources lại theo một scope quản trị.

| Field          | Type                                | Description                       |
| -------------- | ----------------------------------- | --------------------------------- |
| `tenantId`     | [`TenantId`](#TenantId)             | UUID v7 — id aggregate (readonly) |
| `tenantName`   | [`TenantName`](#TenantName)         | Tên hiển thị, validated, unique   |
| `ownerId`      | [`UserId`](#UserId)                 | Owner user id                     |
| `metadata`     | [`TenantMetadata`](#TenantMetadata) | Key-value metadata                |
| `tenantStatus` | [`TenantStatus`](#TenantStatus)     | Enum: Active, Suspended, Deleted  |
| `createdAt`    | `DateTime`                          | Thời điểm tạo                     |
| `createdBy`    | `UserId`                            | Người tạo                         |
| `updatedAt`    | `DateTime`                          | Thời điểm cập nhật                |
| `deletedAt?`   | `DateTime`                          | Soft-delete (nếu có)              |

- **Business Invariants:**
  - Tên tenant phải unique (theo namespace/chiến lược chuẩn hóa). Việc enforce unique constraint này phải được thực hiện bằng Guard Streams kết hợp Atomic Write/Transaction của EventStoreDB như quy định tại [ADR-IAM-7](/iam/ADR-IAM-7.md).
  - Tenant không thể bị xóa nếu có active Memberships hoặc resources.
  - Owner phải là user hợp lệ.
  - Khi tenant bị suspend, users của tenant không được truy cập tài nguyên của tenant.

- **Value Objects:** [`TenantId`](#TenantId), [`TenantName`](#TenantName), [`TenantMetadata`](#TenantMetadata), [`TenantStatus`](#TenantStatus)
- **Ports:** [`ITenantRepository`](#ITenantRepository), [`IEventStore`](#IEventStore), [`ISnapshotStore`](#ISnapshotStore)
- **Events:** [`TenantCreatedEvent`](#TenantCreatedEvent), [`TenantUpdatedEvent`](#TenantUpdatedEvent), [`TenantSuspendedEvent`](#TenantSuspendedEvent), [`TenantActivatedEvent`](#TenantActivatedEvent), [`TenantDeletedEvent`](#TenantDeletedEvent)

### Membership Aggregate Root

Đại diện mối quan hệ giữa `User`, `Tenant` và `Role`. Membership xác định quyền của User trong Product/Tenant cụ thể.

| Field              | Type                                    | Description                           |
| ------------------ | --------------------------------------- | ------------------------------------- |
| `membershipId`     | [`MembershipId`](#MembershipId)         | UUID v7 — id aggregate (readonly)     |
| `userId`           | [`UserId`](#UserId)                     | User giữ membership                   |
| `tenantId?`        | [`TenantId`](#TenantId)                 | Tenant (nullable cho tenantless mode) |
| `productId`        | [`ProductId`](#ProductId)               | Product liên quan                     |
| `roleId`           | [`RoleId`](#RoleId)                     | Role được gán                         |
| `membershipStatus` | [`MembershipStatus`](#MembershipStatus) | Enum: Active, Expired, Revoked        |
| `grantedAt`        | `DateTime`                              | Thời điểm gán                         |
| `grantedBy`        | `UserId`                                | Người gán                             |
| `expiresAt?`       | `DateTime`                              | Hết hạn tự động (nếu có)              |
| `revokedAt?`       | `DateTime`                              | Thời điểm bị revoke                   |

- **Business Invariants:**
  - Một User chỉ có một active Membership cho mỗi cặp `(Product, Tenant)`.
  - Role phải thuộc Product được chỉ định.
  - Tenant (nếu có) phải có enrollment active với Product.
  - Membership auto-revoke khi User hoặc Tenant bị deleted/suspended.
  - Khi Role/Permission thay đổi, cần trigger revocation hoặc cập nhật session cho các Users bị ảnh hưởng.

- **Value Objects:** [`MembershipId`](#MembershipId), [`MembershipStatus`](#MembershipStatus)
- **Ports:** [`IMembershipRepository`](#IMembershipRepository), [`IEventStore`](#IEventStore), [`ISnapshotStore`](#ISnapshotStore)
- **Events:** [`MembershipCreatedEvent`](#MembershipCreatedEvent), [`MembershipUpdatedEvent`](#MembershipUpdatedEvent), [`MembershipRevokedEvent`](#MembershipRevokedEvent), [`RoleGrantedEvent`](#RoleGrantedEvent), [`RoleRevokedEvent`](#RoleRevokedEvent)

### Product Aggregate Root

Đại diện cho một ứng dụng/dịch vụ dùng IAM để quản lý authN/authZ.

| Field            | Type                                  | Description                       |
| ---------------- | ------------------------------------- | --------------------------------- |
| `productId`      | [`ProductId`](#ProductId)             | UUID v7 — id aggregate (readonly) |
| `productName`    | [`ProductName`](#ProductName)         | Tên product, validated, unique    |
| `tenancyMode`    | [`TenancyMode`](#TenancyMode)         | Enum: MultiTenant, Tenantless     |
| `metadata`       | [`ProductMetadata`](#ProductMetadata) | Key-value metadata                |
| `isActive`       | `boolean`                             | Product enabled flag              |
| `registeredAt`   | `DateTime`                            | Khi đăng ký                       |
| `registeredBy`   | `UserId`                              | Người đăng ký                     |
| `updatedAt`      | `DateTime`                            | Thời điểm cập nhật                |
| `deactivatedAt?` | `DateTime`                            | Nếu có                            |

- **Business Invariants:**
  - Product name phải unique.
  - Tenancy mode không thể thay đổi sau khi có Tenants hoặc Memberships.
  - Product không thể deactivate nếu có active Memberships.

- **Value Objects:** [`ProductId`](#ProductId), [`ProductName`](#ProductName), [`TenancyMode`](#TenancyMode), [`ProductMetadata`](#ProductMetadata)
- **Ports:** [`IProductRepository`](#IProductRepository), [`IEventStore`](#IEventStore), [`ISnapshotStore`](#ISnapshotStore)
- **Events:** [`ProductRegisteredEvent`](#ProductRegisteredEvent), [`ProductUpdatedEvent`](#ProductUpdatedEvent), [`ProductDeactivatedEvent`](#ProductDeactivatedEvent)

### TenantProductEnrollment Aggregate Root

Đại diện cho liên kết giữa một `Tenant` và một `Product` (enrollment).

| Field          | Type                                    | Description                       |
| -------------- | --------------------------------------- | --------------------------------- |
| `enrollmentId` | `UUID`                                  | UUID v7 — id aggregate (readonly) |
| `tenantId`     | [`TenantId`](#TenantId)                 | Tenant liên kết                   |
| `productId`    | [`ProductId`](#ProductId)               | Product liên kết                  |
| `status`       | [`EnrollmentStatus`](#EnrollmentStatus) | Enum: Active, Suspended, Revoked  |
| `createdAt`    | `DateTime`                              | Thời điểm tạo                     |
| `createdBy`    | `UserId`                                | Người tạo                         |
| `updatedAt`    | `DateTime`                              | Thời điểm cập nhật                |
| `suspendedAt?` | `DateTime`                              | Nếu có                            |
| `revokedAt?`   | `DateTime`                              | Nếu có                            |

- **Business Invariants:**
  - Tối đa một Enrollment active cho mỗi cặp `(tenantId, productId)`.
  - Không thể chuyển `Revoked -> Active` (phải tạo enrollment mới nếu cần).
  - Không thể `Active` nếu Tenant bị Suspended hoặc Product inactive.

- **Value Objects:** [`EnrollmentStatus`](#EnrollmentStatus)
- **Ports:** [`ITenantProductEnrollmentRepository`](#itenantproductenrollmentrepository), [`IEventStore`](#ieventstore), [`ISnapshotStore`](#isnapshotstore)
- **Events:** [`TenantLinkedToProductEvent`](#TenantLinkedToProductEvent), [`TenantProductEnrollmentSuspendedEvent`](#TenantProductEnrollmentSuspendedEvent), [`TenantUnlinkedFromProductEvent`](#TenantUnlinkedFromProductEvent)

## 2. Value Objects

### TenantId

- **Type:** string
- **Business Invariants:** UUIDv7, Immutable.

### TenantName

- **Type:** string
- **Business Invariants:** Validated, unique per namespace.

### TenantMetadata

- **Type:** object
- **Fields:** `entries` (Record<string, any>)

### TenantStatus

- **Type:** string
- **Values:** `Active`, `Suspended`, `Deleted`

### MembershipId

- **Type:** string
- **Business Invariants:** UUIDv7, Immutable.

### MembershipStatus

- **Type:** string
- **Values:** `Active`, `Expired`, `Revoked`

### ProductId

- **Type:** string
- **Business Invariants:** UUIDv7, Immutable.

### ProductName

- **Type:** string
- **Business Invariants:** Non-empty, unique.

### TenancyMode

- **Type:** string
- **Values:** `MultiTenant`, `Tenantless`

### ProductMetadata

- **Type:** object
- **Fields:** `entries` (Record<string, any>)

### EnrollmentStatus

- **Type:** string
- **Values:** `Active`, `Suspended`, `Revoked`

## 3. Events

### Tenant Events

#### TenantCreatedEvent

Được phát khi một Tenant mới được tạo.

| Field        | Type                                | Description             |
| :----------- | :---------------------------------- | :---------------------- |
| `tenantId`   | [`TenantId`](#TenantId)             | Định danh Tenant        |
| `tenantName` | [`TenantName`](#TenantName)         | Tên hiển thị của Tenant |
| `ownerId`    | [`UserId`](#UserId)                 | User sở hữu Tenant      |
| `metadata?`  | [`TenantMetadata`](#TenantMetadata) | Metadata ban đầu        |
| `createdAt`  | `DateTime`                          | Thời điểm tạo           |

#### TenantUpdatedEvent

Được phát khi thông tin Tenant thay đổi.

| Field       | Type                    | Description         |
| :---------- | :---------------------- | :------------------ |
| `tenantId`  | [`TenantId`](#TenantId) | Định danh Tenant    |
| `changes`   | `object`                | Các trường thay đổi |
| `updatedAt` | `DateTime`              | Thời điểm cập nhật  |

#### TenantSuspendedEvent

Được phát khi Tenant bị tạm ngưng hoạt động.

| Field         | Type                    | Description         |
| :------------ | :---------------------- | :------------------ |
| `tenantId`    | [`TenantId`](#TenantId) | Định danh Tenant    |
| `suspendedAt` | `DateTime`              | Thời điểm tạm ngưng |
| `reason?`     | `string`                | Lý do tạm ngưng     |

#### TenantActivatedEvent

Được phát khi Tenant được kích hoạt lại.

| Field         | Type                    | Description         |
| :------------ | :---------------------- | :------------------ |
| `tenantId`    | [`TenantId`](#TenantId) | Định danh Tenant    |
| `activatedAt` | `DateTime`              | Thời điểm kích hoạt |
| `reason?`     | `string`                | Lý do kích hoạt     |

#### TenantDeletedEvent

Được phát khi Tenant bị xóa (soft-delete).

| Field       | Type                    | Description      |
| :---------- | :---------------------- | :--------------- |
| `tenantId`  | [`TenantId`](#TenantId) | Định danh Tenant |
| `deletedAt` | `DateTime`              | Thời điểm xóa    |

### Membership Events

#### MembershipCreatedEvent

Được phát khi một User được gán vào Product/Tenant.

| Field          | Type                            | Description               |
| :------------- | :------------------------------ | :------------------------ |
| `membershipId` | [`MembershipId`](#MembershipId) | Định danh Membership      |
| `userId`       | [`UserId`](#UserId)             | User được gán             |
| `productId`    | [`ProductId`](#ProductId)       | Product liên quan         |
| `tenantId?`    | [`TenantId`](#TenantId)         | Tenant liên quan (nếu có) |
| `roleId`       | [`RoleId`](#RoleId)             | Role được gán             |
| `grantedAt`    | `DateTime`                      | Thời điểm gán             |

#### MembershipUpdatedEvent

Được phát khi Membership thay đổi (ví dụ: thay đổi Role).

| Field          | Type                            | Description          |
| :------------- | :------------------------------ | :------------------- |
| `membershipId` | [`MembershipId`](#MembershipId) | Định danh Membership |
| `changes`      | `object`                        | Các trường thay đổi  |
| `updatedAt`    | `DateTime`                      | Thời điểm cập nhật   |

#### MembershipRevokedEvent

Được phát khi Membership bị thu hồi.

| Field          | Type                            | Description          |
| :------------- | :------------------------------ | :------------------- |
| `membershipId` | [`MembershipId`](#MembershipId) | Định danh Membership |
| `userId`       | [`UserId`](#UserId)             | User bị thu hồi      |
| `revokedAt`    | `DateTime`                      | Thời điểm thu hồi    |
| `reason?`      | `string`                        | Lý do thu hồi        |

#### RoleGrantedEvent

Được phát khi một Role cụ thể được cấp cho User (có thể nằm trong context Membership).

| Field           | Type                            | Description          |
| :-------------- | :------------------------------ | :------------------- |
| `membershipId?` | [`MembershipId`](#MembershipId) | Membership liên quan |
| `userId`        | [`UserId`](#UserId)             | User được cấp        |
| `roleId`        | [`RoleId`](#RoleId)             | Role được cấp        |
| `grantedAt`     | `DateTime`                      | Thời điểm cấp        |

#### RoleRevokedEvent

Được phát khi một Role bị thu hồi khỏi User.

| Field           | Type                            | Description          |
| :-------------- | :------------------------------ | :------------------- |
| `membershipId?` | [`MembershipId`](#MembershipId) | Membership liên quan |
| `userId`        | [`UserId`](#UserId)             | User bị thu hồi      |
| `roleId`        | [`RoleId`](#RoleId)             | Role bị thu hồi      |
| `revokedAt`     | `DateTime`                      | Thời điểm thu hồi    |
| `reason?`       | `string`                        | Lý do thu hồi        |

### Product Events

#### ProductRegisteredEvent

Được phát khi một Product mới được đăng ký vào hệ thống IAM.

| Field          | Type                                  | Description       |
| :------------- | :------------------------------------ | :---------------- |
| `productId`    | [`ProductId`](#ProductId)             | Định danh Product |
| `productName`  | [`ProductName`](#ProductName)         | Tên Product       |
| `tenancyMode`  | [`TenancyMode`](#TenancyMode)         | Chế độ Tenancy    |
| `metadata?`    | [`ProductMetadata`](#ProductMetadata) | Metadata ban đầu  |
| `registeredAt` | `DateTime`                            | Thời điểm đăng ký |

#### ProductUpdatedEvent

Được phát khi thông tin Product thay đổi.

| Field       | Type                      | Description         |
| :---------- | :------------------------ | :------------------ |
| `productId` | [`ProductId`](#ProductId) | Định danh Product   |
| `changes`   | `object`                  | Các trường thay đổi |
| `updatedAt` | `DateTime`                | Thời điểm cập nhật  |

#### ProductDeactivatedEvent

Được phát khi Product bị vô hiệu hóa.

| Field           | Type                      | Description           |
| :-------------- | :------------------------ | :-------------------- |
| `productId`     | [`ProductId`](#ProductId) | Định danh Product     |
| `deactivatedAt` | `DateTime`                | Thời điểm vô hiệu hóa |
| `reason?`       | `string`                  | Lý do                 |

### TenantProductEnrollment Events

#### TenantLinkedToProductEvent

Được phát khi một Tenant đăng ký sử dụng một Product.

| Field          | Type                                    | Description          |
| :------------- | :-------------------------------------- | :------------------- |
| `enrollmentId` | `UUID`                                  | Định danh Enrollment |
| `tenantId`     | [`TenantId`](#TenantId)                 | Tenant đăng ký       |
| `productId`    | [`ProductId`](#ProductId)               | Product được đăng ký |
| `status`       | [`EnrollmentStatus`](#EnrollmentStatus) | Trạng thái ban đầu   |
| `createdAt`    | `DateTime`                              | Thời điểm tạo        |

#### TenantProductEnrollmentSuspendedEvent

Được phát khi Enrollment bị tạm ngưng.

| Field          | Type       | Description          |
| :------------- | :--------- | :------------------- |
| `enrollmentId` | `UUID`     | Định danh Enrollment |
| `suspendedAt`  | `DateTime` | Thời điểm tạm ngưng  |
| `reason?`      | `string`   | Lý do                |

#### TenantUnlinkedFromProductEvent

Được phát khi Tenant hủy liên kết khỏi Product.

| Field          | Type       | Description          |
| :------------- | :--------- | :------------------- |
| `enrollmentId` | `UUID`     | Định danh Enrollment |
| `revokedAt`    | `DateTime` | Thời điểm hủy        |

## 4. Domain Services

### TenantService

Quản lý vòng đời của Tenant (tạo, tạm ngưng, kích hoạt, xóa).

- `createTenant(name: string, ownerId: string, metadata?: object): Promise<TenantId>`: Tạo tenant mới.
- `suspendTenant(tenantId: string, reason?: string): Promise<void>`: Tạm ngưng tenant.
- `activateTenant(tenantId: string, reason?: string): Promise<void>`: Kích hoạt lại tenant.
- `deleteTenant(tenantId: string): Promise<void>`: Xóa tenant (soft delete).

- **Business Invariants:**
  - Tên Tenant phải là duy nhất trong namespace.
  - Owner phải là một User hợp lệ.
  - Không thể xóa Tenant nếu còn Active Memberships hoặc Resources.
- **Aggregate Root**: [Tenant Aggregate Root](#tenant-aggregate-root)
- **Ports**: [`ITenantRepository`](#itenantrepository), [`IEventStore`](#ieventstore)

### MembershipService

Quản lý việc gán quyền và thành viên cho User trong context của Product/Tenant.

- `assignMembership(userId: string, productId: string, roleId: string, tenantId?: string): Promise<MembershipId>`: Gán user vào product/tenant với role.
- `revokeMembership(membershipId: string, reason?: string): Promise<void>`: Thu hồi membership.
- `checkPermission(userId: string, permission: string, context: object): Promise<boolean>`: Kiểm tra quyền (thường dùng ở tầng application/query, nhưng domain service định nghĩa logic core).

- **Business Invariants:**
  - Một User chỉ có một Active Membership cho mỗi cặp (Product, Tenant).
  - Role phải thuộc về Product.
- **Aggregate Root**: [Membership Aggregate Root](#membership-aggregate-root)
- **Ports**: [`IMembershipRepository`](#IMembershipRepository), [`IEventStore`](#IEventStore)

### TenantProductEnrollmentService

Quản lý mối quan hệ đăng ký giữa Tenant và Product.

- `linkTenantToProduct(tenantId: string, productId: string): Promise<string>`: Tạo liên kết enrollment.
- `unlinkTenantFromProduct(enrollmentId: string): Promise<void>`: Hủy liên kết.
- `suspendEnrollment(enrollmentId: string, reason?: string): Promise<void>`: Tạm ngưng enrollment.

- **Business Invariants:**
  - Tenant phải Active mới được link.
  - Product phải Active mới được link.
- **Aggregate Root**: [TenantProductEnrollment Aggregate Root](#tenantproductenrollment-aggregate-root)
- **Ports**: [`ITenantProductEnrollmentRepository`](#itenantproductenrollmentrepository), [`IEventStore`](#ieventstore)

## 5. Ports

### ITenantRepository

Interface lưu trữ cho Tenant Aggregate.

- `findById(id: string): Promise<Tenant | null>`: Tìm Tenant theo ID.
- `findByName(name: string): Promise<Tenant | null>`: Tìm Tenant theo tên.
- `save(tenant: Tenant): Promise<void>`: Lưu hoặc cập nhật Tenant.

### IMembershipRepository

Interface lưu trữ cho Membership Aggregate.

- `findById(id: string): Promise<Membership | null>`: Tìm Membership theo ID.
- `findByUserProductTenant(userId: string, productId: string, tenantId?: string): Promise<Membership | null>`: Tìm Membership active của user.
- `save(membership: Membership): Promise<void>`: Lưu hoặc cập nhật Membership.
- `revoke(id: string): Promise<void>`: Thu hồi Membership.

### ITenantProductEnrollmentRepository

Interface lưu trữ cho Enrollment Aggregate.

- `findByTenantAndProduct(tenantId: string, productId: string): Promise<Enrollment | null>`: Tìm Enrollment.
- `save(enrollment: Enrollment): Promise<void>`: Lưu hoặc cập nhật Enrollment.

### IProductRepository

Interface lưu trữ cho Product Aggregate.

- `findById(id: string): Promise<Product | null>`: Tìm Product theo ID.
- `save(product: Product): Promise<void>`: Lưu hoặc cập nhật Product.

### IEventStore

Lưu trữ và truy xuất Domain Events (Event Sourcing).

- `append(streamId: string, events: DomainEvent[]): Promise<void>`: Ghi events vào stream.
- `read(streamId: string, fromPosition?: number, limit?: number): Promise<DomainEvent[]>`: Đọc events từ stream.
- `subscribe(streamId: string, handler: (e: DomainEvent) => Promise<void>): Promise<Subscription>`: Đăng ký nhận events.

### ISnapshotStore

Lưu trữ Snapshot cho Aggregates để tối ưu hiệu năng load.

- `saveSnapshot(aggregateId: string, snapshot: any, version?: string): Promise<void>`: Lưu snapshot.
- `loadSnapshot(aggregateId: string): Promise<{snapshot: any, version?: string} | undefined>`: Tải snapshot mới nhất.
- `deleteSnapshot(aggregateId: string): Promise<void>`: Xóa snapshot.
