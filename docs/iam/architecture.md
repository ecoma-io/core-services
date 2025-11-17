# Kiến trúc Dịch vụ Quản lý Định danh và Truy cập (IAM)

## 1. Giới thiệu và Phạm vi

### 1.1. Mục tiêu và Động lực

Tài liệu này mô tả kiến trúc chi tiết cho **IAM Service**, một dịch vụ tập trung, hiệu suất cao, và có khả năng mở rộng, chịu trách nhiệm quản lý toàn bộ vòng đời định danh, xác thực và phân quyền cho tất cả các dự án và dịch vụ trong hệ thống.

Động lực chính của kiến trúc này là giải quyết các thách thức về khả năng mở rộng và bảo trì bằng cách áp dụng các nguyên tắc hiện đại:

- **Domain-Driven Design (DDD):** Đảm bảo logic nghiệp vụ (ví dụ: quản lý quyền, tenancy) được mô hình hóa một cách linh hoạt và chính xác.

- **CQRS (Command Query Responsibility Segregation):** Tách biệt luồng ghi (Write) và luồng đọc (Query) để tối ưu hóa hiệu suất, khả năng mở rộng và độ phức tạp cho từng luồng.

- **Event Sourcing (ES):** Sử dụng dòng sự kiện (event stream) làm nguồn chân lý (Source of Truth) duy nhất. Điều này cung cấp khả năng kiểm toán (auditability) hoàn chỉnh, cho phép tái tạo trạng thái và xây dựng lại các mô hình đọc bất cứ lúc nào.

- **Event-Driven Architecture (EDA):** Sử dụng Message Broker (RabbitMQ) để giao tiếp bất đồng bộ, đảm bảo sự tách biệt (decoupling) giữa các thành phần và các microservice khác.

### 1.2. Yêu cầu Chức năng Cốt lõi

- **Quản lý Người dùng (User Management):** Lưu trữ thông tin cơ bản của người dùng. User là thực thể chung (global) trong toàn tổ chức.

- **Quản lý Đa Tenancy (Multi-Tenancy):** Cung cấp registry cho các "namespace" (có thể là Tổ chức, Dự án). Một user có thể thuộc nhiều namespace với các vai trò khác nhau.

- **Permission Registry (Registry Quyền):**
  - Các dịch vụ có thể đăng ký các phiên bản quyền (permissions) của chúng.

  - Hỗ trợ quyền lồng nhau (nested permissions, ví dụ: `admin:user:read`).

  - Quyền cấp cao tự động bao gồm các quyền con.

  - Hệ thống luôn đọc và kết hợp (combine) 3 phiên bản major mới nhất của các quyền.

- **Xác thực và Phân quyền (AuthN/AuthZ):**
  - Cung cấp chuẩn xác thực OAuth 2.0 và OIDC.

  - Cung cấp Single Sign-On (SSO) cho các ứng dụng web/mobile.

  - Hỗ trợ xác thực Service-to-Service (S2S).

- **Bảo mật Nâng cao:**
  - Hỗ trợ 2FA (TOTP/OTP).

  - Hỗ trợ Social Login (Google, Facebook, Github) và tự động mapping.

## 2. Lựa chọn và Giải trình Kiến trúc

### 2.1. Sơ đồ Kiến trúc Cấp cao (CQRS/ES)

Kiến trúc tổng thể tách biệt hoàn toàn Write Side và Read Side:

- **Luồng Ghi (Write Flow):** Client gửi Command đến Write API. Aggregate (DDD) xử lý logic và tạo ra Domain Event. Sự kiện được lưu trữ vĩnh viễn vào Event Store DB và sau đó được phát (publish) tới RabbitMQ.

- **Luồng Đọc (Read Flow):** Projector (worker) lắng nghe sự kiện từ RabbitMQ, cập nhật các mô hình đọc (Read Models) đã được tối ưu hóa. Read API nhận Query từ client và truy vấn trực tiếp từ các Read Model này.

