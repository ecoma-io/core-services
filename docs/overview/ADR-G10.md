# ADR-G10 — Sử dụng UUID v7 cho toàn hệ thống

## 1. Bối cảnh

Hệ thống gồm nhiều bounded context, microservice và các thành phần phân tán cần tạo định danh toàn cục (ID) theo cách an toàn, không xung đột và có khả năng sắp xếp theo thời gian để tối ưu chỉ mục và truy vấn theo thứ tự chèn.

Yêu cầu chính cho định danh:

- Có thể tạo offline (không cần round-trip tới DB/coordination service).
- Hạn chế xung đột (collision) trong môi trường phân tán.
- Hữu ích cho sắp xếp theo thời gian (time-ordered) để cải thiện locality trên index/partition.
- Dễ dàng lưu trữ và tương thích với các DB phổ biến (Postgres, MongoDB, EventStoreDB).

## 2. Quyết định

Áp dụng UUID v7 làm định dạng ID tiêu chuẩn cho toàn hệ thống (aggregate IDs, resource IDs, traceable entity IDs, v.v.).

Quy ước triển khai:

- Thiết kế tất cả service mới sinh ID theo chuẩn UUID v7 (canonical lower-case, với dấu gạch ngang).
- Lưu các giá trị UUID v7 trong DB ở kiểu `UUID` khi DB hỗ trợ (Postgres), hoặc dưới dạng chuỗi nếu không hỗ trợ.
- Các stream, queue, và tên tài nguyên có thể bao gồm UUID v7 theo quy ước đặt tên đã có (ví dụ: `iam-user-<uuid>`), tuân thủ pattern ký tự `[a-z0-9_-]` khi cần (encode/narrowing nếu cần để phù hợp với naming policy).
- Khuyến nghị sử dụng thư viện đã được community kiểm chứng để sinh UUID v7 và đảm bảo canonicalization (định dạng cố định) trên mọi ngôn ngữ nền tảng.
- Ngoại lệ: khi tích hợp với hệ thống bên ngoài yêu cầu định dạng khác, giữ tương thích hai chiều và document rõ ràng.

## 3. Lý do

- **Time-ordered IDs:** UUID v7 được thiết kế để hỗ trợ sắp xếp theo thời gian, giúp cải thiện hiệu suất khi chèn và truy vấn dữ liệu theo thứ tự thời gian.
- **Offline generation:** UUID v7 có thể được sinh mà không cần coordination giữa các node, giảm độ trễ và phụ thuộc vào hệ thống bên ngoài.
- **Giảm contention:** so với các hệ thống sinh ID dựa trên sequence, UUID v7 giảm nguy cơ xung đột khi scale ghi phân tán.
- **Tương thích rộng rãi:** UUID là chuẩn phổ biến, được hỗ trợ rộng rãi trong các DB và message broker hiện nay.
- **Dễ dàng triển khai:** nhiều thư viện đã hỗ trợ UUID v7 trên các ngôn ngữ phổ biến, giúp việc tích hợp trở nên đơn giản.
- **Chuẩn mở:** UUID v7 là một phần của chuẩn UUID mở, giúp tránh bị lock-in vào các giải pháp độc quyền.

## 4. Hệ quả

### Tích cực

- Time-ordered: UUID v7 cung cấp khả năng sắp xếp theo thời gian (improves index locality), giúp tối ưu hiệu suất khi chèn/scan theo thứ tự thời gian.
- Offline generation: dịch vụ và client có thể sinh ID mà không cần coordination, giảm độ trễ và phụ thuộc vào DB.
- Giảm contention: so với sequence-based IDs, UUID v7 giảm điểm nghẽn khi scale ghi phân tán.
- Dễ migrate: UUID là chuẩn phổ biến, dễ lưu trữ trong đa số DB và message broker.

### Tiêu cực / Rủi ro

- Phơi bày thời điểm tạo: UUID v7 chứa một thành phần thời gian (timestamp) — có thể gây lo ngại về riêng tư/tiết lộ thời điểm; cần đánh giá nếu đó là vấn đề cho dữ liệu nhạy cảm.
- Hỗ trợ thư viện: một số ngôn ngữ/driver cũ có thể chưa hỗ trợ native UUID v7; cần chọn thư viện phù hợp hoặc áp dụng shim.
- Kích thước: UUID (128-bit) lớn hơn các sequence/snowflake tùy chọn, có thể tác động nhẹ tới kích thước index / network payload khi dùng hàng loạt.

## 5. Các lựa chọn đã xem xét

- UUID v4 (random): dễ triển khai và phổ biến nhưng không hỗ trợ sắp xếp theo thời gian, làm giảm locality cho các truy vấn theo thứ tự chèn. _Lý do từ chối:_ thiếu time-ordering.
- ULID: cung cấp tính sortable và generation offline; tuy nhiên là base32 string (khác format UUID chuẩn) và chưa tương thích hoàn toàn với các cột `UUID` native trong DB. _Lý do từ chối:_ khác biệt format so với tiêu chuẩn UUID, sẽ gây thêm mapping và chi phí chuyển đổi.
- Snowflake / KSUID: tốt cho tính thời gian và phân tán nhưng yêu cầu coordinator hoặc thuật toán sinh có state/structure riêng, gây phức tạp khi muốn nhất quán trên mọi ngôn ngữ. _Lý do từ chối:_ thêm operational burden và không phải là format UUID chuẩn.
- Database sequences (serial/identity): đơn giản nhưng gây điểm nghẽn khi scale ghi cao và không phù hợp cho generation offline. _Lý do từ chối:_ không đáp ứng yêu cầu offline generation và phân tán.
