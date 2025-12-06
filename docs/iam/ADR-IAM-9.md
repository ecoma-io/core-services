# ADR-IAM-9 — Cơ chế Read Your Own Writes - RYOW

## 1. Bối cảnh

Trong kiến trúc CQRS với eventual consistency, có độ trễ tự nhiên giữa khi Command được xử lý (Write Side) và khi Read Model được cập nhật (Read Side thông qua Projectors). Điều này dẫn đến tình huống user thực hiện một hành động (ví dụ: tạo Role) nhưng ngay lập tức query lại không thấy kết quả.

Vấn đề này đặc biệt nghiêm trọng với IAM vì:

- User expect thấy thay đổi ngay lập tức sau khi thực hiện action (UX requirement)
- Các service khác có thể query quyền ngay sau khi assign role (functional requirement)
- Testing và debugging khó khăn khi không có consistency guarantee

## 2. Quyết định

Implement cơ chế **Read Your Own Writes (RYOW)** kết hợp hai thành phần rõ ràng:

- `checkpoint tracking` để phục vụ các `service-to-service` blocking reads (đảm bảo consistency guarantee bằng cách cho phép caller chờ đến khi `projection` đạt `checkpoint` của command).
- `Server Sent Events (SSE)` như một cơ chế bổ sung cho interactive clients (browser / UI) để cải thiện UX bằng cách push cập nhật khi `projection` đạt checkpoint tương ứng.

Ghi chú: `SSE` được chọn làm cơ chế push unidirectional (không dùng WebSocket cho trường hợp này). `Checkpoint tracking` vẫn là nền tảng cho mọi guarantee giữa services.

## 3. Lý Do

- Đảm bảo UX tốt hơn khi user thấy thay đổi ngay sau khi thực hiện action (khi cần, SSE sẽ push cập nhật cho interactive clients).
- Cho phép các `service consumer` có `guarantee` về consistency khi cần bằng `checkpoint tracking` và blocking read (caller có thể yêu cầu read chặn đến checkpoint của command).
- Vẫn đơn giản hơn các giải pháp phức tạp như `synchronous projections` hoặc các hệ thống notification stateful/phức tạp (ví dụ: notification brokers đa-tenant với replay/state management). `SSE + checkpoint tracking` là một phương án nhẹ hơn so với triển khai một notification system đầy đủ.

## 4. Hệ quả

### Tích cực

- Giải quyết được vấn đề UX khi user expect thấy thay đổi ngay lập tức
- Cho phép các service consumer có guarantee về consistency khi cần

### Tiêu cực

- Tăng latency cho Read API khi có lag (đặc biệt với các `service-to-service` blocking reads nếu caller chọn chờ).
- Cần maintain `checkpoint table` đồng bộ với `projector` progress.
- Nếu dùng polling cho một số flows (ví dụ service không hỗ trợ blocking read), polling queries sẽ làm tăng database load khi timeout ngắn.
- Chi phí của `SSE`: tăng số kết nối dài hạn tới server, cần cơ chế quản lý kết nối/reconnect, proxy/nginx phải hỗ trợ proxying SSE; cần tính toán về scalability của endpoint SSE.
- Edge case: nếu `projector` bị stuck, các blocking read sẽ timeout và SSE sẽ không nhận được cập nhật — cần cơ chế fallback/alerting.

## 5. Các lựa chọn đã xem xét

- **Synchronous Projections:**
  - _Lý do từ chối:_ Mất đi lợi ích của CQRS về tách biệt và scalability. Command handler phải đợi projection hoàn thành.

- **WebSocket / SSE:**
  - _Đánh giá:_ WebSocket (bidirectional) bị từ chối cho trường hợp này vì độ phức tạp và overhead vận hành.
  - _Quyết định về SSE:_ `SSE` (unidirectional) được chấp nhận như một cơ chế bổ sung cho interactive clients để cải thiện UX, nhưng **không** được coi là phương án thay thế cho `checkpoint tracking` trong các guarantee service-to-service. Cần nêu rõ rằng SSE là endpoint bổ sung (subscription endpoint) bên cạnh RESTful read endpoints; các proxy/infra phải hỗ trợ SSE.

- **Client-side retry logic:**
  - _Lý do từ chối:_ Đẩy complexity sang client, khó maintain và inconsistent behavior giữa các clients.

- **Không giải quyết, chấp nhận eventual consistency:**
  - _Lý do từ chối:_ UX không chấp nhận được cho IAM service. User expect thấy role ngay sau khi assign.