### 2.2. Ghi chép Quyết định Kiến trúc (ADRs)

**ADR-1: Tại sao là CQRS và Event Sourcing (ES)?**

- **Scalability:** Luồng đọc (thường chiếm 90% traffic) và luồng ghi có thể được mở rộng (scale) độc lập.

- **Performance:** Read Model được thiết kế phẳng (denormalized) để truy vấn cực nhanh (ví dụ: cache quyền trong Redis, tìm kiếm user trong Elasticsearch). Write Model chỉ tập trung vào việc ghi sự kiện.

- **Auditability & Resilience:** Event Sourcing cung cấp lịch sử bất biến của mọi thay đổi. Nếu Read Model bị lỗi, chúng ta có thể xây dựng lại nó từ đầu bằng cách phát lại (replay) các sự kiện từ Event Store DB.

**ADR-2: Lựa chọn Công nghệ (Technology Stack)**

| Thành phần          | Công nghệ      | Lý do (Rationale)                                                                                                                           |
| ------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework           | NestJS         | Hỗ trợ TypeScript mạnh mẽ, kiến trúc module rõ ràng, và có các building blocks tuyệt vời cho DDD/CQRS (`@nestjs/cqrs`).                     |
| Write Model         | Event Store DB | Được xây dựng chuyên biệt cho Event Sourcing. Hỗ trợ tối ưu cho event streams, optimistic concurrency và subscriptions.                     |
| Read Model (Data)   | PostgreSQL     | Lưu trữ các Read Model có cấu trúc (Users, Tenants, Roles, Memberships). Cung cấp khả năng join và nhất quán (ACID) cho dữ liệu quan hệ.    |
| Read Model (Search) | Elasticsearch  | Phục vụ yêu cầu tìm kiếm toàn văn (full-text) và fuzzy search cho Users và Orgs (Tenants).                                                  |
| Read Model (Cache)  | Redis          | Lưu trữ dữ liệu nóng: cache quyền đã được giải quyết (resolved permissions), OIDC sessions, và các thông tin cấu hình nóng.                 |
| Message Bus         | RabbitMQ       | Cầu nối giao tiếp bất đồng bộ giữa Write Side và Read Side (Projectors). Đảm bảo độ bền (durable) và khả năng định tuyến (routing) sự kiện. |

**ADR-3: Cơ chế Đọc Lại Bản Ghi Của Chính Mình (Read Your Own Writes - RYOW)**

1. **Ghi Nhận Vị trí (Checkpoint Store):** Tạo một bảng/Key chuyên dụng (`projection_checkpoints`) trong PostgreSQL/Redis để lưu `stream_version` (hoặc `event_id`) cuối cùng mà mỗi Projector đã xử lý thành công.

2. **Thông báo Phiên bản (Write API):** Khi `iam-command-service` xử lý Command, sau khi lưu thành công các sự kiện vào Event Store DB, nó sẽ trả về **Stream Version cuối cùng** của Aggregate đó trong Response Body hoặc một HTTP Header (ví dụ: `X-Stream-Version`).

3. **Yêu cầu Kiểm tra (Read Query):** Client (hoặc Backend Service) khi thực hiện Query ngay sau một Write Command sẽ gửi kèm `X-Stream-Version` nhận được từ Write Response trong Query Request Header (ví dụ: `GET /users/123?min_version=5`).

4. **Kiểm tra và Chờ (Read API):**
   - `iam-query-service` (Read API) sẽ kiểm tra `projection_checkpoints` của Projector liên quan.

   - Nếu `current_checkpoint < min_version`, API sẽ thực hiện một vòng lặp thăm dò (polling) ngắn (ví dụ: 5 lần, mỗi lần cách nhau 100ms) để chờ cho đến khi Projector xử lý sự kiện đó và cập nhật `current_checkpoint >= min_version`.

   - Nếu sau thời gian thăm dò mà vẫn chưa đạt đến phiên bản yêu cầu, API sẽ trả về dữ liệu Read Model hiện tại cùng cảnh báo (hoặc lỗi timeout, tùy thuộc vào nghiệp vụ).

