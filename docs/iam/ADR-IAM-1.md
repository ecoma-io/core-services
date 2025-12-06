# ADR-IAM-1 — Lựa chọn Công nghệ (Technology Stack)

## 1. Bối cảnh

IAM Service là một bounded context chịu trách nhiệm quản lý vòng đời định danh, xác thực và phân quyền cho toàn bộ hệ thống. Dịch vụ phải đáp ứng các yêu cầu về hiệu năng, khả năng mở rộng, audit trail đầy đủ và tuân thủ các nguyên tắc DDD/CQRS/Event Sourcing đã định nghĩa trong kiến trúc tổng thể.

Các yêu cầu kỹ thuật chính:

- Hỗ trợ Event Sourcing với khả năng replay và audit trail đầy đủ
- Tách biệt rõ ràng giữa Write Model và Read Model (CQRS)
- Hiệu năng đọc cao với khả năng tìm kiếm full-text và fuzzy matching
- Cache hiệu quả cho dữ liệu "nóng" (permissions, sessions)
- Giao tiếp bất đồng bộ giữa các thành phần
- Nhất quán với công nghệ đã chọn ở cấp độ tổng thể (TypeScript, NestJS)

## 2. Quyết định

Quyết định áp dụng stack công nghệ sau cho IAM bounded context:

| Thành phần          | Công nghệ         | Vai trò                                                   |
| ------------------- | ----------------- | --------------------------------------------------------- |
| Language/Framework  | TypeScript/NestJS | Framework chính cho cả Command và Query services          |
| Write Model         | Event Store DB    | Lưu trữ event streams, source of truth cho Event Sourcing |
| Read Model (Data)   | PostgreSQL        | Lưu trữ read models có cấu trúc (Users, Tenants, Roles)   |
| Read Model (Search) | Elasticsearch     | Phục vụ full-text search cho Users và Tenants             |
| Read Model (Cache)  | Redis             | Cache permissions đã resolve, sessions, config nóng       |
| Message Bus         | RabbitMQ          | Giao tiếp bất đồng bộ giữa Write Side và Projectors       |

## 3. Lý Do

Giải thích ngắn gọn lý do chọn từng thành phần chính:

- Event Store DB: được thiết kế riêng cho Event Sourcing, cung cấp optimistic concurrency, append-only streams, subscriptions và khả năng replay, giúp giảm khối lượng code custom và rủi ro vận hành so với tự triển khai trên RDBMS.
- PostgreSQL: đảm bảo tính ACID cho read models quan hệ, dễ dùng cho các truy vấn join phức tạp và backup/restore, phù hợp làm bản sao đọc có cấu trúc cho Users/Tenants/Roles.
- Elasticsearch: tối ưu cho full-text search, fuzzy matching và các truy vấn tìm kiếm phức tạp — những tính năng mà PostgreSQL full-text không thể cạnh tranh về hiệu năng và trải nghiệm người dùng.
- Redis: cache in-memory cho permissions/session giúp giảm độ trễ và tải lên hệ thống đọc chính; phù hợp cho dữ liệu "nóng" cần truy cập nhanh.
- RabbitMQ: message broker nhẹ, dễ cấu hình cho mô hình pub/sub và đảm bảo delivery với routing linh hoạt; phù hợp cho việc truyền events tới projector/consumers.
- NestJS: phù hợp với hệ sinh thái TypeScript, hỗ trợ DI, modular architecture và dễ tích hợp các patterns DDD/CQRS trong codebase hiện tại.

## 4. Hệ quả

### Tích cực

- Event Store DB cung cấp hỗ trợ native cho Event Sourcing với optimistic concurrency, subscriptions và projections tích hợp.
- PostgreSQL đảm bảo ACID và khả năng join phức tạp cho Read Models quan hệ.
- Elasticsearch cung cấp khả năng tìm kiếm mạnh mẽ với full-text và fuzzy matching.
- Redis giảm tải đáng kể cho các truy vấn quyền phức tạp thông qua caching.
- RabbitMQ đảm bảo delivery của events với durability và khả năng routing linh hoạt.
- NestJS cung cấp các building blocks tốt cho DDD/CQRS với Dependency Injection mạnh mẽ.

### Tiêu cực

- Tăng độ phức tạp vận hành do phải quản lý nhiều loại database và hệ thống (Event Store DB, PostgreSQL, Elasticsearch, Redis, RabbitMQ).
- Cần đảm bảo eventual consistency giữa Write và Read sides; thiết kế projector và strategy replay phải rõ ràng.
- Chi phí học tập cho team với Event Store DB và Elasticsearch nếu chưa quen.
- Cần chiến lược backup/restore và DR cho nhiều nguồn dữ liệu khác nhau.

## 5. Các lựa chọn đã xem xét

- PostgreSQL cho cả Write và Read Model:
  - Lý do xem xét: giảm số lượng hệ thống, sử dụng một công nghệ quen thuộc.
  - Lý do từ chối: không tối ưu cho Event Sourcing, thiếu các tính năng native như stream subscriptions và projections; sẽ phải tự triển khai nhiều logic phức tạp.

- MongoDB cho Write Model:
  - Lý do xem xét: mô hình document linh hoạt cho event storage.
  - Lý do từ chối: thiếu khả năng optimistic concurrency mạnh mẽ và các tính năng chuyên dụng cho Event Sourcing so với Event Store DB.

- Kafka thay vì RabbitMQ:
  - Lý do xem xét: mạnh cho event streaming lớn, retention và partitioning.
  - Lý do từ chối: overkill cho use case hiện tại; vận hành phức tạp hơn; RabbitMQ đơn giản hơn và đủ cho pattern pub/sub của chúng ta.

- Không dùng Elasticsearch:
  - Lý do xem xét: giảm bớt một hệ thống vận hành.
  - Lý do từ chối: PostgreSQL full-text search không đủ mạnh cho fuzzy matching và complex queries; Elasticsearch cung cấp trải nghiệm tìm kiếm tốt hơn nhiều.
