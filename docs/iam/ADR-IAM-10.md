# ADR-IAM-10: Session, Token, Refresh Token, Rotation & Revocation

## 1. Bối cảnh

Hệ thống sử dụng JWT (JSON Web Tokens) cho Access Token (AT) và mã mờ (Opaque Token) cho Refresh Token (RT). Hệ thống vận hành theo mô hình Microservices và Event Sourcing, sử dụng EventStoreDB làm nguồn sự thật (SSOT) cho Aggregate Root (SessionAR).

Mục tiêu chính là đảm bảo bảo mật cao cho User Sessions trong khi vẫn duy trì trải nghiệm người dùng mượt mà thông qua cơ chế Seamless Background Refresh. Điều này đặc biệt quan trọng trong các kịch bản sau:

- Thay đổi Quyền Hạn (Scopes): Khi quyền hạn của người dùng thay đổi (ví dụ: thêm hoặc bớt quyền truy cập), tất cả các Access Token hiện tại phải bị thu hồi để ngăn chặn truy cập trái phép hoặc user sẽ được cấp quyền mới ngay.
- User logout từ xa: Khi người dùng đăng xuất từ xa (ví dụ: qua trang quản lý tài khoản), tất cả các Access Token và Refresh Token hiện tại phải bị thu hồi ngay.
- Session Hijacking: Nếu một Refresh Token bị đánh cắp và sử dụng lại, toàn bộ phiên làm việc (session) phải bị thu hồi để ngăn chặn truy cập trái phép.

Vấn đề tồn tại là làm thế nào để cân bằng giữa trải nghiệm người dùng mượt mà (Seamless Background Refresh) và yêu cầu bảo mật cao

## 2. Quyết định

Chúng tôi quyết định áp dụng cơ chế Token Rotation kết hợp với Session Versioning thông qua Family ID (fid) để quản lý User Session.

(RT) Rotation: Sau mỗi lần refresh thành công, RT cũ sẽ bị vô hiệu hóa (qua việc cập nhật Hash mới trong SessionAR) và RT mới được cấp (Chỉ lưu RT hash trong SessionAR để phát hiện reuse không được lưu raw refresh token để giảm nguy cơ sử dụng RT rò rỉ). Khi phát hiện RT reuse, toàn bộ Session sẽ bị thu hồi (SessionRevokedEvent) vì không thể biết bên nào mới là chủ sở hữu hợp lệ.
AT Family (fid): Sử dụng một ID phiên bản (fid) trong payload của User AT để đối chiếu với hash(fid) lưu trong Redis Blacklist. Mỗi khi Policy/Scope của Session thay đổi, một fid mới sẽ được tạo ra và lưu trong Redis Projection dưới dạng blacklist với ttl an toàn (= ttl của AT).
Trong các lần refresh thông thường (Maintenance Rotation), fid sẽ được giữ nguyên. Và không tạo ra Session mới, chỉ tạo RT và AT mới với cùng fid hiện tại.
Các sự kiện cảnh báo bảo mật sẽ được phát ra khi phát hiện RT reuse.
Trong Session cũng lưu các thông tin như deviceInfo(ipAddress,countryCode , userAgent) để hỗ trợ điều tra bảo mật khi cần thiết và hiển thị các phiên hoạt động cho người dùng.
Phải có một endpoint để kiểm tra token để xác thực AT.

## 3. Lý do

Thiết kế Token Rotation kết hợp với Session Versioning (fid) được chọn để đạt được cân bằng giữa
bảo mật cao và trải nghiệm người dùng mượt mà. Các lý do chính:

- Ngăn chặn replay / reuse của Refresh Token: khi RT bị đánh cắp, việc chỉ lưu hash và thực hiện
  rotation (một RT chỉ dùng được một lần) cho phép phát hiện reuse — khi phát hiện, toàn bộ session
  có thể bị thu hồi ngay để ngăn truy cập trái phép.
- Hủy bỏ Access Token tức thì khi permission thay đổi: AT là JWT có thời hạn ngắn; nhưng nếu quyền
  thay đổi, ta cần cơ chế để ngay lập tức vô hiệu hóa AT cũ. Session Versioning (fid) với blacklist
  projection (Redis) cho phép invalidation nhanh mà không cần thay đổi cấu trúc JWT.
- Hỗ trợ Seamless Background Refresh: Rotation cho phép refresh liên tục mà không yêu cầu người dùng
  đăng nhập lại, miễn là RT hợp lệ và không bị reuse.
- Auditability và forensics: lưu event (RefreshRotatedEvent, SessionRevokedEvent, TokenReuseDetectedEvent)
  trong EventStoreDB giúp tuần tự hoá hành vi session để điều tra sau này.
- Tương thích với microservices: projection (Redis) dùng để kiểm tra fid/blacklist giảm độ trễ khi các
  service xác thực AT và có thể triển khai forward authentication checking ở lớp gateway

Kết hợp các giải pháp này giúp cân bằng giữa tính bảo mật, hiệu năng và tính khả vận hành trong môi
trường microservices có nhiều instance đang chạy đồng thời.

