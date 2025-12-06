# ADR-G6 — Áp dụng CQRS (Command Query Responsibility Segregation)

## 1. Bối cảnh

Một số dịch vụ trong hệ thống (ví dụ: IAM, Resource) có mẫu truy vấn và ghi khác biệt rõ rệt: lưu lượng đọc lớn hơn nhiều so với lưu lượng ghi, hoặc các yêu cầu truy vấn phức tạp (full-text, aggregated views). Cần một mô hình để tối ưu cả hiệu năng đọc và độ phức tạp nghiệp vụ ghi.

## 2. Quyết định

Áp dụng **CQRS** cho những bounded contexts có nhu cầu tách biệt rõ ràng giữa luồng ghi và luồng đọc. Quy tắc áp dụng:

- Sử dụng mô hình Write Model (Commands, Aggregates, Event Sourcing khi cần) để xử lý các thay đổi trạng thái có tính phức tạp và concurrency-control.
- Xây dựng Read Model (projections) tối ưu hoá cho truy vấn: có thể là PostgreSQL, MongoDB hoặc Elasticsearch tuỳ mục đích.
- Projectors/Workers cập nhật Read Models từ events; checkpoints phải được lưu để hỗ trợ replay và RYOW (Read-Your-Own-Writes) patterns.
- Việc lựa chọn Event Sourcing là tuỳ ngữ cảnh: sử dụng Event Store DB cho các AR cần auditability và rehydration; các service nhỏ có thể dùng transactional writes vào RDBMS + event outbox.
- Mọi projector phải idempotent và cập nhật checkpoint trong cùng transaction với cập nhật Read Model khi khả dĩ.

## 3. Lý do

- Tối ưu hiệu năng đọc cho các use-case có tải đọc cao hoặc truy vấn phức tạp.
- Giảm độ phức tạp của mô hình ghi bằng cách tách biệt trách nhiệm.
- Hỗ trợ các mô hình lưu trữ khác nhau cho Read/Write sides, tận dụng các công nghệ phù hợp.
- Tăng khả năng mở rộng và bảo trì hệ thống.

## 4. Hệ quả

### Tích cực

- Tối ưu hiệu năng đọc bằng Read Models được thiết kế riêng.
- Cho phép scale độc lập giữa Read/Write sides.
- Hỗ trợ auditability và replay khi dùng Event Sourcing.

### Tiêu cực

- Phức tạp vận hành hơn (consistency, eventual consistency, replay tools).
- Cần cơ chế checkpoint, snapshot, và hướng dẫn vận hành rõ ràng.

## 5. Các lựa chọn đã xem xét

- **Không tách CQRS (single model):** Đơn giản nhưng sẽ gặp giới hạn khi tải đọc tăng cao.
  - _Lý do từ chối:_ Không đáp ứng tốt các use-case có truy vấn phức tạp hoặc tải đọc lớn.
- **Bắt buộc Event Sourcing cho mọi AR:** Mang lại auditability nhưng chi phí duy trì cao.
  - _Lý do từ chối:_ Chỉ áp dụng Event Sourcing cho AR cần audit/history hoặc có logic phức tạp.

_Ghi chú:_ Các chi tiết triển khai (snapshot policy, RYOW polling rules, checkpoint schema) được định nghĩa per-bounded-context; xem ví dụ tại `docs/iam/architecture.md`.