**ADR-4: Xử lý Lỗi Sự kiện và Tái Phát (Event Handling & Replay)**

1.  **Lỗi Tức thời (Retry & DLQ):**
    - **RabbitMQ Configuration:** Thiết lập TTL và Dead Letter Exchange (DLX) để chuyển sự kiện thất bại tạm thời sang hàng đợi thử lại (Delayed/Retry Queue) với số lần giới hạn (ví dụ: 5 lần).
    - **Dead Letter Queue (DLQ):** Sau 5 lần thử lại không thành công, sự kiện sẽ được chuyển đến `iam.events.dlq` để kiểm tra thủ công.

2.  **Tiến hóa Schema (Event Upcaster):**
    - **Vị trí:** Logic Upcasting sẽ được đặt trong tầng `libs/iam-infrastructure`.
    - **Chức năng:** Trước khi một Projector xử lý sự kiện, nó sẽ được chuyển qua **Upcaster Registry** để chuyển đổi sự kiện từ phiên bản cũ (V1, V2) lên phiên bản hiện tại mới nhất (Vn), đảm bảo Projector luôn hoạt động với schema dữ liệu mà nó mong đợi.

3.  **Tái Phát Dài hạn (Full Replay):**
    - **Mục đích:** Để khắc phục lỗi logic trong Projector hoặc thay đổi mô hình đọc.
    - **Quy trình Ops:** Sử dụng công cụ Vận hành để đọc trực tiếp các sự kiện từ **Event Store DB** (nguồn chân lý), chạy chúng qua Upcaster, và sau đó chạy qua Projector để **xây dựng lại** (re-hydrate) Read Model từ đầu. Luồng tiêu thụ sự kiện từ RabbitMQ phải được tạm dừng trong quá trình này.

**ADR-5: Quy tắc Merge Quyền (Permissions Merge Rules)**

- **Vấn đề:** Cần quy tắc deterministic để hợp nhất `permissionsTree` từ nhiều phiên bản major (chỉ giữ 3 major mới nhất) khi có xung đột về node/key.
- **Quyết định:**
  - Lấy tối đa **3 major versions** mới nhất cho mỗi service; trong mỗi major chọn phiên bản patch mới nhất.
  - Xếp theo priority: higher major ⇒ higher priority; cùng major thì patch cao hơn có priority cao hơn.
  - Thực hiện merge theo **node-path deep-merge**: với cùng path, giữ node từ source có priority cao nhất; với container nodes, hợp nhất children đệ quy.
  - Nếu node đổi loại (leaf ↔ container), chọn node từ source có priority cao hơn; ghi metadata `resolved_from` để audit.
- **Hậu quả:** Merge deterministic, cần rebuild/invalidatation cache khi service publish version mới; cần audit logs để debug trường hợp ghi đè không mong muốn.

**ADR-6: Chính sách Snapshot cho Aggregates (Snapshot Policy)**

- **Vấn đề:** Rehydration từ stream dài tốn thời gian; snapshot giảm chi phí nhưng cần chính sách tạo và lưu trữ.
- **Quyết định:**
  - Snapshot theo chính sách hybrid: tạo snapshot sau **N = 100** events OR **T = 24h** kể từ snapshot trước (tùy aggregate có thể điều chỉnh, ví dụ User N=50).
  - Metadata snapshot (aggregateId, lastEventPosition, snapshotVersion, createdAt) lưu trong Event Store DB/Postgres; payload lớn lưu trên blob store (S3/GCS), payload ≤256KB lưu inline (JSONB/bytea).
  - Luôn phiên bản hóa snapshot (`snapshotVersion`) và dùng upcaster cho snapshot khi cần.
  - Giữ K latest snapshots (K=3) và cung cấp công cụ tạo/restore snapshot on-demand.
- **Hậu quả:** Cần job retry cho snapshot thất bại, quản lý lifecycle snapshot và chi phí lưu trữ blob.

