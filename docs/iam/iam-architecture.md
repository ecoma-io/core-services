# Kiến trúc Tổng thể Identity and Access Management (IAM)

Tài liệu này mô tả kiến trúc chi tiết cho Bounded Context IAM, một dịch vụ tập trung, hiệu suất cao và có khả năng mở rộng, chịu trách nhiệm quản lý vòng đời định danh, xác thực và phân quyền cho các dự án và dịch vụ trong tổ chức. Tuân thủ theo các tiêu chuẩn bảo mật và luôn hướng tới bảo mật theo thiết kế (security by design). Kiến trúc của BC IAM này tuần thủ theo **[C4A](../overview/c4a.md)** hướng tới các mục tiêu, nguyên tắc chung đã được mô tả trong **[Tổng quan Kiến trúc Hệ thống](../overview/overview-architecture.md)**. Những điểm trên giúp IAM hòa nhập chặt chẽ với bức tranh kiến trúc tổng thể và giảm rủi ro vận hành khi tích hợp với các services khác trong monorepo.

## 1. Mục tiêu và động lực

Một công ty phát triển phần mềm sẽ có nhiều ứng dụng khác nhau phục vụ các mục đích khác nhau như quản lý dự án, theo dõi lỗi, giao tiếp nhóm, v.v. Mỗi ứng dụng này có thể yêu cầu người dùng đăng nhập và có các vai trò và quyền khác nhau để kiểm soát truy cập. Gần như tất cả các ứng dụng này đều cần một hệ thống quản lý định danh và truy cập (IAM) để xử lý việc xác thực người dùng và phân quyền. Ví dụ như Google có Google Account để đăng nhập vào tất cả các dịch vụ của họ như Gmail, Google Drive, YouTube, v.v. Và Identity and Access Management sinh ra để giải quyết các mục tiêu sau:

- **Quản lý Định danh Tập trung:** Cung cấp một hệ thống duy nhất để quản lý định danh người dùng, giúp đơn giản hóa việc đăng nhập và quản lý tài khoản. Tuân thủ các tiêu chuẩn bảo mật như OAuth2, OpenID Connect để đảm bảo an toàn trong việc xác thực và ủy quyền. hỗ trợ Single Sign-On (SSO) để người dùng chỉ cần đăng nhập một lần để truy cập nhiều dịch vụ (Kể cả dịch vụ bên thứ 3 nếu cần).

- **Phân quyền Linh hoạt:** Cung cấp cơ chế phân quyền chi tiết và linh hoạt, cho phép quản trị viên dễ dàng gán vai trò và quyền cho người dùng dựa trên nhu cầu cụ thể của từng ứng dụng. Hỗ trợ các mô hình phân quyền khác nhau như Role-Based Access Control (RBAC)

- **Bảo mật và Kiểm toán:** Đảm bảo rằng hệ thống IAM tuân thủ các tiêu chuẩn bảo mật cao nhất, bao gồm mã hóa dữ liệu, quản lý phiên làm việc (session management), và phát hiện xâm nhập (intrusion detection). Cung cấp khả năng kiểm toán đầy đủ để theo dõi các hoạt động của người dùng và đảm bảo tính toàn vẹn của hệ thống.

- **Khả năng Mở rộng và Hiệu suất:** Thiết kế hệ thống IAM để có thể mở rộng dễ dàng khi số lượng người dùng và ứng dụng tăng lên, đồng thời đảm bảo hiệu suất cao để đáp ứng nhanh chóng các yêu cầu xác thực và phân quyền.

## 2. Yêu cầu Chức năng và Phi chức năng

### 2.1. Các Yêu cầu Chức năng

- **Global Authentication/Authorization:** Cung cấp cơ chế xác thực và phân quyền chuẩn cho tất cả các dự án con.
- **Tenancy Support:** Hỗ trợ mô hình đa khách hàng (Tenant) và đa sản phẩm (Product) một cách trong suốt. (User có thể thuộc nhiều tenants/products với các roles/permissions khác nhau và là độc lập với tenants/products).
- **Integration:** Tích hợp sẵn với hệ thống Monitoring, Logging và Auditing của nền tảng.

### 2.2 CÁc Yêu Cầu Phi Chức năng

- **Chỉ số hiệu suất cốt lõi (Core SLI):**
  - Tỉ lệ xảy ra lỗi cấp access token (Error rate): ≤ 0.1% (99.9% success rate).
  - Tỉ lệ xảy ra lỗi cấp refresh token (Error rate): ≤ 0.1% (99.9% success rate).
