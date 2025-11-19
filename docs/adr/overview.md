# Architectural Decision Records (ADR)

ADR là tài liệu dùng để ghi lại các quyết định kiến trúc quan trọng, có thể rà soát, cho toàn bộ monorepo.

Mục đích

- Ghi lại lý do, các phương án đã cân nhắc và hậu quả của các quyết định kiến trúc.
- Làm cho các quyết định dễ tìm, ổn định và có thể tra cứu cho việc audit hoặc tham khảo sau này.

Đặt tên & Phạm vi

- Quyết định toàn cục (cross-cutting): `ADR-G<n>.md` (ví dụ `ADR-G1.md`). Sử dụng số `G` tiếp theo còn trống cho các quyết định toàn cục mới.
- Quyết định theo ngữ cảnh (bounded context): `ADR-<context>-<n>.md` hoặc tên rõ ràng có chứa context (ví dụ `ADR-iam-1.md`).

Cấu trúc ADR bắt buộc (mẫu đề xuất)

- `# [ID] - Tiêu đề`
- `1. Bối cảnh` — mô tả ngắn gọn bối cảnh và khi nào ADR này áp dụng
- `2. Quyết định` — lựa chọn đã được chọn (ngắn gọn)
- `3. Hệ quả` — kết quả tích cực và tiêu cực của quyết định
- `4. Các phương án đã xem xét` — liệt kê và lý do từ chối

Cách thêm ADR mới

1. Tạo file markdown mới trong `docs/adr/` theo quy tắc đặt tên.
2. Điền đầy đủ các phần theo mẫu ở trên với nội dung rõ ràng và súc tích.
3. Thêm liên kết tới ADR mới trong `docs/adr/index.md`.
4. Nếu quyết định ảnh hưởng tới tóm tắt kiến trúc toàn cục, cập nhật `docs/architecture.md` để tham chiếu ADR.
5. Mở PR mô tả thay đổi; mời Reviewer từ Platform và các team bị ảnh hưởng.

Rà soát & quản lý thay đổi

- Để thay đổi một ADR đã được chấp nhận, tạo một ADR mới ghi rõ lý do thay đổi và tham chiếu ADR mới trong tài liệu ADR trước đó (không sửa lịch sử trực tiếp trong file ADR đã chấp nhận).
- Mọi tài liệu được merge vào main branch đều được coi là chính thức. Mọi tài liệu được merge vào dev branch đều là đề xuất và đang trong quá trình thử nghiệm

Bảo trì

- Giữ `docs/adr/index.md` luôn cập nhật để phản ánh tập ADR hiện tại.
- Sử dụng các file ADR làm nguồn sự thật (source of truth) cho lý do tại sao quyết định đã được đưa ra.