**ADR-7: Ngữ nghĩa Checkpoint cho Projectors (Projection Checkpoint Semantics)**

- **Vấn đề:** Cần đảm bảo projector tiến bộ, hỗ trợ RYOW, replay và restart an toàn.
- **Quyết định:**
  - Checkpoint theo **per-projector, per-stream**.
  - Lưu checkpoint trong table `projection_checkpoints` (Postgres cùng DB với read-model) với cột `projector_name, stream_name, last_position, last_event_id, updated_at, error_count`.
  - Projector cập nhật checkpoint trong cùng transaction với cập nhật read-model để đảm bảo checkpoint tiến lên chỉ khi cập nhật read-model thành công.
  - Projector phải idempotent; dùng unique constraints hoặc lưu processed event id để tránh duplicate effects.
  - Hỗ trợ admin commands để pause/rebuild/checkpoint-set cho replay.
- **Hậu quả:** Khuyến nghị co-locate checkpoint DB với read-model; nếu không khả thi, dùng outbox/transactional pattern.

## 3. Mô hình Domain (Domain Model - DDD)

### 3.1. Tổng quan Aggregates (ARs)

- **User (AR - Global):** Đại diện cho định danh chung (global identity) của một người dùng.

- **Tenant (AR - Namespace/Scope):** Đại diện cho một phạm vi (scope) nghiệp vụ (Tổ chức, Dự án). Đây là đơn vị để phân tách Roles và Memberships.

- **Role (AR - Scoped):** Đại diện cho một tập hợp các quyền, luôn được gắn với một Tenant.

- **Membership (AR - Linking):** Liên kết một User (Global) với một Tenant (Scope) và gán các Role (Scoped) cho họ.

- **ServiceDefinition (AR):** Registry lưu trữ các phiên bản quyền (permissions tree) mà các dịch vụ khác đăng ký.

- **Application (AR):** Đại diện cho một OIDC/OAuth Client (dùng cho S2S hoặc ứng dụng bên thứ ba).

### 3.2. Định nghĩa Chi tiết ARs

**User (Aggregate Root - Global)**

| Trường        | Kiểu dữ liệu      | Mô tả                                          |
| ------------- | ----------------- | ---------------------------------------------- |
| `userId`      | UUID              | Định danh người dùng duy nhất toàn hệ thống.   |
| `email`       | String (VO)       | Duy nhất, dùng cho xác thực và Social Mapping. |
| `profile`     | Value Object      | `firstName`, `lastName`, `avatarUrl`.          |
| `status`      | Enum              | `Active`, `Suspended`, `PendingVerification`.  |
| `socialLinks` | Entity Collection | `[{ provider, providerId, providerEmail }]`.   |
| `mfaMethods`  | Entity Collection | `[{ type: 'TOTP', secret, isEnabled }]`.       |

**Tenant (Aggregate Root - Namespace)**

| Trường      | Kiểu dữ liệu    | Mô tả                                                             |
| ----------- | --------------- | ----------------------------------------------------------------- |
| `tenantId`  | UUID            | Định danh duy nhất cho Namespace/Org.                             |
| `name`      | String          | Tên hiển thị (ví dụ: "Dự án X").                                  |
| `namespace` | String (Unique) | Định danh ngắn, duy nhất, dùng để tham chiếu (e.g., `project-x`). |
| `metadata`  | JSONB           | Thông tin cấu hình mở rộng (logo, plan, v.v.).                    |

**Role (Aggregate Root - Scoped)**

_Đáp ứng yêu cầu: "Các role được tạo ra phải luôn được gắn mới một scope."_

