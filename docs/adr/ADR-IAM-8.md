# ADR-IAM-8 — Quyết định Thuật toán Băm Mật khẩu (Password Hashing Algorithm)

## Bối cảnh

Vì yêu cầu bảo mật cao và mong muốn kháng được tấn công brute-force bằng phần cứng chuyên dụng (GPU/ASIC), cần chọn một thuật toán băm mật khẩu phù hợp cho môi trường production.

Yêu cầu:

- Kháng brute-force / memory-hard
- Hỗ trợ cấu hình tham số (time, memory, parallelism)
- Hỗ trợ dễ dàng migrate từ thuật toán cũ
- Hỗ trợ trên ngôn ngữ chính của stack (NodeJS/Java/Golang/Python)

## Quyết định

Sử dụng Argon2id làm thuật toán băm mật khẩu mặc định cho toàn bộ hệ thống IAM.

Lý do chính:

- Argon2 (đặc biệt variant `argon2id`) là thuật toán được thiết kế để chống các tấn công bằng GPU/ASIC và side-channel.
- Argon2id kết hợp ưu điểm của Argon2i (kháng side-channel) và Argon2d (kháng GPU) cho use-case lưu hash mật khẩu.
- Có tham số cấu hình (time cost, memory cost, parallelism) cho phép cân bằng hiệu năng/chi phí và bảo mật.
- Thư viện hỗ trợ phổ biến trên NodeJS, Java, Go, Python.

## Tham số khuyến nghị (default)

Giá trị ban đầu khuyến nghị (cần benchmark trên môi trường target và điều chỉnh):

- Variant: `argon2id`
- timeCost (iterations): 3
- memoryCost: 65536 (KB) => 64 MB
- parallelism: 4
- salt: 16 bytes cryptographically secure random

Ghi chú: các tham số phải được cấu hình theo profile triển khai (dev/test có thể dùng cấu hình thấp hơn để không ảnh hưởng CI). Production cần benchmark trên máy chủ thực tế và điều chỉnh memoryCost/timeCost theo SLA.

## API & Domain implications

- `Password` VO API phải hỗ trợ:
  - `createFromPlaintext(plaintext: string, options?: { algorithm?: string, params?: ... }): Password`
  - `createFromHash(hash: string): Password` (loader)
  - `verify(plaintext): boolean` (bao gồm detect và verify legacy algorithms)
  - `needsRehash(): boolean` (so sánh params hiện tại với stored params)
- Khi `needsRehash()` true và `verify()` ok → caller (authentication flow) phải rehash và persist hash mới.

## Libraries & Implementations (recommendations)

- Node.js: `argon2` (npm package) — provides `hash()` and `verify()` and supports output in standard encoded form.
- Go: `golang.org/x/crypto/argon2` + recommended wrappers for encoded format.
- Java: `de.mkammerer:argon2-jvm` or `org.bouncycastle` implementations.
- Python: `argon2-cffi`.

## Operational notes

- Test & Benchmark: trước khi rollout, benchmark trên target instance để chọn `memoryCost`/`timeCost` sao cho overhead chấp nhận được dưới SLO. Document benchmark results.
- Monitoring: thêm metrics `password_rehash_count`, `password_verify_latency_ms`, `legacy_hashes_remaining_gauge`.
- Secret Management: không dùng hệ thống KMS cho hash salts (salts per-user). Salt phải là random per-user.
- Rate-limiting: tiếp tục áp rate-limit cho login attempts; Argon2 tăng chi phí verify nên càng cần rate-limiting mạnh để tránh DoS.

## Testing

- Unit tests for verify/rehash logic across algorithms.
- Integration tests simulating bulk rehashing (rehash-on-login) and verifying no regressions.

## Rollout plan

1. Implement Argon2id support and `Password` VO changes in codebase (support multi-algo verify + rehash-on-login).
2. Deploy to staging with moderate params and run load tests.
3. Deploy to production with tuned params; enable rehash-on-login.
4. Monitor `legacy_hashes_remaining_gauge` to measure progress; optionally provide admin bulk-mail to encourage password resets for older accounts.

## Alternatives considered

- `bcrypt`: widely supported and battle-tested, nhưng ít kháng GPU/ASIC so với Argon2 và có giới hạn về memory-hardness.
- `scrypt`: tốt nhưng ít phổ biến hơn Argon2 và có hỗ trợ thư viện khác nhau.

Quyết định chọn `Argon2id` vì tính an toàn và cấu hình linh hoạt.
