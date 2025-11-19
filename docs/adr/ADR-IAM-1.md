# ADR-IAM-1 — Lựa chọn Công nghệ (Technology Stack)

## 1. Bối cảnh

IAM Service là một bounded context quan trọng chịu trách nhiệm quản lý vòng đời định danh, xác thực và phân quyền cho toàn bộ hệ thống. Dịch vụ cần đáp ứng các yêu cầu về hiệu năng cao, khả năng mở rộng, audit trail hoàn chỉnh và tuân thủ kiến trúc DDD/CQRS/Event Sourcing đã được định nghĩa trong kiến trúc tổng thể.

Các yêu cầu kỹ thuật chính:

- Hỗ trợ Event Sourcing với khả năng replay và audit trail đầy đủ
- Tách biệt rõ ràng giữa Write Model và Read Model (CQRS)
- Hiệu năng đọc cao với khả năng tìm kiếm full-text
- Cache hiệu quả cho dữ liệu "nóng" (permissions, sessions)
- Giao tiếp bất đồng bộ giữa các thành phần
- Nhất quán với công nghệ đã chọn ở cấp độ tổng thể (TypeScript, NestJS)

## 2. Quyết định

Áp dụng stack công nghệ sau cho IAM bounded context:

| Thành phần          | Công nghệ      | Vai trò                                                   |
| ------------------- | -------------- | --------------------------------------------------------- |
| Framework           | NestJS         | Framework chính cho cả Command và Query services          |
| Write Model         | Event Store DB | Lưu trữ event streams, source of truth cho Event Sourcing |
| Read Model (Data)   | PostgreSQL     | Lưu trữ read models có cấu trúc (Users, Tenants, Roles)   |
| Read Model (Search) | Elasticsearch  | Phục vụ full-text search cho Users và Tenants             |
| Read Model (Cache)  | Redis          | Cache permissions đã resolve, sessions, config nóng       |
| Message Bus         | RabbitMQ       | Giao tiếp bất đồng bộ giữa Write Side và Projectors       |

## 3. Hệ quả

### Tích cực

- **Event Store DB** cung cấp hỗ trợ native cho Event Sourcing với optimistic concurrency, subscriptions và projections tích hợp.
- **PostgreSQL** đảm bảo ACID và khả năng join phức tạp cho Read Models quan hệ.
- **Elasticsearch** cung cấp khả năng tìm kiếm mạnh mẽ với full-text và fuzzy matching.
- **Redis** giảm tải đáng kể cho các truy vấn quyền phức tạp thông qua caching.
- **RabbitMQ** đảm bảo delivery của events với durability và khả năng routing linh hoạt.
- **NestJS** cung cấp các building blocks tốt cho DDD/CQRS với Dependency Injection mạnh mẽ.

### Tiêu cực

- Tăng độ phức tạp vận hành do phải quản lý nhiều loại database.
- Cần đảm bảo eventual consistency giữa Write và Read sides.
- Chi phí học tập cho team với Event Store DB nếu chưa quen.
- Cần chiến lược backup/restore cho nhiều nguồn dữ liệu khác nhau.

## 4. Các lựa chọn đã xem xét

- **PostgreSQL cho cả Write và Read Model:**
  - _Lý do từ chối:_ Không tối ưu cho Event Sourcing, thiếu các tính năng native như stream subscriptions và projections. Phải tự implement nhiều logic phức tạp.

- **MongoDB cho Write Model:**
  - _Lý do từ chối:_ Thiếu khả năng optimistic concurrency mạnh mẽ như Event Store DB. Không được thiết kế đặc thù cho Event Sourcing.

- **Kafka thay vì RabbitMQ:**
  - _Lý do từ chối:_ Overkill cho use case hiện tại. Kafka phù hợp hơn cho event streaming lớn. RabbitMQ đơn giản hơn và đủ cho pattern pub/sub của chúng ta.

- **Không dùng Elasticsearch:**
  - _Lý do từ chối:_ PostgreSQL full-text search không đủ mạnh cho fuzzy matching và complex queries. Elasticsearch cung cấp trải nghiệm tìm kiếm tốt hơn nhiều.