| Trường           | Kiểu dữ liệu        | Mô tả                                                                             |
| ---------------- | ------------------- | --------------------------------------------------------------------------------- |
| `roleId`         | UUID                | Định danh duy nhất cho Role.                                                      |
| `tenantId`       | UUID (FK, NOT NULL) | Bắt buộc gắn Role với một Tenant (Namespace) cụ thể.                              |
| `name`           | String              | Tên Role (ví dụ: "Project Admin").                                                |
| `description`    | String              | Mô tả ngắn gọn về vai trò.                                                        |
| `permissionKeys` | List<String>        | Danh sách các key quyền được gán (dạng phẳng, e.g., `['admin', 'billing:read']`). |

**Membership (Aggregate Root - Linking)**

_Đáp ứng yêu cầu: "User có thể đồng thời thuộc về nhiều namespace/org."_

| Trường         | Kiểu dữ liệu | Mô tả                                                               |
| -------------- | ------------ | ------------------------------------------------------------------- |
| `membershipId` | UUID         |                                                                     |
| `userId`       | UUID (FK)    | Liên kết đến User (Global).                                         |
| `tenantId`     | UUID (FK)    | Liên kết đến Tenant (Namespace).                                    |
| `roleIds`      | List<UUID>   | Danh sách các Role (Scoped) được gán cho User trong `tenantId` này. |

**ServiceDefinition (Aggregate Root)**

| Trường      | Kiểu dữ liệu      | Mô tả                                             |
| ----------- | ----------------- | ------------------------------------------------- |
| `serviceId` | UUID              | Định danh dịch vụ đăng ký quyền.                  |
| `name`      | String            | Tên dịch vụ (e.g., `billing-service`).            |
| `versions`  | Entity Collection | `[{ version: "1.0.0", permissionsTree: JSONB }]`. |

**Cấu trúc `permissionsTree` (JSONB):**

```json
[
  {
    "key": "admin",
    "description": "Quyền Quản trị Toàn cục",
    "children": [
      {
        "key": "user",
        "description": "Quản lý Người dùng",
        "children": [{ "key": "read", "description": "Xem danh sách người dùng" }]
      }
    ]
  }
]
```

### 3.3. Domain Events (Sự kiện Nghiệp vụ)

- `UserRegistered` (userId, email, name, sourceProvider)

- `UserPasswordChanged` (userId)

- `UserMFAEnabled` (userId, method)

- `UserSocialLinked` (userId, provider, providerId)

- `TenantCreated` (tenantId, name, namespace)

- `UserAddedToTenant` (membershipId, userId, tenantId)

- `RoleAssignedToUser` (membershipId, roleId)

- `ServiceVersionRegistered` (serviceId, version, permissionsTree)

- `RoleCreated` (roleId, tenantId, name, permissionKeys)

- `ApplicationRegistered` (clientId, name)

## 4. Triển khai CQRS và EDA

### 4.1. Luồng Ghi (Write Side Flow)

1. **Client gửi Command** (ví dụ: `AssignRoleToUserCommand`) đến Write API.

2. **CommandHandler (NestJS)** xác thực Command.

3. Nó tải **Membership AR** từ Event Store DB (bằng cách replay các sự kiện của `membershipId` đó để tái tạo trạng thái).

4. Gọi phương thức nghiệp vụ: `membership.assignRole(roleId)`.

5. AR tạo ra sự kiện `RoleAssignedToUser` và giữ nó trong `uncommitted_events`.

6. **Repository** lưu sự kiện này vào stream trong Event Store DB (đảm bảo optimistic concurrency).

7. Sau khi lưu thành công, **EventPublisher** (một service nội bộ) phát (publish) sự kiện `RoleAssignedToUser` lên RabbitMQ (Exchange: `iam.events`).

### 4.2. Luồng Đọc (Read Side Flow - Projectors)

Một (hoặc nhiều) Projector (NestJS Worker) lắng nghe các sự kiện từ RabbitMQ.

- **Projector Chính (PostgreSQL):**
  - Nhận `UserRegistered` -> `INSERT INTO users ...`

  - Nhận `RoleAssignedToUser` -> `INSERT INTO membership_roles (membership_id, role_id) ...`

- **Projector Tìm kiếm (Elasticsearch):**
  - Nhận `UserRegistered` -> `client.index('users', { userId, email, name }) ...`

