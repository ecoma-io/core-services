# ADR-G7 — Áp dụng Event-Driven Architecture (EDA)

## 1. Bối cảnh

Hệ thống gồm nhiều bounded contexts cần giao tiếp lỏng và chịu lỗi, cùng nhu cầu tích hợp bất đồng bộ (notifications, projections, cross-service coordination). Kiến trúc đồng bộ (HTTP only) gây tight coupling và làm giảm khả năng mở rộng.

## 2. Quyết định

Áp dụng **Event-Driven Architecture (EDA)** làm giao thức giao tiếp mặc định giữa bounded contexts khi phù hợp. Nguyên tắc chính:

- Dùng Message Broker (RabbitMQ) làm backbone cho asynchronous messaging; phân quyền theo VHost cho từng bounded context.
- Events là nguồn thông tin sự kiện (facts) và phải versioned (schema evolution + upcasters) để hỗ trợ tiến hóa.
- Thiết kế exchanges/routing keys theo domain-driven naming (e.g., `iam.user.created`, `resource.file.uploaded`).
- Thiết lập cơ chế retry và DLQ (dead-letter queue) cho các trường hợp xử lý thất bại; logging/alerting cho các sự kiện chuyển vào DLQ.
- Event consumers phải idempotent; projector phải lưu checkpoint per-stream để hỗ trợ replay và đảm bảo RYOW semantics khi cần.

## 3. Lý do

- Giảm tight coupling giữa services, tăng tính bền vững và khả năng mở rộng.
- Hỗ trợ tích hợp dễ dàng với external systems và các luồng công việc bất đồng bộ.
- Cho phép xử lý đột biến (spikes) và tải cao thông qua buffering.
- Cung cấp khả năng audit và replay events để tái tạo trạng thái hoặc debug issues.

## 4. Hệ quả

### Tích cực

- Tăng tính bền vững và khả năng mở rộng: producer/consumer tách rời về thời gian sống.
- Hỗ trợ tích hợp dễ dàng giữa các services và external systems.

### Tiêu cực

- Phức tạp hơn trong thiết kế messaging topology và observability.
- Cần vận hành các thành phần trung gian (broker), quản lý schema, và công cụ replay/upcast.

## 5. Các lựa chọn đã xem xét

- **Chỉ dùng HTTP event callbacks/webhooks:** Đơn giản nhưng thiếu độ bền và khó mở rộng.
  - _Lý do từ chối:_ Không phù hợp cho các luồng cần guarantee delivery hoặc xử lý đột biến.
- **Sử dụng Kafka thay vì RabbitMQ:** Kafka phù hợp với streaming lớn, retention và reprocessing mạnh.
  - _Lý do từ chối:_ RabbitMQ được chọn vì tính routing linh hoạt, hỗ trợ vhost/quyền theo bounded context và hoạt động tốt với các requirement hiện tại; Kafka có thể được cân nhắc cho workloads streaming rất lớn.
