# ADR-G1 — Monorepo với Nx và DevContainers

## 1. Bối cảnh

Repository chứa nhiều microservice và thư viện chia sẻ. Monorepo mang lại nhiều lợi ích cho kiểu tổ chức này nhưng cũng có thách thức như build chậm, xung đột dependency và onboarding phức tạp cho developer mới.

## 2. Quyết định

Áp dụng kiến trúc monorepo kết hợp với Nx làm hệ thống build thông minh và DevContainers để chuẩn hóa môi trường phát triển. Giải pháp này sẽ là hướng chính cho tổ chức mã nguồn, tối ưu build và đảm bảo môi trường developer nhất quán.

## 3. Lý do

- **Nx Monorepo:** Sử dụng Nx để quản lý monorepo, tận dụng tính năng affected graph để chỉ build/test các phần bị ảnh hưởng bởi thay đổi, giảm thời gian CI đáng kể.
- **Computation Caching:** Nx cung cấp computation caching, lưu kết quả build/test để tái sử dụng trong các lần chạy sau, giúp tăng tốc độ CI.
- **DevContainers:** Cấu hình DevContainers để chuẩn hóa môi trường phát triển, đảm bảo mọi developer có cùng môi trường với các công cụ và dependency cần thiết.

## 4. Hệ quả

### Tích cực

- Rút ngắn thời gian CI nhờ build chọn lọc và caching.
- Onboarding nhanh hơn nhờ môi trường dev tiêu chuẩn.
- Toolchain nhất quán giữa các developer.
- Dễ thiết lập hạ tầng local (Testcontainers, Docker Compose).

### Tiêu cực

- Tốn công cấu hình và duy trì DevContainers và cache CI.
- Cần cập nhật tài liệu và config Nx/DevContainer khi toolchain thay đổi.

## 5. Các lựa chọn đã xem xét

- **Multi-repo:** Giảm phạm vi ảnh hưởng của thay đổi nhưng gây khó khăn cho thay đổi xuyên dự án và làm chậm release phối hợp.
  - _Lý do từ chối:_ Thay đổi nhiều project khó triển khai/test và release coordination phức tạp.
- **Monorepo không dùng Nx:** Bắt đầu đơn giản nhưng CI chậm do rebuild toàn repo cho nhiều thay đổi.
  - _Lý do từ chối:_ Mất lợi ích hiệu suất và năng suất developer từ đồ thị affected và computation cache của Nx.
