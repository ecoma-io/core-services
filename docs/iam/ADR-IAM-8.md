# ADR-IAM-8 — Quyết định Thuật toán Băm Mật khẩu (Password Hashing Algorithm)

## 1. Bối cảnh

Vì yêu cầu bảo mật cao và mong muốn kháng được tấn công brute-force bằng phần cứng chuyên dụng (GPU/ASIC), cần chọn một thuật toán băm mật khẩu phù hợp.

Yêu cầu:

- Kháng brute-force / memory-hard
- Hỗ trợ cấu hình tham số (time, memory, parallelism)
- Hỗ trợ dễ dàng migrate từ thuật toán cũ
- Hỗ trợ trên ngôn ngữ chính của stack (NodeJS/Java/Golang/Python)

## 2. Quyết định

Sử dụng Argon2id làm thuật toán băm mật khẩu mặc định cho toàn bộ hệ thống IAM.

## 3. Lý do

- Argon2 (đặc biệt variant `argon2id`) là thuật toán được thiết kế để chống các tấn công bằng GPU/ASIC và side-channel.
- Argon2id kết hợp ưu điểm của Argon2i (kháng side-channel) và Argon2d (kháng GPU) cho use-case lưu hash mật khẩu.
- Có tham số cấu hình (time cost, memory cost, parallelism) cho phép cân bằng hiệu năng/chi phí và bảo mật cho phép mở rộng theo cấu hình phần cứng.
- Thư viện hỗ trợ phổ biến trên NodeJS, Java, Go, Python.

## 4. Hệ quả

### Tích cực

- **Khả năng chống brute-force tốt hơn**: `Argon2id` cung cấp tính memory-hard và configurable parameters giúp tăng chi phí tấn công bằng phần cứng (GPU/ASIC).
- **Cấu hình linh hoạt**: Tham số `time`, `memory` và `parallelism` cho phép cân bằng giữa bảo mật và hiệu năng theo môi trường (dev/staging/production).
- **Chuẩn công nghiệp và tương thích thư viện**: Được hỗ trợ rộng rãi trên NodeJS/Java/Go/Python, giúp đơn giản hóa triển khai đa ngôn ngữ.
- **Dễ dàng migrate**: Cơ chế lưu salt/version giúp xây dựng chiến lược chuyển đổi dần (phased migration) từ thuật toán cũ sang Argon2id.
- **Giảm rủi ro bảo mật dài hạn**: Sử dụng thuật toán hiện đại giúp hệ thống an toàn hơn trước các tiến triển phần cứng tấn công trong tương lai.

### Tiêu cực

- **Chi phí tài nguyên cao hơn**: Argon2id (với memory-hard configuration) tiêu thụ nhiều bộ nhớ và có thể làm giảm throughput của các endpoint xác thực nếu không điều chỉnh tham số và hạ tầng.
- **Cần tinh chỉnh tham số theo môi trường**: Sai cấu hình có thể dẫn đến hiệu năng kém (quá chậm) hoặc bảo mật kém (quá nhẹ). Cần benchmarking và profile trước khi thay đổi tham số.
- **Phức tạp khi migrate**: Việc migrate từ hệ thống cũ đòi hỏi kế hoạch từng bước (accept old hashes, re-hash on login, monitoring) và có thể làm tăng độ phức tạp vận hành.
- **Phụ thuộc vào thư viện/implementations**: Chất lượng và tính đúng đắn của thư viện Argon2 trên từng ngôn ngữ cần được kiểm tra; bugs hoặc thiếu tính năng ở một implementation có thể là rủi ro.
- **Yêu cầu giám sát và alert**: Vì ảnh hưởng tới hiệu năng, cần bổ sung metrics (latency, memory usage, error rates) và alerting cho các endpoint liên quan tới băm mật khẩu.

## 5. Các lựa chọn đã xem xét

- `bcrypt`: widely supported and battle-tested, nhưng ít kháng GPU/ASIC so với Argon2 và có giới hạn về memory-hardness.
- `scrypt`: tốt nhưng ít phổ biến hơn Argon2 và có hỗ trợ thư viện khác nhau.

Quyết định chọn `Argon2id` vì tính an toàn và cấu hình linh hoạt.