## 4. Hệ quả

### Tích cực

- **Giảm rủi ro replay/reuse:** Rotation và hash RT cho phép phát hiện reuse và thu hồi session kịp thời.
- **Immediate revocation:** Sử dụng `fid` và Redis blacklist cho phép vô hiệu hoá AT hiện tại ngay khi policy thay đổi.
- **Seamless UX:** Người dùng hiếm khi phải re-login vì RT được rotate ngầm; chỉ khi có reuse mới bị yêu cầu đăng nhập lại.
- **Audit & Forensics:** Mọi thay đổi token/session đều phát ra event trong EventStoreDB, thuận tiện cho truy vết.
- **Minimized token leakage risk:** Không lưu raw RT, chỉ lưu RT-hash giảm nguy cơ lộ token nếu storage bị truy cập.

### Tiêu cực / rủi ro

- **Stateful requirement:** Cần lưu trạng thái session (hash RT, fid) ở SessionAR và projection (Redis) — trái với triết lý hoàn toàn stateless của JWT.
- **Operational complexity:** Rotation, phát hiện reuse và blacklist TTL yêu cầu vận hành chính xác; lỗi cấu hình TTL có thể gây false-positive/negative.
- **Redis availability:** Việc kiểm tra `fid` trên Redis khiến hệ thống phụ thuộc vào availability và độ trễ của Redis projection.
- **UX impact on compromise detection:** Khi phát hiện RT reuse hệ thống phải thu hồi session (force logout), ảnh hưởng UX người dùng hợp lệ nếu detection false-positive.
- **Testing & Debugging:** Cần test nhiều kịch bản (concurrent refreshes, network partitions, replay attacks) để đảm bảo hành vi đúng.

### Hoạt động & Sự kiện

- **Events:** `SessionCreatedEvent`, `RefreshRotatedEvent` (kèm RT-hash, timestamp, deviceInfo), `TokenReuseDetectedEvent`, `SessionRevokedEvent`.
- **Projections:** Redis projection lưu `sessionId -> RT-hash, fid, lastSeen, deviceInfo` và blacklist `fid` entries với TTL = max AT ttl.
- **Endpoints:** `/auth/refresh` (opaque RT input), `/auth/introspect` (AT check endpoint), `/auth/revoke-session`.

### Pseudocode (Refresh flow)

1. Client calls `/auth/refresh` với opaque RT.
2. Server computes `hash = H(RT)` and loads SessionAR by `sessionId` (from RT metadata) or via RT lookup.
3. If `hash != session.currentRThash` -> emit `TokenReuseDetectedEvent` and emit `SessionRevokedEvent`; return 401.
4. Else: generate new RT, new RT-hash, generate AT with same `fid`; persist `RefreshRotatedEvent` with new RT-hash; return new RT and AT.
5. On permission change: create new `fid`, persist event, write `fid` to Redis blacklist with ttl = AT ttl; emit `SessionRevokedEvent` for necessary sessions.

Pseudocode snippet (reuse detection):

```
if hash(RT) != session.rtHash:
	emit(TokenReuseDetectedEvent(sessionId, key=hash(RT), time=now, deviceInfo))
	emit(SessionRevokedEvent(sessionId, reason='RT reuse'))
	return 401
else:
	rotateRT()
	return newTokens
```

## 5. Các lựa chọn đã xem xét

- **Stateless JWT only (no refresh / no rotation)**
  - Lợi: Triển khai đơn giản, không stateful.
  - Lý do từ chối: Không thể thu hồi AT tức thì khi permission thay đổi; nếu AT thời gian sống dài thì rủi ro bảo mật tăng.
- **Single persistent Refresh Token (no rotation)**
  - Lợi: Triển khai dễ dàng hơn, ít event.
  - Lý do từ chối: Nếu RT bị lộ, kẻ tấn công có thể tiếp tục sử dụng mãi mãi; khó phát hiện reuse.
- **Sliding sessions (renew AT expiry on use without rotation)**
  - Lợi: Trải nghiệm mượt mà.
  - Lý do từ chối: Vẫn không có cơ chế phát hiện reuse, và làm phức tạp việc revoke khi permission thay đổi.
- **Store raw refresh tokens (encrypted) server-side**
  - Lợi: Có thể so sánh trực tiếp, dễ invalidate.
  - Lý do từ chối: Tăng rủi ro nếu DB bị lộ; lưu raw token (dù encrypted) tăng bề mặt tấn công so với chỉ lưu hash.
- **Use short-lived AT only, force frequent login**
  - Lợi: Không cần RT/state.
  - Lý do từ chối: UX kém; không phù hợp với mobile/native apps.

Kết luận: Token Rotation + Session Versioning (fid) cung cấp một hợp đồng an toàn, audit-able và chấp nhận được về mặt trải nghiệm người dùng cho môi trường microservices/ES của chúng tôi. Việc triển khai yêu cầu đầu tư vào projection (Redis), event flows và test coverage để giảm thiểu rủi ro hoạt động.
