# ADR-IAM-9: Sử dụng Redis chia sẻ làm Danh sách Đen Token (Token Revocation Store)

## Bối cảnh

Hệ thống cấp Access Token (JWT) và đôi khi token tham chiếu (opaque) cho cả người dùng và luồng service-to-service. Các dịch vụ phía dưới (downstream) kiểm tra JWT một cách stateless (xác thực chữ ký và claim) để tránh gọi IAM trên mỗi request. Tuy nhiên, chúng ta cần một cơ chế đáng tin cậy và có độ trễ thấp để thu hồi token ngay lập tức (ví dụ: logout, thu hồi session, admin force-revoke) mà không phá vỡ mô hình xác thực stateless.

EventStoreDB là nguồn chân lý cho domain events và Postgres/Read Models lưu metadata phiên, nhưng cả hai đều không phù hợp cho kiểm tra thu hồi token ở tần suất cao (per-request) do độ trễ. Vì vậy cần một store thu hồi nhanh, dễ vận hành mà các dịch vụ có thể truy vấn.

## Quyết định

Sử dụng một instance Redis chia sẻ (hoặc cụm Redis HA/cluster) làm "token blacklist" (revocation store). IAM service sẽ là thành phần duy nhất ghi (writer) các mục bị thu hồi; các dịch vụ khác chỉ đọc (read-only) từ Redis để kiểm tra xem một token (bằng `jti` hoặc id tham chiếu) có bị thu hồi hay không. IAM giữ quyền quyết định đối với hành động thu hồi (viết), trong khi các dịch vụ khác thực hiện kiểm tra nhanh, cục bộ (đọc) trên Redis.

Redis được sử dụng như cache vận hành chính cho revocation; ghi nhận lịch sử/forensic vẫn được thực hiện trong EventStoreDB/Postgres thông qua các domain event (ví dụ: `SessionRevoked`, `UserLoggedOut`, `TokenRevoked`).

## Lý do

- Độ trễ: Redis cung cấp đọc ở cấp microsecond phù hợp cho kiểm tra per-request ở QPS cao.
- Khả năng mở rộng: Cụm Redis chia sẻ hỗ trợ nhiều instance dịch vụ mà không cần gọi IAM trên mỗi request.
- Đơn giản: Các dịch vụ chỉ cần đọc Redis; IAM chịu trách nhiệm về logic ghi (TTL, cleanup).
- Mô hình nhất quán chấp nhận được: một khoảng trễ ngắn do replication trong Redis là chấp nhận được so với lợi ích thu hồi tức thời.

## Hệ quả

- Tích cực
  - Thu hồi ngay lập tức (immediate revocation) mà không cần mọi dịch vụ gọi IAM để introspect token.
  - Các dịch vụ downstream vẫn giữ tính stateless trong việc xác thực token (vẫn kiểm tra chữ ký/claims local, rồi kiểm tra revocation trong Redis).
  - IAM kiểm soát vòng đời mục thu hồi; trách nhiệm vận hành rõ ràng.

- Tiêu cực / Đổi chác
  - Redis trở thành phụ thuộc vận hành quan trọng; nếu Redis không khả dụng, kiểm tra auth có thể bị ảnh hưởng.
  - Cần thiết kế key và TTL cẩn thận để tránh tăng trưởng không kiểm soát trong Redis.
  - Có thể tồn tại nhất quán ngắn hạn trong cấu hình geo-replication; cần chấp nhận hoặc giảm thiểu.

## Thiết kế chi tiết

### Cấu trúc key và lưu trữ

- Key blacklist cho Access Token (JWT) theo JTI:
  - Key: `access_token_blacklist:{jti}`
  - Value: JSON hoặc chuỗi đơn giản chứa metadata (ví dụ `{"revokedBy":"iam","revokedAt":"2025-11-21T12:00:00Z","reason":"logout","sessionId":"..."}`) hoặc chỉ `1` khi không cần metadata.
  - TTL: đặt bằng thời gian TTL còn lại của token (thời điểm hết hạn của access token). Nếu token không có expiry (không nên xảy ra), cấu hình một TTL tối đa an toàn (ví dụ 7 ngày) và ghi sự kiện vào storage bền vững.