- **Khả năng Mở rộng (Scalability):** Các applications(services) không được lưu trữ bất kỳ dữ liệu phiên hoặc trạng thái cụ thể của người dùng trên local server memory mà phải sử dụng các hạ tầng bên ngoài như Redis, EventStoreDB, PostgreSQL, v.v. để dễ dàng thực hiện horizontal scale.
- **Mở rộng từ thiết kế (Scale by Design):** Các thành phần được thiết kế dễ dàng mở rộng thành các microservies nhỏ hơn trong tương lai nếu cần.
- **Tính Sẵn sàng (Availability):** Không có điểm chết đơn lẻ (SPOF) nhờ kiến trúc phân tán.
- **Bảo mật (Security):** Tuân thủ các chuẩn OAuth 2.0, OIDC. Mã hóa dữ liệu nhạy cảm (At-rest & In-transit).

## 3. Các Nguyên tắc Kiến trúc Cốt lõi (Core Principles)

Dựa trên các mục tiêu trung tâm về hiệu suất, khả năng mở rộng, bảo mật và kiểm toán cũng như các yêu cầu chức năng/phi chức năng đã nêu, kiến trúc BC IAM ngoài việc tuân thủ các nguyên tắc chung trong [Kiến trúc tổng quan](../architecture.md) chúng tôi cũng cũng áp dụng:

- **Event Sourcing (ES)** - sử dụng dòng sự kiện (event stream) làm nguồn chân lý (Source of Truth) duy nhất. Điều này cung cấp khả năng kiểm toán (auditability) hoàn chỉnh, cho phép tái tạo trạng thái và xây dựng lại các mô hình đọc bất cứ lúc nào.

## 4. Ghi chép Quyết định Kiến trúc cho BC IAM

Ngoài các quyết định kiến trúc chung đã ghi trong [Kiến trúc tổng quan](../architecture.md), các quyết định chính cho BC IAM gồm:

- **[ADR-IAM-1: Lựa chọn Công nghệ (Technology Stack)](/iam/ADR-IAM-1.md):** Sử dụng NestJS, Event Store DB cho Write Model, PostgreSQL cho Read Model dữ liệu có cấu trúc, Elasticsearch cho search, Redis cho cache, và RabbitMQ cho message bus.
- **[ADR-IAM-2: Sử dụng JWT cho Access Token, Opaque cho Refresh Token, JWT cho Service-to-Service Token](/iam/ADR-IAM-2.md):** Chọn JWT làm định dạng cho Access Token và Service-to-Service Token để tận dụng tính tự chứa (self-contained) và khả năng mở rộng. Sử dụng Opaque Token cho Refresh Token để tăng cường bảo mật và kiểm soát vòng đời token chặt chẽ hơn.
- **[ADR-IAM-3: Cơ chế xử lý Lỗi Sự kiện và Tái Phát (Event Handling & Replay)](/iam/ADR-IAM-3.md):** triển khai chiến lược xử lý lỗi 3 tầng với cơ chế Retry + DLQ, Event Upcasting và Full Replay
- **[ADR-IAM-4: Cơ chế permissions registry và merge 2 major versions mới nhất](/iam/ADR-IAM-4.md):** Áp dụng cơ chế permissions registry với chiến lược merge dựa trên latest 2 major versions mới nhất sử dụng priority-based deep merge.ack theo major một cách rõ ràng. Ghi provenance cho mỗi node giúp audit và debug sau này.
- **[ADR-IAM-5: Triển khai cơ chế hybrid Snapshot cho Aggregates (Hybrid Snapshot Policy)](/iam/ADR-IAM-5.md):** Hybrid snapshot policy dựa trên cả event count threshold và time threshold, với phân tầng storage (inline vs blob) dựa trên size threadhold và versioning support.
- **[ADR-IAM-6: Ngữ nghĩa Checkpoint cho Projectors (Projection Checkpoint Semantics)](/iam/ADR-IAM-6.md):** Per-projector, per-stream checkpoint được lưu trữ trong PostgreSQL (cùng transaction với Read Model) để đảm bảo tính nhất quán. Redis được sử dụng làm lớp Cache cho Checkpoint để phục vụ tra cứu nhanh (RYOW).
- **[ADR-IAM-7: Chiến lược Triển khai Ràng buộc Duy nhất (Unique Constraints) Bằng Guard Streams và Atomic Key Swap trong EventStoreDB](/iam/ADR-IAM-7.md):** Sử dụng **Guard Streams** kết hợp **Atomic Write/Transaction** của EventStoreDB để enforce unique constraints tại write-time và thực hiện Atomic Key Swap.
- **[ADR-IAM-8: Quyết định Thuật toán Băm Mật khẩu (Password Hashing Algorithm)](/iam/ADR-IAM-8.md):** Sử dụng `Argon2id` làm thuật toán băm mật khẩu mặc định cho hệ thống.
- **[ADR-IAM-9: Cơ chế Read Your Own Writes - RYOW](/iam/ADR-IAM-9.md):** checkpoint tracking là nền tảng cho RYOW (lưu checkpoint per-projector/per-stream làm ground truth cho guarantees); `SSE` (Server-Sent Events) là cơ chế push ưu tiên cho client tương tác để đạt RYOW; `polling` với timeout được xem là phương án fallback khi môi trường không hỗ trợ SSE. Checkpoint tracking vẫn là authoritative cho service-to-service blocking reads.
- **[ADR-IAM-10: Session, Token, Refresh Token, Rotation & Revocation](/iam/ADR-IAM-10.md):** Áp dụng Token Rotation và Session Versioning (fid) với RT-hash, phát hiện reuse và revoke tức thì; sử dụng Redis projection cho blacklist `fid` và cung cấp endpoint authenticate checking (Có thể dùng forward auth ở gateway layer).

