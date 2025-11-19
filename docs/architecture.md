# Architecture — Tổng quan Kiến trúc Hệ thống

Tài liệu này mô tả kiến trúc cấp cao (High-Level Architecture) và các quy tắc phụ thuộc cốt lõi mà tất cả các dự án trong Monorepo này phải tuân thủ. Nó đóng vai trò là "Hiến pháp" kỹ thuật, đảm bảo tính nhất quán, khả năng mở rộng và tối ưu hóa chi phí cho toàn bộ tổ chức.

## 1. Giới thiệu và Phạm vi

### 1.1. Mục tiêu và Động lực

Hệ thống được xây dựng theo mô hình **Centralized Platform** (Nền tảng tập trung), cung cấp các dịch vụ và hạ tầng dùng chung cho toàn bộ tổ chức. Mục tiêu không chỉ dừng lại ở việc quản lý định danh (IAM) mà mở rộng sang quản lý Tài nguyên, Giao tiếp và Hạ tầng cốt lõi.

Động lực chính của kiến trúc này bao gồm:

- **Lợi thế Kinh tế (Economy of Scale):**
  - **Chi phí Tài nguyên:** Tập trung hóa việc mua sắm dịch vụ bên thứ 3 (Email, SMS Brandname, Cloud Storage) để đạt được mức giá sỉ tốt hơn.
  - **Chi phí Hạ tầng:** Thay vì mỗi dự án chạy riêng lẻ một cụm Database/K8s (tốn kém tài nguyên dự phòng), toàn bộ hệ thống sử dụng các **Shared Clusters** lớn, tối ưu hóa hiệu suất sử dụng phần cứng.