- **Projector Quyền (Permission Projector):** (Xem mục 4.3)

### 4.3. Logic Cốt lõi: Xử lý Quyền (Permission Resolution)

Đây là cơ chế phức tạp nhất, kết hợp yêu cầu "3 major versions" và "quyền lồng".

**Giai đoạn 1: Tính toán Nền (Background Projection - Combined Tree)**

- **Kích hoạt:** Khi `ServiceVersionRegistered` event được nhận.

- **Hành động:** `PermissionProjector` được kích hoạt.

- **Logic:**
  a. Tải tất cả các `ServiceDefinition` từ Read Model (Postgres).
  b. Với mỗi dịch vụ, tìm **3 major versions mới nhất** (ví dụ: 3.x, 2.x, 1.x) và lấy phiên bản mới nhất (latest patch) của mỗi major đó.
  c. **Hợp nhất (Merge):** Projector hợp nhất các `permissionsTree` (JSONB) của các phiên bản này lại. (Logic merge: ưu tiên phiên bản mới nhất nếu có xung đột).

- **Lưu trữ (Cache):**
  - Lưu cây JSON đã hợp nhất vào PostgreSQL: `combined_permissions_cache`.

  - Đẩy cây JSON này vào Redis (Key: `permissions:combined-tree`).

**Giai đoạn 2: Giải quyết Quyền User (User Permission Resolution)**

- **Kích hoạt:** Khi `RoleAssignedToUser` xảy ra, hoặc `RoleCreated` (với `permissionKeys` thay đổi), hoặc `UserAddedToTenant`.

- **Hành động:** `UserPermissionProjector` được kích hoạt.

- **Input:** `userId`, `tenantId` (từ sự kiện).

- **Logic:**
  a. **Tải Keys:** Lấy tất cả `permissionKeys` (dạng phẳng) từ các Role mà User được gán trong Tenant đó. (Ví dụ: `P_keys = {'admin', 'billing:read'}`).
  b. **Tải Cây Quyền:** Đọc `permissions:combined-tree` từ Redis (đã được Giai đoạn 1 chuẩn bị).
  c. **Mở rộng Quyền (Expansion):** \* Duyệt qua mỗi key `P` trong `P_keys`. \* Đáp ứng yêu cầu: "Quyền cấp cao tự động bao gồm quyền con." \* Sử dụng Cây Quyền, tìm tất cả các key con (đệ quy) bên dưới `P` (ví dụ: `admin` -> `admin:user`, `admin:user:read`). \* Thêm tất cả key con đã tìm thấy vào một Set cuối cùng (đã mở rộng và làm phẳng).

- **Lưu trữ (Cache):**
  - Lưu Set quyền cuối cùng này vào Redis (Key: `user_perms:{userId}:{tenantId}`).

**Giai đoạn 3: Kiểm tra Quyền (Live Access Check)**

1. Client gọi API (ví dụ: `GET /api/v1/users/123`).

2. API Gateway/Backend Service cần kiểm tra quyền `admin:user:read`.

3. Nó thực hiện 1 lệnh duy nhất (O(1) lookup): `Redis.SISMEMBER('user_perms:{userId}:{tenantId}', 'admin:user:read')`.

4. Nếu kết quả là `true`, cho phép truy cập.

## 5. Chi tiết Giao thức và Bảo mật

### 5.1. OAuth 2.0 / OIDC Profile

- **Claims Chuẩn:** Tuân thủ OIDC (`openid`, `profile`, `email`).

- **Scopes Chuẩn:** `openid`, `profile`, `email`, `offline_access`.

- **Scopes Động (Dynamic Scopes):**
  - Các Client (`Application` AR) có thể yêu cầu các Scopes tương ứng với permission keys (ví dụ: `scope="openid profile admin:user:read"`).

  - Khi cấp token, IAM Service (OIDC Provider) sẽ kiểm tra Set quyền đã được giải quyết trong Redis (mục 4.3). Chỉ các Scopes mà user thực sự có quyền mới được cấp trong Access Token.