## 5. Mô hình tổng thể

- Các command service (idm-command, acm-command, ...) append event vào EventStoreDB.
- Projector service (idm-projection, acm-projection, ...) consume event, build read model, publish event qua RabbitMQ cho các BC khác.
- Các query service (idm-query, acm-query, ...) expose API truy vấn read model.
- Redis/Elasticsearch được dùng cho cache/indexing các read model hot path.
- Các thành phần hỗ trợ như Read Model, Write Model, Message Bus, Event Store DB được chia sẻ chung giữa các BC.

Tham kháo các tài liệu kiến trúc chi tiết cho từng sub domain:

- [Identity Management Architecture](./idm/idm-architecture.md)
- [Access Management Architecture](./acm/acm-architecture.md)
- [Authorization Management Architecture](./azm/azm-architecture.md)
- [Organization & Context Scoping Architecture](./ocs/ocs-architecture.md)

## 6. Domain Model

IAM được chia làm 4 domain sau:

1. **Identity Management (IDM):** Quản lý định danh người dùng, bao gồm đăng ký, đăng nhập, quản lý hồ sơ người dùng, và xác thực.
2. **Access Management (ACM):** Chịu trách nhiệm xác thực người dùng và quản lý phiên truy cập.
3. **Authorization Management: (AZM)** Chịu trách nhiệm định nghĩa và thực thi các quy tắc phân quyền.
4. **Organization & Context Scopinge (OCS):** Chịu trách nhiệm quản lý cấu trúc tổ chức, danh tính kỹ thuật product, tenant và ngữ cảnh truy cập. `User` được coi là một entity global (không scoped theo tenant). Tenancy được thực thi bằng cách ánh xạ (Enrollment) giữa `User` và `Tenant`/`Product` - OCS lưu giữ mapping này và chịu trách nhiệm cấp role/permission theo ngữ cảnh product/tenant.

[Tài liệu IAM domain model](./iam-domain-model.md)

### 6. Các chức năng đang xem xét phát triển trong tương lai

**Lưu ý:** Các chức năng này sẽ được phân bổ rõ ràng vào từng sub BC khi triển khai chi tiết.

- Hỗ trợ phân quyền tạm thời (temporary permission grants) với thời hạn xác định: Cho phép cấp quyền truy cập tạm thời cho người dùng hoặc dịch vụ trong một khoảng thời gian xác định, sau đó quyền này sẽ tự động hết hạn. Điều này hữu ích cho các tình huống như truy cập dự án ngắn hạn hoặc vai trò đặc biệt trong các sự kiện cụ thể (Ví dụ cho phép nhà phát triển truy cập vào môi trường production trong vòng 1 giờ để xử lý sự cố).
- Hỗ trợ xác thực đa yếu tố (Multi-Factor Authentication - MFA) nâng cao: Mở rộng hệ thống xác thực để hỗ trợ nhiều phương thức MFA khác nhau như sinh trắc học (vân tay, nhận diện khuôn mặt), thiết bị phần cứng (hardware tokens), và các ứng dụng xác thực di động. Cung cấp khả năng tùy chỉnh chính sách MFA dựa trên rủi ro và ngữ cảnh truy cập.
- Hỗ trợ chính sách kiểm soát truy cập dựa trên vai trò động (Dynamic Role-Based Access Control - DRBAC): Cho phép tạo và quản lý các vai trò động dựa trên các điều kiện cụ thể như thời gian trong ngày, vị trí địa lý, hoặc trạng thái hoạt động của người dùng. Điều này giúp tăng cường bảo mật và linh hoạt trong việc quản lý quyền truy cập.
