# IAM — Ubiquitous Language (Ngôn ngữ chung)

Tài liệu này tập hợp và chuẩn hoá các thuật ngữ, khái niệm và tên sự kiện dùng trong toàn bộ bounded contexts của Identity & Access Management (IAM). Mục tiêu là làm nguồn tham chiếu chung để đội phát triển, kiến trúc sư và tài liệu tuân theo một ngôn ngữ chung.

Lưu ý: nhiều định nghĩa được minh hoạ chi tiết trong các tài liệu domain model (`docs/iam/*-domain-model.md`) và các ADR liên quan (ví dụ `ADR-IAM-2`, `ADR-IAM-7`, `ADR-IAM-8`, `ADR-IAM-10`).

---

## 1 — Bounded contexts chính

- IDM — Identity Management: quản lý vòng đời người dùng (User), credential, xác thực email/username, MFA, self-service.
- ACM — Access Management: chịu trách nhiệm cấp/thu hồi tokens, session, revocation orchestration, token rotation.
- AZM — Authorization Management: đăng ký Role / Permission, versioning, ngữ cảnh phân quyền.
- OCS — Organization & Context Scoping: quản lý Product, Tenant, Enrollment / Membership mapping (User → Product/Tenant).

---

## 2 — Aggregate Roots / Entities (định danh)

- User (User AR): entity global chứa thông tin profile, credentials, trạng thái tài khoản (Active, Suspended, Locked, Deleted).
- Session (Session AR): đại diện phiên đăng nhập, liên kết với User, device, refresh token và fid (family id) cho AT invalidation.
- Role (Role AR): tập hợp Permission; scoped cho Product hoặc Tenant.
- Permission (Permission AR / registry): quyền logic với versioning.
- Product (Product AR): danh tính kỹ thuật của sản phẩm/app dùng IAM.
- Tenant (Tenant AR): đơn vị tổ chức, quản lý multi-tenancy.
- Membership / Enrollment: mapping User → Product/Tenant + assigned Role(s).
- OAuth Client: đại diện OAuth/OIDC client (clientId, clientSecretHash, redirectUris, grantTypes).

---

## 3 — Value objects / Identifiers / Claims (từ vựng kỹ thuật)

- UserId / SessionId / RoleId / PermissionId / ProductId / TenantId / MembershipId / ClientId: khuyến nghị sử dụng UUID v7 (định dạng id chuẩn).
- Access Token (AT): JWT — **PHẢI** (MUST) chứa claim `jti`.
- Refresh Token (RT): opaque reference token — chỉ lưu `refreshTokenHash` (không lưu raw refresh token).
- tokenReferenceHash: hàm băm mật mã của `jti` (ví dụ H(jti)) — dùng để tra cứu/thu hồi nhanh.
  - `sid` (session id claim): trường JWT tùy chọn để liên kết Access Token với `sessionId` khi có.
- refreshTokenHash: hash của Refresh Token (RT) — dùng để xác thực/rotate mà không cần lưu raw RT.
  - Reuse / compromise detection: các luồng refresh phải phát hiện reuse và emit `TokenReuseDetectedEvent` / `RefreshTokenReuseDetected` (treat as compromise → revoke session).
- fid (family id): string used to represent a family of Access Tokens for bulk invalidation.
- DeviceInfo: siêu dữ liệu về client/device (userAgent, ip, fingerprint).
- LoginMethod: kiểu enum {Password, Social, Passwordless, SSO}.
- SessionStatus: kiểu enum {Active, Expired, Revoked}.
- Email / Username: canonical unique identity attributes (unique enforced using Guard Streams + atomic writes per ADR-IAM-7).

---

## 4 — Canonical Domain Events (short list)

Danh sách sự kiện phía dưới là tên sự kiện chuẩn (canonical) được dùng xuyên suốt IAM và cần được producers/consumers sử dụng nhất quán.

- UserRegisteredEvent, UserEmailVerifiedEvent, UserPasswordChangedEvent, UserAccountSuspendedEvent, UserAccountLockedEvent, UserAccountDeletedEvent, UserAccountExpiredEvent, UserLoggedInEvent, UserLoggedOutEvent
- SessionCreatedEvent, SessionRevokedEvent, SessionsRevokedEvent, SessionExpiredEvent
- AccessTokenIssuedEvent, RefreshTokenIssuedEvent, RefreshRotatedEvent, RefreshTokenRevokedEvent, TokenReuseDetectedEvent, RefreshTokenReuseDetected
- AccessTokensRevokedEvent (token-level/fid-based bulk invalidation)
- RoleCreatedEvent, RoleUpdatedEvent, RolePermissionsChangedEvent, RoleDeletedEvent
- PermissionRegisteredEvent, PermissionUpdatedEvent, PermissionDeprecatedEvent, PermissionDeletedEvent, PermissionAddedToRoleEvent, PermissionRemovedFromRoleEvent
- MembershipCreatedEvent, MembershipRevokedEvent, MembershipRejectedEvent, RoleGrantedEvent, RoleRevokedEvent, RoleAssignmentRequestedEvent, RoleAssignmentRequestFailedEvent
- OAuthClientRegisteredEvent, OAuthClientSecretRotatedEvent, OAuthClientRevokedEvent

