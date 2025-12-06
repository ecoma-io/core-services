# ADR-IAM-2: Sử dụng JWT cho Access Token, Opaque cho Refresh Token, JWT cho Service-to-Service Token

## 1. Bối cảnh

Hệ thống theo kiến trúc microservices phân tán và cần tuân thủ OAuth 2.0 / OpenID Connect (OIDC). Ta cần chọn định dạng token phù hợp cho các luồng: Access Token (AT) dùng bởi client -> resource, Refresh Token (RT) để cấp lại AT, và Service-to-Service (S2S) token cho giao tiếp nội bộ.

## 2. Quyết định

- **Access Token (AT)**: sử dụng JWT (JSON Web Token), ký số (ví dụ RS256).
- **Refresh Token (RT)**: sử dụng Opaque token (chuỗi ngẫu nhiên, ví dụ UUID) với trạng thái lưu server-side.
- **Service-to-Service (S2S) Token**: sử dụng JWT tối giản (iss, aud, scope), ký số bằng khóa dành cho service account.

AT JWT sẽ chứa các claims cần thiết cho ủy quyền cục bộ (ví dụ: `sub`, `scope`, `jti`, `sid`, `fid`), nhưng được giữ gọn. RT là token opaque (một chuỗi ngẫu nhiên) ánh xạ tới phiên/phiên bản trên server. S2S JWT có payload tối giản, chỉ dùng để xác thực/ủy quyền giữa dịch vụ.

## 3. Lý do

**Access Token (JWT)**

- Stateless validation: Resource services và API gateway có thể xác thực chữ ký và TTL mà không cần gọi IAM, giảm latency và tải lên IAM.
- OIDC / OAuth compatibility: nhiều thư viện và tiêu chuẩn kỳ vọng JWT cho AT/ID token.
- Ủy quyền cục bộ: chứa sẵn claims cần thiết để ra quyết định nhanh tại dịch vụ đích.

**Refresh Token (Opaque)**

- Bảo mật cho token vòng đời dài: RT thường có TTL lớn và quyền lực cao (có thể cấp AT mới). Mã mở + lưu hash trên server giúp giảm rủi ro lộ thông tin và suy đoán.
- Hỗ trợ token rotation & reuse-detection: server phải giữ state để kiểm soát và thu hồi RT.

**Service-to-Service (S2S) Token (JWT)**

- Hiệu năng nội bộ: JWT cho phép xác minh nhanh bằng public key, không cần network hop tới IAM.
- Chính sách rõ ràng: dùng `iss`/`aud` để ràng buộc nguồn và đích, phù hợp mô hình Zero Trust.

## 4. Hệ quả

### Tích cực

- **Tuân thủ tiêu chuẩn**: Dễ tích hợp với các thư viện OAuth/OIDC phổ biến.
- **Giảm tải IAM**: Xác thực JWT phân tán giúp giảm các lần gọi introspection.
- **An toàn cho RT**: Opaque RT thuận tiện cho rotation và thu hồi.
- **Giao tiếp nội bộ nhanh**: S2S JWT giảm độ trễ giữa service.

### Tiêu cực / rủi ro

- **Thu hồi tức thì của AT**: JWT là stateless — khó thu hồi ngay lập tức; cần cơ chế bổ trợ (ví dụ session versioning, short TTL, hoặc blacklist dựa trên `jti`).
- **Kích thước token**: Quá nhiều claims làm JWT lớn, tác động băng thông và hiệu năng.

## 5. Các lựa chọn đã xem xét

- **Access Token (JWT)**
  - Định dạng: JWT ký (RS256). Giữ payload tối giản: `iss`, `sub`, `aud`, `scope`, `exp`, `iat`, `jti`, `sid`/`fid` nếu cần.
  - TTL: ngắn (ví dụ 5–15 phút) để giảm nhu cầu thu hồi tức thì.
  - Xác thực: resource services kiểm tra chữ ký bằng `JWKS` (ví dụ `/.well-known/jwks.json`) và `exp`.
  - Thu hồi khẩn: kết hợp `jti` + cache/blacklist (ví dụ Redis) hoặc phiên bản session `fid` để cho phép thu hồi có kiểm soát.

- **Refresh Token (Opaque)**
  - Lưu trữ: chỉ lưu hash của token trong DB; token gốc là chuỗi ngẫu nhiên gửi cho client.
  - Rotation: thực hiện token rotation khi dùng RT để phát hiện reuse (theo ADR 001).
  - TTL & revocation: TTL dài hơn (ví dụ 7 ngày), server lưu trạng thái để revoke khi cần.
  - Bảo vệ truyền: luôn gửi RT qua kênh TLS; trên web, cân nhắc lưu trong `HttpOnly Secure` cookie với `SameSite` phù hợp.

- **S2S JWT**
  - Claims hạn chế: `iss`, `aud`, `scope`, `exp`, `jti`.
  - Khóa: dùng key pair riêng cho service accounts; cung cấp endpoint JWKS cho verification nội bộ.
  - TTL: ngắn, hoặc sử dụng client credentials flow để tái cấp nhanh.

- **Key Management & JWKS**
  - Triển khai endpoint JWKS từ IAM; hỗ trợ quay vòng khóa (key rotation) và tiêu chí hợp lệ của khóa.

- **Gateway / Resource API behaviour**
  - Gateway kiểm tra JWT và có thể thực hiện thêm introspection cho các trường hợp cần thu hồi tức thì hoặc phức tạp.

- **Các lưu ý bảo mật khác**
  - Đăng nhập, lưu trữ RT an toàn, chống replay, kiểm soát scope/privilege escalation.
  - Giám sát token usage và cảnh báo reuse/abuse.