- Key blacklist cho Reference Token (opaque id):
  - Key: `reference_token_blacklist:{refId}`
  - Giá trị/TTL tương tự như trên.

- Thu hồi theo session (fast path, tùy chọn):
  - Key: `session:{sessionId}:revoked` => `1` với TTL = thời gian còn lại của session. Dịch vụ downstream có thể ánh xạ token->sessionId qua claim và kiểm tra key này.

### Ngữ nghĩa ghi (IAM service)

- Khi IAM thu hồi token hoặc session (logout, admin revoke, session revoked):
  1.  Append một domain event (ví dụ `SessionRevoked` hoặc `TokenRevoked`) vào EventStoreDB / Postgres để phục vụ audit.
  2.  Tính TTL còn lại của token (expiry - now). Nếu TTL <= 0 thì bỏ qua (token đã hết hạn).
  3.  Thực hiện `SET key value EX <seconds>` vào Redis một cách nguyên tử (hoặc dùng `SETEX`). Có thể lưu metadata nếu cần thiết.
  4.  (Tùy chọn) publish message lên event bus (RabbitMQ) để hệ thống khác phản ứng (metrics, analytics). Không bắt buộc cho kiểm tra runtime.

### Ngữ nghĩa đọc (các dịch vụ khác)

- Trên mỗi request có token, dịch vụ thực hiện:
  1.  Xác thực chữ ký token, expiry, audience, v.v. một cách local.
  2.  Lấy `jti` (hoặc id tham chiếu / sessionId) từ claim của token.
  3.  `GET access_token_blacklist:{jti}` trên Redis.
      - Nếu có kết quả -> từ chối token (401 / invalid). Có thể log/thu thập metadata để điều tra.
      - Nếu không có -> chấp nhận token (vẫn kiểm tra các quyền/claims bình thường).

### Tính nguyên tử & điều kiện đua (race conditions)

- Luồng canonical: append domain event rồi viết vào Redis. Vì Redis là source vận hành cho revocation runtime, cần coi Redis là nguồn vận hành; EventStoreDB dùng cho audit. Nếu ghi Redis thất bại, IAM phải retry hoặc cảnh báo (alert). Domain event vẫn là bản ghi đáng tin cậy để dùng reconcile khi cần.

### Chính sách TTL

- Với mỗi mục blacklist, đặt TTL = min( thời gian token còn lại, cấu hình max TTL (ví dụ 7 ngày) ).
- Thiết lập mặc định hợp lý để tránh tăng trưởng không kiểm soát. Access token có TTL ngắn (5–15 phút) là tốt; token dài hạn nên dùng session/referer tokens và thu hồi theo session.

### Bảo mật và phân quyền truy cập

- Redis ACLs: giới hạn quyền ghi chỉ cho IAM (service credentials); các dịch vụ khác có thể được cấp credential chỉ có quyền đọc (hoặc áp dụng RBAC/ network-level restrictions). Tốt nhất là IAM dùng principal riêng với quyền ghi và credential ngắn hạn nếu có thể.
- Mã hoá khi truyền: bật TLS giữa dịch vụ và Redis.
- Tránh lưu plaintext nhạy cảm trong Redis; chỉ lưu metadata tối thiểu và ưu tiên lưu `sessionId` thay vì PII.

### Khả năng chịu lỗi và nhân rộng

- Dùng Redis HA/cluster (Redis Sentinel, Redis Cluster hoặc dịch vụ quản lý) với replication và failover phù hợp. Đảm bảo latency đọc vẫn đáp ứng yêu cầu.
- Với hệ thống phân tán theo vùng (geo), cân nhắc replica đọc cục bộ và chấp nhận trade-off eventual consistency. Nếu cần thu hồi tức thì theo mọi vùng, cân nhắc dùng giải pháp global Redis hoặc chiến lược replication nhanh; nếu không, chấp nhận cửa sổ propagation nhỏ hoặc dùng reference token với introspection.

### Migration & reconcile

