# ADR-IAM-3 — Cơ chế xử lý Lỗi Sự kiện và Tái Phát (Event Handling & Replay)

## 1. Bối cảnh

Trong hệ thống Event Sourcing, việc xử lý lỗi và khả năng replay events là quan trọng để đảm bảo:

- **Reliability:** Hệ thống có khả năng phục hồi từ lỗi tạm thời (transient errors)
- **Maintainability:** Có thể sửa lỗi logic trong Projector và rebuild Read Models
- **Evolvability:** Hỗ trợ thay đổi schema của events khi hệ thống phát triển
- **Auditability:** Đảm bảo không mất events và có thể trace được lỗi

Các loại lỗi cần xử lý:

1. **Transient errors:** Network timeout, temporary DB unavailability
2. **Logic errors:** Bug trong Projector code
3. **Schema evolution:** Event structure thay đổi qua các versions
4. **Poison messages:** Events không thể xử lý được (malformed, corrupt)

## 2. Quyết định

Implement chiến lược xử lý lỗi 3 tầng: Retry, Dead Letter Queue và Replay Mechanism.

## 3. Lý Do

- **Retry mechanism:** Giúp tự động xử lý transient errors mà không cần can thiệp thủ công, giảm downtime.
- **Dead Letter Queue (DLQ):** Cung cấp nơi lưu trữ các events không thể xử lý được sau nhiều lần retry, giúp visibility và phân tích lỗi.
- **Upcasting:** Cho phép thay đổi schema của events mà không làm gián đoạn hệ thống, hỗ trợ evolvability.
- **Replay mechanism:** Cho phép rebuild Read Models khi có logic errors hoặc schema changes, đảm bảo maintainability và auditability.

## 4. Hệ quả

### Tích cực

- **Resilience:** Tự động phục hồi từ transient errors
- **Visibility:** DLQ cung cấp visibility vào events failed
- **Evolvability:** Upcasting cho phép thay đổi event schema an toàn
- **Recoverability:** Full replay cho phép sửa logic errors và rebuild
- **Audit trail:** Không mất events, tất cả được preserve

### Tiêu cực

- **Complexity:** Cần implement và maintain upcaster registry
- **Ops overhead:** Cần monitoring và alerting cho DLQ
- **Downtime cho replay:** Read Model unavailable trong quá trình rebuild
- **Storage:** Cần lưu trữ events failed trong DLQ
- **Testing:** Cần test scenarios cho retry, DLQ và upcasting

## 5. Các lựa chọn đã xem xét

- **Chỉ dùng retry không có DLQ:**
  - _Lý do từ chối:_ Events failed vĩnh viễn sẽ block queue. Không có visibility vào failures.

- **Synchronous error handling:**
  - _Lý do từ chối:_ Command handler phải đợi projection success, mất lợi ích của async processing.

- **Không có upcasting, breaking changes require full migration:**
  - _Lý do từ chối:_ Không linh hoạt, mỗi breaking change cần downtime để migrate toàn bộ event store.

- **Schema registry (như Confluent Schema Registry):**
  - _Lý do từ chối:_ Overkill cho quy mô hiện tại. Upcaster pattern đơn giản và đủ dùng. Có thể consider sau nếu số lượng event types và versions tăng đáng kể.