- **Tối ưu Vận hành (Shared Operations):** Đội ngũ Platform Engineering/DevOps tập trung quản lý và giám sát các cụm hạ tầng chung. Các team sản phẩm (Product Teams) được giải phóng khỏi gánh nặng vận hành DB/Infra để tập trung hoàn toàn vào nghiệp vụ.
- **Tăng tốc độ phát triển (Time-to-market):** Cung cấp sẵn các khối xây dựng (Building Blocks) như Auth, Upload, Notification. Dev chỉ cần tích hợp, không cần xây dựng lại (Don't Reinvent the Wheel).
- **Bảo mật Nhất quán:** Áp dụng chính sách bảo mật tập trung tại Gateway và IAM, giảm thiểu rủi ro sai sót cấu hình phân tán.

### 1.2. Các Nguyên tắc Thiết kế Chính (Architectural Principles)

Kiến trúc của repo này tuần thủ theo **[C4A](c4a.md)** (Sự kế thừa từ Domain-Driven Design, Clean Architect và Monorepo với các quy tắc chi tiết hơn). **C4A là nền tảng cho kiến trúc của toàn bộ dự án này**

Mọi dịch vụ trong hệ thống phải tuân thủ các nguyên tắc sau:

- **CQRS (Command Query Responsibility Segregation):** Bắt buộc áp dụng cho bất kỳ dịch vụ nào có sự chênh lệch tải Đọc/Ghi hoặc logic phức tạp.
- **Event-Driven Architecture (EDA):** Giao tiếp mặc định là bất đồng bộ qua Message Broker để đảm bảo tính liên kết lỏng (Loosely Coupled).
- **Event Sourcing (ES) - Optional:** Cân nhắc sử dụng cho các Aggregate Root cần auditability hoặc khả năng tái tạo trạng thái (Rehydration).

## 2. Lựa chọn Công nghệ và Giải trình Kiến trúc

### 2.1. Stack Công nghệ Cốt lõi

| Lớp (Layer)           | Công nghệ            | Ghi chú                                                                           |
| :-------------------- | :------------------- | :-------------------------------------------------------------------------------- |
| **Backend Framework** | NestJS (Node.js)     | Framework chính, hỗ trợ Dependency Injection và Module hóa mạnh mẽ.               |
| **Language**          | TypeScript           | Bắt buộc cho toàn bộ Monorepo để đảm bảo tính nhất quán và Type-safety.           |
| **Write Database**    | Event Store DB       | DB chuyên dụng cho Event Sourcing (Lưu streams, snapshots).                       |
| **Read Database**     | PostgreSQL / MongoDB | PostgreSQL cho dữ liệu quan hệ (Projections). MongoDB cho Logs/Unstructured Data. |
| **Message Broker**    | RabbitMQ             | Xương sống cho giao tiếp Event-Driven.                                            |
| **Proxy / Gateway**   | Traefik / Nginx      | Ingress Controller, Load Balancer và SSL Termination.                             |

### 2.2. Chiến lược Hạ tầng Chia sẻ (Shared Infrastructure Strategy)

Để giải quyết bài toán kinh tế, các thành phần sau được triển khai dưới dạng **Multi-tenant Clusters**:

1.  **Centralized Databases (PostgreSQL, MongoDB, EventStoreDB):**
    - Được triển khai thành các cụm (Cluster) lớn, có HA (High Availability).
    - Các dịch vụ (Microservices) sử dụng chung cụm vật lý nhưng phân tách logic bằng `Database Name` hoặc `Schema`.
    - **Lợi ích:** Giảm chi phí license, giảm overhead quản lý, dễ dàng backup/restore tập trung.

2.  **Centralized Search & Event Bus (Elasticsearch, RabbitMQ):**
    - Chia sẻ cụm Elasticsearch cho Search và Logging.
    - Chia sẻ cụm RabbitMQ với phân quyền VHost cho từng Bounded Context.

3.  **Dedicated Cache (Redis):**
    - **Ngoại lệ:** Redis được khuyến nghị triển khai riêng (Dedicated) hoặc dạng Sidecar cho từng dịch vụ cần hiệu năng cao để tránh nghẽn cổ chai (Noisy Neighbor) và tối ưu độ trễ. Vì ở đây redis chỉ dùng làm cache chứ không phải lưu trữ lâu dài.

### 2.3. Ghi chép Quyết định Kiến trúc Toàn cục (Global ADRs)

**ADR-G1: Chiến lược Monorepo với Nx và DevContainers**

- **Vấn đề:** Monorepo thuần túy thường gặp 3 điểm yếu chí mạng:
  1.  **Build chậm:** Phải rebuild toàn bộ dự án dù chỉ sửa 1 dòng code.
  2.  **Dependency Hell:** Xung đột phiên bản thư viện giữa các dự án con.
  3.  **Setup phức tạp:** Dev mới mất nhiều ngày để cài đặt môi trường (Node, Docker, DBs, Tools) do hệ thống quá lớn.
- **Quyết định:** Sử dụng bộ ba **Monorepo + Nx + DevContainer**.
- **Giải pháp:**
  - **Nx (Smart Build System):** Giải quyết vấn đề hiệu năng. Nx xây dựng đồ thị phụ thuộc (Dependency Graph), chỉ chạy test/build cho các dự án bị ảnh hưởng (_Affected_) bởi thay đổi code. Kết quả build được cache (Computation Caching) để tái sử dụng tức thì.
  - **DevContainer (Standardized Environment):** Giải quyết vấn đề môi trường. Đóng gói toàn bộ toolchain (Node.js, Nx CLI, Git, Zsh, Docker-in-Docker) vào một container. Dev chỉ cần VS Code và Docker là có thể code ngay lập tức, đảm bảo "Works on my machine" nghĩa là "Works everywhere".
- **Hệ quả:** Biến Monorepo từ gánh nặng thành lợi thế cạnh tranh nhờ tốc độ CI/CD cao và trải nghiệm Developer (DX) mượt mà.

Chi tiết: [ADR-G1 — Monorepo với Nx và DevContainers](adr/ADR-G1.md)

**ADR-G2: Containerization & Kubernetes**

- **Quyết định:** Đóng gói bằng Docker. Vận hành Production trên Kubernetes (K8s).
- **Lý do:** Tận dụng khả năng orchestrate của K8s để quản lý các Shared Clusters và Microservices, đảm bảo Auto-scaling và Self-healing.
  Chi tiết: [ADR-G2 — Containerization and Kubernetes for Production](adr/ADR-G2.md)

**ADR-G3: Hạ tầng Nền tảng Chia sẻ (Shared Platform Infrastructure)**

- **Quyết định:** Cung cấp hạ tầng nền tảng dùng chung cho tất cả các dự án (cơ sở dữ liệu, event store, message broker, search, cache, observability) nhưng đảm bảo tách biệt dữ liệu theo service/bounded context (schema, index, stream namespace, vhost, v.v.).
- **Lý do:** Giảm chi phí hạ tầng và vận hành, đồng nhất trải nghiệm developer và cho phép Platform team vận hành tập trung; tách biệt dữ liệu per-service là đủ để hạn chế blast radius ở thời điểm hiện tại.

Chi tiết: [ADR-G3 — Hạ tầng Nền tảng Chia sẻ cho Tất cả Dự án](adr/ADR-G3.md)

**ADR-G4: Bảo mật S2S (Service-to-Service)**

- **Quyết định:** Sử dụng **S2S Tokens** (Client Credentials Flow) để xác thực nội bộ. Không sử dụng mTLS.
- **Lý do:** Giảm độ phức tạp vận hành (quản lý certificates). S2S Token kết hợp với Network Policies của K8s đủ đảm bảo an toàn và dễ dàng tích hợp với IAM.

Chi tiết: [ADR-G4 — Service-to-Service Authentication: S2S Tokens (Client Credentials)](adr/ADR-G4.md)

**ADR-G5: EventStoreDB thay vì PostgreSQL cho Event Sourcing**

- **Quyết định:** Sử dụng EventStoreDB làm kho lưu trữ sự kiện (Event Store) chính.
- **Lý do:**
  - Hỗ trợ native cho các khái niệm ES: Streams, Projections, Subscriptions.
  - Tính năng **Snapshotting** tích hợp mạnh mẽ, giúp giảm thời gian Rehydration của Aggregate mà không cần tự build logic phức tạp trên SQL.
  - Hiệu suất ghi (Append-only) vượt trội so với RDBMS truyền thống.

Chi tiết: [ADR-G5 — EventStoreDB cho Event Sourcing](adr/ADR-G5.md)

**ADR-G6: Áp dụng CQRS (Command Query Responsibility Segregation)**

- **Quyết định:** Áp dụng CQRS cho những bounded contexts có yêu cầu tách biệt ghi/đọc rõ rệt; áp dụng Event Sourcing cho các AR cần auditability hoặc rehydration.
- **Lý do:** Tối ưu hiệu năng đọc, hỗ trợ scale độc lập cho read/write, và cho phép replay/read-model rebuild khi cần.

Chi tiết: [ADR-G6 — Áp dụng CQRS (Command Query Responsibility Segregation)](adr/ADR-G6.md)

**ADR-G7: Áp dụng Event-Driven Architecture (EDA)**

- **Quyết định:** Sử dụng EDA làm cơ chế giao tiếp mặc định giữa bounded contexts khi phù hợp, với RabbitMQ làm message broker backbone, versioned events và DLQ/retry policies.
- **Lý do:** Tăng độ bền, tách rời producer/consumer, và hỗ trợ tích hợp bất đồng bộ giữa services.

Chi tiết: [ADR-G7 — Áp dụng Event-Driven Architecture (EDA)](adr/ADR-G7.md)

**ADR-G8: Sử dụng UUID v7 cho toàn hệ thống**

- **Quyết định:** Áp dụng UUID v7 làm định dạng ID tiêu chuẩn cho toàn hệ thống (aggregate IDs, resource IDs, v.v.).
- **Lý do:** UUID v7 cung cấp khả năng sắp xếp theo thời gian (time-ordered), cho phép sinh ID offline và giảm contention trong môi trường phân tán.

Chi tiết: [ADR-G8 — Sử dụng UUID v7 cho toàn hệ thống](adr/ADR-G8.md)

## 3. Cấu trúc Monorepo và Quy tắc Phụ thuộc

### 3.1. Cấu trúc Thư mục của Monorepo

Monorepo tổ chức thư mục phản ánh trực tiếp kiến trúc Hexagonal:

- `apps/`: **Application Bootstrap (Entry Points)**.
  - Chứa code khởi chạy, cấu hình DI Container, gắn kết các module.
  - Đặc điểm: Là các NestJS/NodeJS application.
- `domains`: **Tầng Domain (Core - Trái tim hệ thống)**.
  - Chứa: Entities, Aggregates, Value Objects, Domain Events, Domain Exceptions, Domain Services.
  - Đặc điểm: Thuần TypeScript, không phụ thuộc framework, không DB.
- `interactors`: **Tầng Application (Use Cases)**.
  - Chứa: Command Handlers, Query Handlers, Application Services.
  - Đặc điểm: Điều phối dòng chảy nghiệp vụ, thực thi logic của ứng dụng. Thường chia thành query-interactors và command-interactors để tuân thủ CQRS.
- `adapters`: **Tầng Infrastructure (Implementation)**.
  - Chứa: Repository Impl (EventStore, Postgres), External APIs (Mailgun, S3).
  - Đặc điểm: Phụ thuộc vào công nghệ cụ thể (NestJS, TypeORM, AWS SDK, RabbitMQ, EventStore Client...).
- `e2e/`: Các dự án kiểm thử end-to-end (E2E Tests) cho các ứng dụng trong `apps/`.
- `libs/`: Các các thư viện nội bộ (nội bộ trong monorepo này):
- `packages/`: Thư viện chia sẻ (Shared Libraries) độc lập, có thể publish npm.
- `tools/` & `infras/`: Công cụ DevOps và môi trường Local.
- `docs/`: Tài liệu dự án (ADR, hướng dẫn, kiến trúc, v.v.).

### 3.2. Quy tắc Phụ thuộc (Dependency Rules)

Các quy tắc phụ thuộc được mô tả rõ trong [C4A](c4a.md) là **Bất khả xâm phạm**. Mọi vi phạm sẽ bị CI/CD chặn lại (Ở local thông qua 'husky' pre-commit hook chạy eslint rules, và một lớp nữa thông qua github action).

Các quy tắc phụ thuộc toàn cục để đảm bảo tính nhất quán, tránh vòng phụ thuộc, và cho phép tự động kiểm tra qua CI.

- **Ranh giới dự án (Project Boundaries):** Mỗi project trong monorepo (`apps/*`, `libs/*`, `packages/*`, `domains/*`, `adapters`, `interactors`, `infras/*`...) phải khai báo metadata (`tags`, `implicitDependencies`) trong `project.json`/`workspace.json` để Nx có thể phân tích và áp dụng quy tắc.

  **Bắt buộc:** Mỗi `project.json` phải khai báo một `tags` có định dạng `type:<rootDir>` (ví dụ: a project under `packages/` phải có `type:packages`, under `libs/` phải có `type:libs`, v.v.). Các tag `scope:<context>` là tùy chọn nhưng khuyến nghị để áp dụng quy tắc theo Bounded Context.

- **Ràng buộc tag-based:** Sử dụng `tags` trên mỗi project (ví dụ: `type:domain`, `type:adapter`, `scope:iam`) và cấu hình quy tắc `@nrwl/nx/enforce-module-boundaries` (hoặc eslint plugin tương đương) để cấm import trái phép.
- **Không vòng lặp (No Cyclic Dependencies):** Tuyệt đối cấm vòng phụ thuộc giữa các project; dùng Nx graph và CI check để phát hiện tự động.

Những quy tắc này giúp chuyển các nguyên tắc DDD thành các luật có thể kiểm tra tự động trên toàn repository, giảm rủi ro kiến trúc khi repo mở rộng.

## 4. Development, Deployment & Observability

### 4.1 Tiêu chuẩn Đặt tên (Naming Convention)

**Quy ước đặt tên cho các khái niệm cốt lõi của DDD sẽ giảm nhầm lẫn và tăng tốc độ đọc hiểu mã.**

| Khái niệm (Concept)     | Quy tắc Đặt tên (Naming Rule)                                 | Ví dụ (Example)                                 |
| :---------------------- | :------------------------------------------------------------ | :---------------------------------------------- |
| **Aggregate Root (AR)** | Danh từ số ít (Singular Noun), hậu tố (`Entity`) là tùy chọn. | `User`, `Resource`                              |
| **Command**             | Động từ + Danh từ + `Command`                                 | `CreateUserCommand`, `ChangeQuotaCommand`       |
| **Event**               | Danh từ + Động từ (quá khứ) + `Event`                         | `UserCreatedEvent`, `QuotaChangedEvent`         |
| **Port (Interface)**    | Danh từ + `Port` / `Repository`                               | `UserRepository`, `EventStorePort`              |
| **Interactor/Use Case** | Động từ + Danh từ + `Interactor` / `UseCase`                  | `CreateUserInteractor`, `ResourceAccessUseCase` |

**Quy ước đặt tên cho hạ tầng (RabbitMQ / Elasticsearch / EventStore / PostgreSQL / MongoDB)**

Để đảm bảo tính nhất quán giữa các môi trường và dễ vận hành, các service phải tuân theo các quy ước đặt tên dưới đây. Luôn dùng chữ thường, chỉ gồm `[a-z0-9_-]` (gạch ngang hoặc gạch dưới), tránh ký tự đặc biệt và khoảng trắng. Nên giữ tên ngắn nhưng có ý nghĩa không quá 128 ký tự.

- Quy tắc chung:
  - Context / bounded context: ngắn gọn (ví dụ `iam`, `resource`, `notification`).
  - Service / aggregate / entity: tên biểu diễn rõ ràng (ví dụ `user`, `membership`, `service-definition`).
  - Phiên bản major khi cần: hậu tố `v1`, `v2` (chỉ cho index/alias hoặc stream templates).

- Elasticsearch index:
  - Pattern: `<context>-<entity>-v<major>`
  - Ví dụ: `prod-iam-users-v1`, `staging-resource-files-v1`
  - Ghi chú: luôn tạo alias không đổi cho truy xuất (ví dụ alias `iam-users` trỏ tới `prod-iam-users-v1`), giúp rollover và reindex không làm gián đoạn đọc.

- RabbitMQ exchange:
  - Pattern:
    - Exchanges:
      - Command (Direct): `<context>.commands`. Ví dụ: `iam.commands`
      - Event (Topic): `<context>.events`. Ví dụ: `iam.events`
      - Dead-letter: `<context>.dlx`. Ví dụ: `iam.dlx`
    - Queues:
      - Command queue: `<context>.<aggregate>.<command-queue>`. Ví dụ: `iam.user.create-queue`
      - Event queue: `<consumer-context>.<source-context>.<event-handler>`. Ví dụ: `notification.iam.user-created-handler`
    - Routing keys:
      - Command: `<aggregate>.<action>`. Ví dụ: `user.create`
      - Event: `<aggregate>.<action>.v<version>` hoặc `<aggregate>.<action>`. Ví dụ: `user.created.v1`, `user.deleted`

- EventStore stream (EventStoreDB):
  - Aggregate stream: `<context>-<aggregate>-<id>` (ví dụ `iam-user-3f2a1b...`)
  - Category stream (per-aggregate-type): `<context>-<aggregate>` (dùng cho subscription/consumer grouping)
  - Service-level stream (option): `<context>-all` để thu thập tất cả sự kiện của context khi cần.
  - Ví dụ: `iam-user-00000000-0000-0000-0000-000000000001`, category `iam-user`

- PostgreSQL (database / schema):
  - Database name pattern: `<context>-<flow-name>` → ví dụ `iam-read`, `iam-write`
  - Bảng/obj: dùng `snake_case` cho tên bảng và cột, ví dụ `users`, `memberships`, `service_definitions`
  - Ghi chú: mỗi bounded context có thể có nhiều DB (read/write/projector...) tùy theo CQRS.

- MongoDB (database / collection):
  - Database name pattern: `<context>-<flow-name>` → ví dụ `iam-read`, `iam-write`
  - Collection name pattern: `<entity>` (snake_case, plural or singular consistent) → ví dụ `file-metadatas`, `user-logs`
  - Ghi chú: collection nên đặt tên rõ ngữ nghĩa và kèm index/chunk key nếu sharding.

### 4.2. Môi trường phát triển (DevContainer)

- **Quyết định:** Sử dụng **DevContainers** làm môi trường phát triển tiêu chuẩn.
- **Lợi ích:**
  - **Onboarding tức thì:** Dev mới chỉ cần mở VS Code, không cần cài Node, Docker, Zsh thủ công.
  - **Môi trường nhất quán:** Loại bỏ lỗi "It works on my machine".
  - **Tooling tích hợp:** Tích hợp sẵn Zsh, Oh-my-zsh, Git plugins, Nx CLI, Linter, ...

### 4.3. CI/CD Tích hợp Nx

- **Nx Affected:** Pipeline chỉ chạy lint/test/build/e2e cho các dự án bị ảnh hưởng bởi commit và chia nhỏ trên từng dự án con để tăng tốc độ.
- **Automated Release:** Tự động versioning,tạo changelog dựa trên Conventional Commits và tạo PR để review trước khi release. Khi merge PR, tự động publish image lên Container Registry và npm package.

Xem chi tiết: [CI/CD Documentation](ci-cd.md)

### 4.4. Integration & E2E testing (Monorepo)

Để đảm bảo chất lượng tích hợp giữa các bounded context trong monorepo, hãy sử dụng các thư viện/chân cầu tích hợp đã có sẵn:

- `libs/integration-environment`: môi trường tích hợp dành riêng cho repo này — cung cấp helpers để dựng testcontainers, mocks và lifecycle cho integration tests.
- `packages/integration-hybridize`: thư viện chung dùng trong nhiều repo để dựng môi trường tích hợp (proxy, proxied-service patterns) — dùng khi muốn reuse patterns tổ chức.

Hướng dẫn chung:

- Viết unit test cho domain và interactor bằng `packages/domain` và `packages/interactor`.
- Viết integration tests (ứng dụng level) sử dụng `libs/integration-environment` để khởi tạo Postgres/Redis/RabbitMQ/MinIO trong testcontainers; dùng `packages/integration-hybridize` nếu cần mô phỏng external services hoặc proxy patterns.
- Viết E2E tests (ứng dụng chạy đầy đủ) trong `e2e/*` projects, dùng Nx affected để chạy chỉ các e2e liên quan. Khi chạy target e2e, nx sẽ tự động khởi động các infras và build docker image cho các apps được khai báo trong dependencies. (phải cấu hình implicit dependencies trong `project.json` với các infras/_ và các apps/_)

Ví dụ nhanh (philosophy):

- Unit: aggregate + command handler tests (fast, no containers).
- Integration: projector + DB + RabbitMQ (use `libs/integration-environment`).
- E2E: full stack containerized run (use Nx e2e projects).

### 4.5. Observability

- **Logging:** Tất cả dịch vụ log ra stdout theo chuẩn JSON.
- **Metrics:** Tất cả các dịch vụ cần expose metrics endpoint.
- **Tracing:** Sử dụng OpenTelemetry để trace request xuyên suốt hệ thống.

### 5. Các tiêu chuẩn chung

#### 5.1. Sử dụng các abstract class và interface chung

- Tất cả các dự án phải sử dụng các abstract class và interface được định nghĩa trong `packages/domain`, `packages/interactor`, `packages/adapter` để đảm bảo tính nhất quán và tái sử dụng mã nguồn.

#### 5.2 Tiêu chuẩn Ủy quyền S2S (Service-to-Service Authorization)

Tất cả các dịch vụ nội bộ khi gọi API của nhau phải tuân thủ quy trình ủy quyền sau để đảm bảo bảo mật và khả năng kiểm toán:

- **Cơ chế:** Sử dụng **OAuth 2.0 Client Credentials Flow** để nhận **S2S Token** từ IAM.
- **Actor:** Mỗi dịch vụ (Client) phải có một cặp `Client ID / Client Secret` duy nhất được đăng ký trong IAM.
- **Quy trình:** Dịch vụ Client phải đính kèm S2S Token này trong Header `Authorization: Bearer [Token]` khi gọi các dịch vụ khác. Dịch vụ nhận request phải xác thực Token để biết danh tính của dịch vụ gọi (ví dụ: `client_id: resource-command`) bằng khóa công khai (Public Key) của do IAM cung cấp.

#### 5.3. Tiêu chuẩn phần hổi

Tất cả các API phải trả về định dạng lỗi JSON thống nhất để đơn giản hóa việc tích hợp và gỡ lỗi. được định nghĩa thông qua `Success Response` và `Error Response` trong `packages/common` (cũng được chia sẻ với frontend và làm tiêu chuẩn chung cho tất cả cá dự án trong tổ chức)

#### 5.4. Tiêu chuẩn xử lý lỗi chung

Để đảm bảo tính nhất quán và dễ dàng xử lý lỗi:

- Tất cả các lớp domnain sẽ luôn sử dụng các custom exceptions kế thừa từ `DomainException` trong `packages/domain` .
- Tất cả các lớp interactor sẽ sử dụng các custom exceptions kế thừa từ `InteractorException` trong `packages/interactor`.
- Tất cả các lớp adapter và ứng dụng sẽ sử dụng các custom exceptions kế thừa từ `AdapterException` trong `packages/adapter`.
- Tất cả các lớp apps sẽ sử dụng các custom exceptions kế thừa từ `HttpException` và các predefined exceptions ví dụ như `NotFoundException` trong `packages/nestjs-helpers`.

Các lỗi sẽ được nổi lên qua các layer và được chuyển đổi thành các mã HTTP tương ứng trong lớp ứng dụng (apps).

| Mã HTTP (Status Code)        | Ý nghĩa (Meaning)                                                             | Ví dụ (Standard Error Body)                                                                     |
| :--------------------------- | :---------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------- |
| **400 Bad Request**          | Lỗi cú pháp yêu cầu.                                                          | `{"message": "PUT request is not allowed."}`                                                    |
| **401 Unauthorized**         | Token bị thiếu, hết hạn, hoặc không hợp lệ (cần Authenticate).                | `{ "message": "Token is expired or malformed."}`                                                |
| **403 Forbidden**            | Xác thực thành công nhưng không có quyền thực hiện hành động (cần Authorize). | `{"message": "User lacks 'resource:upload' permission."}`                                       |
| **422 Unprocessable Entity** | Lỗi validation                                                                | `{ "message": "Authenticate failed.", "details":{ "password": "Invalid password."}}`            |
| **429 Too Many Requests**    | Quá nhiều yêu cầu trong một khoảng thời gian nhất định.                       | `{"message": "Too many requests. Please try again later."}`                                     |
| **500 Internal Error**       | Lỗi không mong muốn phía máy chủ (Internal Server Error).                     | _Nên trả về lỗi chung và log chi tiết._                                                         |
| **503 Service Unavailable**  | Dịch vụ tạm thời không khả dụng (bảo trì, quá tải).                           | Được mô tả chi tiết và đóng gói trong thư viện `packages/nestjs-helpers`. với HealthCheckModule |

#### 5.5. Tiêu chuẩn health check

Tất cả các apps phải implement health check endpoint theo chuẩn `/health/liveness` và `/health/readiness` sử dụng `HealthCheckModule` từ `packages/nestjs-helpers` để đảm bảo tính nhất quán và dễ dàng tích hợp với hệ thống giám sát.
Endpoint `/health/readiness` phải kiểm tra các thành phần quan trọng như kết nối cơ sở dữ liệu, message broker, v.v., và trả về mã HTTP 200 nếu tất cả đều ổn định, hoặc mã HTTP 503 nếu có thành phần nào không ổn định để cách ly dịch vụ khỏi nhận lưu lượng.

## 6. Danh mục Bounded Contexts

| Tên Context                                                    | Mã             | Vai trò Chính                                                      |
| :------------------------------------------------------------- | :------------- | :----------------------------------------------------------------- |
| [**Identity & Access Management**](iam/iam-architecture.md)    | `iam`          | Quản lý định danh, xác thực, phân quyền (CQRS/ES).                 |
| [**Resource Management**](resource/rm-architecture.md)         | `resource`     | Quản lý file, ảnh, CDN, virus scanning tập trung.                  |
| [**Notification Management**](notification/nm-architecture.md) | `notification` | Hub gửi tin đa kênh (Email, SMS, Push), quản lý template và quota. |
| [**Mailer Management**](mailer/mailer-architecture.md)         | `mailer`       | Quản lý việc gửi email, các cấu hình gửi email                     |
| [**Pusher Management**](pusher/pusher-architecture.md)         | `pusher`       | Quản lý việc gửi push notification và các cấu hình liên quan       |