- Reconcile: Khi khởi động hoặc theo lịch, IAM nên quét các revocation events gần đây từ EventStoreDB/Postgres và đảm bảo các key tương ứng tồn tại trong Redis (backfill). Điều này bù đắp trường hợp mất dữ liệu Redis.
- Backup: Cấu hình persistence (RDB/AOF) cho Redis theo chính sách vận hành; thực hiện backup định kỳ và drills khôi phục.

### Kiểm thử

- Unit tests: kiểm tra IAM set key với TTL và định dạng key chính xác.
- Integration tests: mô phỏng revoke -> redis set -> downstream service reject token.
- E2E: test các luồng logout, admin revoke, session revoke với JWT và reference token.

### Metrics & monitoring

- Các metric quan trọng:
  - `token_revocations_total` (IAM)
  - `redis_blacklist_set_failures` (IAM)
  - `redis_blacklist_key_count` (gauge) hoặc `blacklist_memory_usage`
  - `token_blacklist_hit_rate` (downstream services: tần suất token trùng blacklist)
  - `token_blacklist_lookup_latency_ms`

- Cảnh báo (Alerts):
  - Redis unavailable / error rate cao → page on-call.
  - `redis_blacklist_set_failures > threshold` → escalate.

### Runbook vận hành (tóm tắt)

1. Để thu hồi token/session: dùng endpoint admin của IAM hoặc UI nội bộ — hành động append domain event và set key Redis với TTL.
2. Để kiểm tra revocation: `GET access_token_blacklist:{jti}` hoặc `GET session:{sessionId}:revoked`.
3. Nếu Redis mất dữ liệu: chạy job reconcile để tái tạo key từ sự kiện gần đây (EventStoreDB / Postgres). Nếu không thể reconcile, tạm thời chặn token bằng cờ shutdown toàn cục và yêu cầu người dùng xác thực lại.

### Ví dụ (redis-cli)

Đặt mục blacklist với TTL 900 giây:

```
SETEX access_token_blacklist:9a1b2c3d 900 1
```

Kiểm tra mục blacklist:

```
GET access_token_blacklist:9a1b2c3d
```

### Pseudocode (IAM revoke)

```ts
// Khi nhận yêu cầu revoke
appendEvent('TokenRevoked', { jti, sessionId, reason });
const ttl = tokenExpiry - Date.now();
if (ttl > 0) redis.setex(`access_token_blacklist:${jti}`, Math.ceil(ttl / 1000), JSON.stringify({ revokedAt: new Date().toISOString(), sessionId }));
```

### Pseudocode (kiểm tra ở downstream)

```ts
function isTokenRevoked(jti) {
  return !!redis.get(`access_token_blacklist:${jti}`);
}

// Request handler
if (verifyJwt(token) && !isTokenRevoked(token.jti)) {
  // tiếp tục xử lý
} else {
  // từ chối
}
```

## Các phương án thay thế đã xem xét

- Central introspection endpoint (IAM): đơn giản về mặt ngữ nghĩa nhưng thêm network hop và có thể trở thành cổ chai (bottleneck).
- Dùng database (Postgres) làm blacklist: bền nhưng quá chậm cho kiểm tra per-request ở QPS cao.
- Chỉ dùng JWT với expiry ngắn (không có revocation): đơn giản nhưng không chấp nhận được khi cần force revoke ngay lập tức.

## Ghi chú

- Giữ TTL token ngắn để giảm cửa sổ tấn công và chi phí lưu trữ blacklist.
- Ưu tiên dùng reference tokens cho session dài hạn cần revocation chi tiết và audit.

## ADR liên quan

- ADR-IAM-6 (Checkpoint semantics) — sử dụng Redis làm cache cho checkpoint projection.
- ADR-IAM-7 (Reservation Pattern) — thảo luận ràng buộc giao dịch và trách nhiệm Postgres.

## Trạng thái và bước tiếp theo

- Triển khai logic IAM để ghi revocation và middleware/guard cho downstream services kiểm tra Redis.
- Thêm job reconcile và runbook vận hành vào tài liệu `ops`.