- **Luồng (Flows):**
  - Web/Mobile Apps: Authorization Code + PKCE (Bắt buộc).

  - Service-to-Service: Client Credentials.

### 5.2. Luồng S2S (Client Credentials)

1. Service A (ví dụ: Billing) dùng `clientId` và `clientSecret` của nó (lấy từ `Application` AR) để gọi IAM service.

2. IAM cấp một Access Token.

3. Đáp ứng yêu cầu: "Token S2S không cần phải có tenant cụ thể." -> Token này đại diện cho chính Dịch vụ (Service), không đại diện cho một user hay tenant cụ thể.

## 6. Triển khai và Vận hành (Deployment & Ops)

### 6.1. Mô hình Triển khai (Docker)

Hệ thống được đóng gói thành **3 Docker images** riêng biệt từ cùng một codebase NestJS (chạy với các entrypoint khác nhau) để đảm bảo khả năng mở rộng độc lập:

- **`apps/iam-command-service` (Container 1):**
  - Chạy NestJS API.

  - Chỉ expose các endpoint nhận Command (POST, PUT, DELETE).

  - Scale dựa trên lưu lượng ghi.

- **`apps/iam-query-service` (Container 2):**
  - Chạy NestJS API.

  - Chỉ expose các endpoint nhận Query (GET).

  - Scale dựa trên lưu lượng đọc.

- **`apps/iam-projector-workers` (Container 3):**
  - Chạy NestJS Worker (không mở port HTTP).

  - Lắng nghe RabbitMQ và cập nhật Read Models (Postgres, ES, Redis).

  - Scale dựa trên backlog của RabbitMQ (số lượng sự kiện chờ xử lý).

### 6.2. Observability (Giám sát)

- **Logging:** Sử dụng Pino (hoặc thư viện tương tự) để ghi log dưới dạng JSON cấu trúc ra `stdout`, cho phép các hệ thống (như ELK Stack) thu thập dễ dàng.

- **Tracing:** Tích hợp OpenTelemetry (OTEL) vào NestJS. Đảm bảo `traceId` được truyền từ Command -> Event (trong metadata) -> Projector, cho phép theo dõi toàn bộ luồng xử lý của một yêu cầu.

### 6.3. Chiến lược Dữ liệu (Event Store DB)

- **Snapshotting:** Bắt buộc phải triển khai cơ chế Snapshotting cho các AR "sống lâu" (long-lived) như User. Ví dụ, tạo Snapshot trạng thái của User sau mỗi 100 sự kiện để giảm thời gian tái tạo (re-hydration) khi tải AR.

- **Archiving:** Các sự kiện cũ (ví dụ: sự kiện trước Snapshot mới nhất) có thể được di chuyển (archive) sang Cold Storage (S3, GCS) để giảm chi phí lưu trữ nhưng vẫn đảm bảo tuân thủ kiểm toán.

## 7. Cấu trúc Thư mục Nx Monorepo

Kiến trúc thư mục tuân thủ mô hình phẳng (flat structure) và ánh xạ trực tiếp các tầng của Clean Architecture/DDD/CQRS, đảm bảo tách biệt rõ ràng giữa Write Side và Read Side.