### Guard / uniqueness lock events (Guard Streams)

- EmailLockAcquiredEvent, EmailLockReleasedEvent
- UsernameLockAcquiredEvent, UsernameLockReleasedEvent
- TenantNameLockAcquiredEvent, TenantNameLockReleasedEvent
- ProductNameLockAcquiredEvent, ProductNameLockReleasedEvent
- RoleNameLockAcquiredEvent, RoleNameLockReleasedEvent

---

## 5 — Key concepts & architecture patterns

- Guard Streams + Multi-Stream Atomic Write: cơ chế chuẩn để đảm bảo tính duy nhất (email, username, tên tenant/product) và hỗ trợ thao tác atomic key-swap / atomic takeover (xem ADR-IAM-7).
- Xử lý secrets: các bí mật ở dạng thô (raw refresh tokens, client secrets, raw passwords) **tuyệt đối KHÔNG** được lưu hoặc phát ra dưới dạng raw — chỉ lưu các dạng an toàn (hashes: refreshTokenHash, clientSecretHash, passwordHash) theo yêu cầu của các ADR (xem ADR-IAM-8).
- Vòng đời token: Access Token (JWT + jti) + Refresh Token (opaque); issuer nên trả `tokenReferenceHash` / `refreshTokenHash` thay vì raw secrets khi đưa vào projections/events.=
- Orchestration thu hồi: ACM là tác nhân có thẩm quyền phát `AccessTokensRevokedEvent` và `SessionsRevokedEvent`; các bounded context khác (AZM/IDM/OCS) chỉ phát các trigger event kèm hint (ví dụ `affectedFids`, `affectedTokenReferenceHashes`, `affectedUserIds`) — sau đó ACM sẽ mapping các trigger này và quyết định chính sách thu hồi (dedupe, audit).
- Family-id (`fid`): dùng để gom nhóm các AT, hỗ trợ invalidation hàng loạt hiệu quả theo ADR-IAM-10.
- Snapshot phi chuẩn hoá (denormalized): các sessions/projectors nên lưu denormalized `roleIds`, `permissionsSnapshot` và `rolesFingerprint` để đưa ra quyết định nhanh khi permissions thay đổi.

---

## 6 — Dịch vụ & cổng (tên chuẩn)

- SessionService (createSession, revokeSession, refreshSession, listActiveSessions)
- TokenService / TokenIssuer (issueAccessToken, issueRefreshToken, validateAccessToken)
- RevocationService (revokeByTokenReference, revokeByFid, isTokenRevoked)
- PasswordService / IPasswordHasher (hash, verify, needsRehash)
- OAuthClientService (registerClient, rotateClientSecret, validateRedirectUri)

Các tên interface (ports) dùng xuyên suốt tài liệu: ISessionRepository, ITokenIssuer, IRevocationStore, IOAuthClientRepository, IPasswordHasher, IEventStore, ISnapshotStore, v.v.

---

## 7 — Developer guidance / conventions

- Sử dụng tên sự kiện và ý nghĩa trường chuẩn (ví dụ `tokenReferenceHash = H(jti)`, `refreshTokenHash`) khi producers/consumers tương tác với events.
- Emit provenance/hints in revocation-related triggers: include `initiatedBy` and, when available, `affectedFids` or `affectedTokenReferenceHashes` to help ACM perform fast-path invalidation while preserving auditability.
- Keep Ubiquitous Language stable: new terms must be added here and linked to a domain-model or ADR. Avoid local synonyms (e.g., prefer `refreshTokenHash` not `rtHash` across BCs).

---

## 8 — Cross references

- Domain model canonical sources: `docs/iam/iam-domain-model.md`, `docs/iam/idm/idm-domain-model.md`, `docs/iam/acm/acm-domain-model.md`, `docs/iam/azm/azm-domain-model.md`, `docs/iam/ocs/ocs-domain-model.md`
- Architecture decisions: `docs/iam/ADR-IAM-2.md`, `docs/iam/ADR-IAM-7.md`, `docs/iam/ADR-IAM-8.md`, `docs/iam/ADR-IAM-10.md`