| Tên Project                   | Tầng Kiến trúc            | Vai trò                                                                                             |
| ----------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------- |
| `libs/iam-domain`             | Domain (Core)             | Nguồn chân lý: Aggregate Roots, Domain Events, Value Objects.                                       |
| `libs/iam-command-interactor` | Application (Commands)    | Các Command và Command Handlers (Use Cases Ghi).                                                    |
| `libs/iam-query-interactor`   | Application (Queries)     | Các Query và Query Handlers (Use Cases Đọc).                                                        |
| `libs/iam-infrastructure`     | Infrastructure (Adapters) | Triển khai Repository (EventStore, Postgres), Event Publisher (RabbitMQ), Snapshot, OIDC/JWT.       |
| `libs/iam-worker-projector`   | Infrastructure (Workers)  | Base Projector, Checkpoint Repository, Upcaster Registry, RabbitMQ Adapter cho Read Side.           |
| `apps/iam-command-service`    | Presentation (Write API)  | Ứng dụng NestJS HTTP: Nhận Commands (POST, PUT, DELETE).                                            |
| `apps/iam-query-service`      | Presentation (Read API)   | Ứng dụng NestJS HTTP: Nhận Queries (GET).                                                           |
| `apps/iam-projector-worker`   | Presentation (Worker)     | Ứng dụng NestJS Background: Tiêu thụ Events và cập nhật Read Models (sử dụng iam-worker-projector). |

## 8. Chi tiết Kỹ thuật Cấp thấp (LLD)

Phần này mô tả các Ports (Interfaces) và cách NestJS Modules được sử dụng để khởi tạo các triển khai (Implementations).

### 8.1. Định nghĩa Interfaces (Ports - Đặt trong Interactor Libs)

| Tên Interface (Port)              | Tầng Kiến trúc | Phương thức Chính                                     | Vai trò                                                |
| --------------------------------- | -------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| `IEventStoreRepository`           | Write Side     | `saveEvents(events, expectedVersion)`                 | Lưu sự kiện và kiểm tra tính đồng thời (Concurrency).  |
| `IEventPublisher`                 | Write Side     | `publish(events)`                                     | Đảm bảo sự kiện được phát tới Message Broker.          |
| `IUserReadRepository`             | Read Side      | `searchUsers(query, tenantId?)`                       | Truy vấn Read Model (Postgres/ES) để tìm người dùng.   |
| `IAuthorizationService`           | Shared/Auth    | `checkPermission(userId, tenantId, requiredKey)`      | Kiểm tra Quyền Sống (Live Check) dựa trên Redis Cache. |
| `IProjectionCheckpointRepository` | Infrastructure | `getCheckpoint(name)`, `setCheckpoint(name, version)` | Quản lý vị trí Projector đã xử lý (Phục vụ ADR-3).     |

### 8.2. Cấu hình Bootstrap (NestJS Module Selection)

**🎯 Mô hình Module trong `libs/iam-infrastructure`**

| Module                  | Providers Cung cấp                               | Exports Interfaces                                    |
| ----------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| `EventStoreModule`      | `EventStoreRepository`                           | `IEventStoreRepository`                               |
| `MessagingModule`       | `RabbitMQEventPublisher`                         | `IEventPublisher`                                     |
| `ReadModelModule`       | `UserReadRepository`, `MembershipReadRepository` | `IUserReadRepository`, `IMembershipReadRepository`    |
| `PermissionCacheModule` | `RedisPermissionCache`, `AuthorizationService`   | `IPermissionCacheRepository`, `IAuthorizationService` |
| `CheckpointModule`      | `PostgresCheckpointRepository`                   | `IProjectionCheckpointRepository`                     |

**🎯 Ứng dụng Presentation: Khởi tạo (App Bootstrap)**

| Ứng dụng (App)               | Vai trò   | Modules Hạ tầng (Infrastructure) được Import                                      | Rationale                                                                        |
| ---------------------------- | --------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `iam-command-service`        | Write API | `EventStoreModule`, `MessagingModule`                                             | Cần Lưu (Store) và Phát (Publish) sự kiện.                                       |
| `iam-query-service`          | Read API  | `ReadModelModule`, `PermissionCacheModule`, `CheckpointModule`                    | Cần Đọc (Read Model Repos), Kiểm tra Quyền (Auth), và Kiểm tra Phiên bản (RYOW). |
| `apps/iam-projector-workers` | Worker    | `MessagingModule`, `ReadModelModule`, `PermissionCacheModule`, `CheckpointModule` | Cần Tiêu thụ Events, Cập nhật Read Models, và Cập nhật Checkpoint (RYOW).        |

```

```
