# Access Management (ACM) Domain Model

Tài liệu này trình bày mô hình miền (domain model) cho bounded context **Access Management (ACM)**. Nội dung sử dụng tiếng Việt nhưng giữ nguyên các từ và thuật ngữ kỹ thuật bằng tiếng Anh (ví dụ `Access Token`, `Refresh Token`, `jti`, `tokenReferenceHash`, `fid`, `Session`, `Guard Streams`, `UUID v7`). Tài liệu tuân theo các quyết định kiến trúc trong `docs/iam/iam-architecture.md` và các ADR liên quan (đặc biệt `ADR-IAM-2`, `ADR-IAM-7`, `ADR-IAM-8`, `ADR-IAM-10`).

Quyết định chính áp dụng trong file này:

- `Access Token (AT)` là JWT; payload MUST include `jti`. Revocation và lookup nhanh dùng `tokenReferenceHash = H(jti)` (không lưu raw `jti` trong projections).
- `Refresh Token (RT)` là opaque reference token (không phải JWT). Chỉ lưu `refreshTokenHash`; không lưu raw refresh token.
- `fid` là family-id dùng để biểu diễn nhóm Access Token cho invalidation hàng loạt (xem `ADR-IAM-10`).
- Ràng buộc duy nhất (email, username) thực hiện theo `Guard Streams` + atomic multi-stream write (xem `ADR-IAM-7`).
- Aggregate identifiers sử dụng `UUID v7` khi cần.

---

## 1. Aggregate Roots

### 1.1 Session (Aggregate Root)

`Session` biểu diễn phiên đăng nhập của user trên một device/client, và quản lý lifecycle cho phiên và tokens liên quan.

Trường (Fields)

| Field                         | Type            | Mô tả                                                                 |
| ----------------------------- | --------------- | --------------------------------------------------------------------- |
| `sessionId`                   | `SessionId`     | Aggregate id (UUID v7)                                                |
| `userId`                      | `UserId`        | Tham chiếu tới User                                                   |
| `fid`                         | `string`        | Family id cho AT invalidation / versioning                            |
| `refreshTokenHash`            | `string`        | Hash của RT hiện tại (không lưu raw token)                            |
| `roleIds`                     | `string[]`      | Danh sách `RoleId` được gán tại thời điểm issue (denormalized)        |
| `rolesFingerprint`            | `string`        | Hash fingerprint của `roleIds` (dùng để detect change nhanh)          |
| `permissionsSnapshot?`        | `string[]`      | Optional: denormalized list of `PermissionId` effective at issue time |
| `permissionsSnapshotVersion?` | `string`        | Version/timestamp of permission snapshot                              |
| `scopes`                      | `string[]`      | Scopes được cấp                                                       |
| `deviceInfo`                  | `DeviceInfo`    | Metadata thiết bị / user-agent                                        |
| `mfaVerified`                 | `boolean`       | MFA đã verify hay chưa                                                |
| `status`                      | `SessionStatus` | `Active` / `Expired` / `Revoked`                                      |
| `createdAt`                   | `DateTime`      | Thời điểm tạo                                                         |
| `lastActiveAt`                | `DateTime`      | Thời điểm hoạt động gần nhất                                          |
| `expiresAt`                   | `DateTime`      | Thời điểm hết hạn tối đa                                              |
| `revokedAt?`                  | `DateTime`      | Thời điểm bị revoke (nếu có)                                          |

Nguyên tắc nghiệp vụ (Business invariants)

- Khi tạo Session phải kèm RT; hệ thống chỉ persist `refreshTokenHash` và phát event chứa `refreshTokenHash` (không bao giờ phát raw RT).
- Raw refresh token không được lưu, không được log, và không được đưa vào projections hoặc events công khai.
- Mỗi Access Token cấp cho session phải chứa claim `jti`; revocation lookup dùng `tokenReferenceHash = H(jti)`.
- `Session` projection **phải** denormalize `roleIds` (list of `RoleId`) và `rolesFingerprint` để hỗ trợ xử lý event khi role/permission thay đổi.
- Khi nhận `RoleGrantedEvent` / `RoleRevokedEvent` / `RolePermissionsChangedEvent`, ACM **phải**:
  - tìm các session liên quan (theo `membershipId` hoặc `userId`) và so sánh `rolesFingerprint` / `permissionsSnapshotVersion`;
  - nếu session còn hiệu lực và bị ảnh hưởng thì cập nhật `permissionsSnapshot`/`rolesFingerprint` hoặc phát `AccessTokensRevokedEvent` / `SessionRevokedEvent` tùy chính sách (immediate revocation vs lazy reprojection);
  - hỗ trợ both: (a) immediate revoke via `tokenReferenceHashes`/`fids` if provided, or (b) projector-driven update + selective revocation.
- ACM là authoritative owner cho việc phát hành các sự kiện thu hồi token/session (`AccessTokensRevokedEvent`, `SessionsRevokedEvent`). Khi ACM nhận các trigger từ AZM/IDM/OCS (ví dụ `RolePermissionsChangedEvent`, `UserAccountSuspendedEvent`, `TenantSuspendedEvent`), ACM sẽ chịu trách nhiệm mapping → quyết định revocation và emit các sự kiện thu hồi; các producer khác chỉ được gửi trigger/hints.
- Khi nhận `RoleGrantedEvent` / `RoleRevokedEvent` / `RolePermissionsChangedEvent`, ACM **phải**:
  - tìm các session liên quan (theo `membershipId` hoặc `userId`) và so sánh `rolesFingerprint` / `permissionsSnapshotVersion`;
  - nếu session còn hiệu lực và bị ảnh hưởng thì cập nhật `permissionsSnapshot`/`rolesFingerprint` hoặc phát `AccessTokensRevokedEvent` / `SessionRevokedEvent` tùy chính sách (immediate revocation vs lazy reprojection);
  - hỗ trợ both: (a) immediate revoke via `tokenReferenceHashes`/`fids` if provided (treat hints as directive), or (b) projector-driven update + selective revocation; when emitting revocation events ACM MUST include `initiatedBy` provenance and dedupe duplicate requests.
- Khi revoke session (logout hoặc admin revoke) cần phát `SessionRevokedEvent` và mark `refreshTokenHash` là revoked; invalidation nhanh cho AT family thực hiện qua `fid` projection (Redis) theo `ADR-IAM-10`.

Ports liên quan: `ISessionRepository`, `IEventStore`, `IRevocationStore`.

### 1.2 OAuth Client (Aggregate Root)

Quản lý lifecycle của OAuth/OIDC client (confidential & public).

Trường tóm tắt: `clientId` (UUID v7), `clientName`, `clientSecretHash?` (Argon2id), `grantTypes`, `redirectUris`, `scopes`, `status`, `createdAt`, `rotatedAt?`.

Nguyên tắc

- Raw client secret không được lưu hoặc emit; confidential client lưu `clientSecretHash` (Argon2id) và hỗ trợ `needsRehash` theo `ADR-IAM-8`.

Ports: `IOAuthClientRepository`, `IClientSecretHasher`, `IEventStore`.

---

## 2. Value Objects

### 2.1 SessionId

- Kiểu: string (UUID v7)
- Bất biến: Immutable, unique per aggregate

### 2.2 DeviceInfo

- Fields: `userAgent`, `ipAddress`, `location?`, `deviceFingerprint?`

### 2.3 LoginMethod

- Enum: `Password`, `Social`, `Passwordless`, `SSO`

### 2.4 SessionStatus

- Enum: `Active`, `Expired`, `Revoked`

### 2.5 TokenReferenceHash

- Định nghĩa: hash của `jti` (ví dụ SHA-256 H(jti)). Dùng cho AT revocation lookup. Không lưu raw `jti` trong projections.

### 2.6 RefreshTokenHash

- Định nghĩa: hash của RT opaque. So sánh và lưu chỉ bằng hash; raw RT chỉ trả cho client và không lưu.

---

## 3. Events

Mọi domain event là append-only và không được chứa raw secrets (raw secret là secret chưa băm/mã hóa, ví dụ raw password, raw refresh token, raw client secret). Hash (ví dụ Argon2id cho password) hoặc giá trị đã băm/mã hóa được phép lưu trong event.

### 3.1 Session & Token Events (tóm tắt)

#### SessionCreatedEvent

| Field                         | Type        | Mô tả                                            |
| ----------------------------- | ----------- | ------------------------------------------------ |
| `sessionId`                   | `SessionId` | Session tạo mới                                  |
| `userId`                      | `UserId`    | Chủ sở hữu                                       |
| `refreshTokenHash`            | `string`    | Hash của RT cấp                                  |
| `fid`                         | `string`    | Family id phát hành                              |
| `issuedAt`                    | `DateTime`  | Thời điểm                                        |
| `roleIds?`                    | `string[]`  | (tùy chọn) RoleIds assigned at issue time        |
| `rolesFingerprint?`           | `string`    | (tùy chọn) fingerprint/hash of roleIds           |
| `permissionsSnapshotVersion?` | `string`    | (tùy chọn) permission snapshot version/timestamp |

#### AccessTokenIssuedEvent

| Field                | Type        | Mô tả                                |
| -------------------- | ----------- | ------------------------------------ |
| `sessionId?`         | `SessionId` | Context (nếu có)                     |
| `tokenReferenceHash` | `string`    | Hash của `jti` dùng để revoke lookup |
| `clientId?`          | `ClientId`  | Nếu là client token                  |
| `fid?`               | `string`    | Family id (nếu áp dụng)              |
| `issuedAt`           | `DateTime`  | Thời điểm                            |

Ghi chú: không đưa raw `jti` vào projections hoặc events công khai.

#### RefreshTokenIssuedEvent

| Field              | Type        | Mô tả                |
| ------------------ | ----------- | -------------------- |
| `sessionId`        | `SessionId` | Session sở hữu RT    |
| `refreshTokenHash` | `string`    | Hash của RT được cấp |
| `issuedAt`         | `DateTime`  | Thời điểm            |

#### RefreshRotatedEvent

Phát khi RT được rotate (cấp RT mới, invalidate RT cũ).

| Field                 | Type        | Mô tả                |
| --------------------- | ----------- | -------------------- |
| `sessionId`           | `SessionId` | Session bị ảnh hưởng |
| `oldRefreshTokenHash` | `string`    | Hash RT cũ           |
| `newRefreshTokenHash` | `string`    | Hash RT mới          |
| `issuedAt`            | `DateTime`  | Thời điểm            |

#### AccessTokensRevokedEvent

Phát khi một hoặc nhiều access token bị thu hồi (thu hồi theo family `fid`).

| Field                    | Type       | Mô tả                                                                |
| ------------------------ | ---------- | -------------------------------------------------------------------- |
| `fids`                   | `string[]` | Family ids dùng cho invalidation hàng loạt (tùy chọn)                |
| `revokedAt`              | `DateTime` | Thời điểm thu hồi                                                    |
| `reason?`                | `string`   | Lý do (tùy chọn)                                                     |
| `affectedPermissionIds?` | `string[]` | Danh sách permission id khiến việc thu hồi được kích hoạt (tùy chọn) |

#### SessionsRevokedEvent

Phát khi một hoặc nhiều session bị thu hồi (logout, admin revoke, hoặc sự cố bảo mật). Thu hồi session có thể đồng thời dẫn tới việc phát `AccessTokensRevokedEvent` để invalidation các access token liên quan.

| Field          | Type       | Mô tả                                 |
| -------------- | ---------- | ------------------------------------- | ----- | ----- | ----- | ------- | ----------------------------------- |
| `sessionIds?`  | `string[]` | Mảng `sessionId` bị thu hồi           |
| `userIds?`     | `string[]` | Danh sách userId liên quan (tùy chọn) |
| `revokedAt`    | `DateTime` | Thời điểm thu hồi                     |
| `reason?`      | `string`   | Lý do (tùy chọn)                      |
| `initiatedBy?` | `object`   | Provenance object `{ context: 'azm'   | 'idm' | 'ocs' | 'acm' | 'admin' | 'system', id?: string }` (tùy chọn) |

#### SessionRevokedEvent

| Field       | Type        | Mô tả               |
| ----------- | ----------- | ------------------- |
| `sessionId` | `SessionId` | Session bị revoked  |
| `userId?`   | `UserId`    | Chủ sở hữu (nếu có) |
| `revokedAt` | `DateTime`  | Thời điểm           |
| `reason?`   | `string`    | Lý do               |

### 3.2 OAuth Client Events

- `OAuthClientRegisteredEvent`, `OAuthClientUpdatedEvent`, `OAuthClientSecretRotatedEvent`, `OAuthClientRevokedEvent` — KHÔNG BAO GỒM raw secrets.

---

## 4. Domain Services (mô tả ý định & API)

Lưu ý: signature dưới đây mô tả intent domain; adapter phải tuân thủ yêu cầu bảo mật cho secrets.

### 4.1 SessionService

- `createSession(userId: string, deviceInfo: DeviceInfo, loginMethod: LoginMethod): Promise<{sessionId: string, refreshToken: string, refreshTokenHash: string}>`
  - Tạo session và cấp RT opaque; trả raw RT cho caller một lần và trả kèm `refreshTokenHash` để caller/adapters có thể lưu tham chiếu nếu cần. Persist chỉ `refreshTokenHash` và emit `SessionCreatedEvent`.
  - **Ghi chú bảo mật:** raw refresh token chỉ được trả cho caller 1 lần — KHÔNG được persist, log hoặc emit trong events/projections.
- `revokeSession(sessionId: string, reason?: string): Promise<void>`
  - Revoke session, emit `SessionRevokedEvent`, mark RT hash revoked.
- `refreshSession(refreshToken: string): Promise<{accessToken: string, refreshToken?: string, refreshTokenHash?: string}>`
  - Xác thực RT bằng lookup `refreshTokenHash`; nếu hợp lệ cấp Access Token (JWT) và tùy policy rotate RT (emit `RefreshRotatedEvent`). Nếu rotation xảy ra, implementation SHOULD return the new raw refresh token together with the new `refreshTokenHash` (persist only the hash).
- `listActiveSessions(userId: string): Promise<SessionSummary[]>`

Nguyên tắc: Rotation phải phát hiện reuse (theo `ADR-IAM-10`) — nếu phát hiện reuse coi là khả nghi và revoke session.

### 4.2 TokenService / TokenIssuer

- `issueAccessToken(subject: string, claims: object, options?: {expiresInMs?: number, fid?: string}): Promise<{token: string, tokenReferenceHash: string}>`
  - Tạo JWT có `jti`; compute `tokenReferenceHash = H(jti)` và trả để lưu vào events/projections.
- `validateAccessToken(token: string): Promise<{valid: boolean, payload?: any}>`
  - Verify signature/claims, sau đó kiểm tra revocation bằng lookup `tokenReferenceHash = H(payload.jti)`.
- `issueRefreshToken(sessionId: string, options?: any): Promise<{token: string, refreshTokenHash: string}>`
  - Sinh RT opaque; trả raw token cho caller và trả `refreshTokenHash` để dùng làm tham chiếu. **Ghi chú bảo mật:** raw refresh token không được lưu hoặc emit; chỉ `refreshTokenHash` được persist.

### 4.3 RevocationService

- `revokeByTokenReference(tokenReferenceHash: string, ttlSeconds?: number, reason?: string): Promise<void>`
- `revokeByFid(fid: string, ttlSeconds?: number, reason?: string): Promise<void>`
- `isTokenRevoked(tokenReferenceHash: string): Promise<boolean>`

Ghi chú triển khai: RevocationService cần project blacklist vào Redis cho lookup nhanh; `fid`-based invalidation là operation chính thức (see `ADR-IAM-10`).

### 4.4 OAuthClientService

- `registerClient(payload): Promise<ClientId>`
- `rotateClientSecret(clientId: string): Promise<void>`
- `validateRedirectUri(clientId: string, uri: string): Promise<boolean>`

---

## 5. Ports (interfaces domain-facing)

### ISessionRepository

- `findById(sessionId: string): Promise<Session | null>`
- `findActiveSessionsByUserId(userId: string): Promise<Session[]>`
- `findByMembershipId(membershipId: string): Promise<Session[]>`: Find sessions related to a specific membership (useful for AZM/OCS driven revocation).
- `findByTokenReferenceHash(tokenReferenceHash: string): Promise<Session | null>`: Lookup session by AT `tokenReferenceHash` if projection links it.
- `findByFid(fid: string): Promise<Session[]>`: Find sessions by family id for bulk invalidation.
- `save(session: Session): Promise<void>`
- `markRefreshTokenRevoked(sessionId: string, refreshTokenHash: string): Promise<void>`
- `revoke(sessionId: string, reason?: string): Promise<void>`

### ITokenIssuer / ITokenSigner / ITokenValidator

- `issueAccessToken(subject: string, claims: object, options?: any): Promise<{token: string, tokenReferenceHash: string}>`
- `issueRefreshToken(sessionId: string, options?: any): Promise<{token: string, refreshTokenHash: string}>` (opaque)
- `validateAccessToken(token: string): Promise<{valid: boolean, payload?: any}>`
- `sign(payload: object): Promise<string>`
- `verify(token: string): Promise<{valid: boolean, payload?: any}>`

### IRevocationStore

- `revokeTokenReference(tokenReferenceHash: string, ttlSeconds?: number, reason?: string): Promise<void>`
- `revokeFid(fid: string, ttlSeconds?: number, reason?: string): Promise<void>`
- `isTokenReferenceRevoked(tokenReferenceHash: string): Promise<boolean>`

### IOAuthClientRepository / IClientSecretHasher

- `findById(clientId: string): Promise<OAuthClient | null>`
- `save(client: OAuthClient): Promise<void>`
- `hash(secret: string): Promise<string>` (Argon2id)
- `verify(secret: string, hash: string): Promise<boolean>`
- `needsRehash(hash: string): Promise<boolean>`

### IEventStore / ISnapshotStore

- `append(streamId: string, events: DomainEvent[]): Promise<void>`
- `read(streamId: string, fromPosition?: number, limit?: number): Promise<DomainEvent[]>`
- `saveSnapshot(aggregateId: string, snapshot: any, version?: string): Promise<void>`

---

## 6. Appendix: Term ↔ ADR mapping

- `Access Token (AT)` → JWT with `jti` — `ADR-IAM-2`.
- `Refresh Token (RT)` → Opaque reference token; persist only `refreshTokenHash` — `ADR-IAM-2`, `ADR-IAM-10`.
- `fid` → AT family invalidation semantics — `ADR-IAM-10`.
- `Guard Streams` → Unique key enforcement — `ADR-IAM-7`.
- `Argon2id` → Password / secret hashing — `ADR-IAM-8`.

---

## 7. Ghi chú & hướng dẫn triển khai

- Không bao giờ emit raw secrets (RT, client secret) trong events hoặc projections.
- Flow kiểm tra Access Token: (1) verify signature/claims (stateless), (2) kiểm tra revocation bằng `tokenReferenceHash` (stateful) nếu cần.
- Rotation của RT phải phát hiện reuse; nếu phát hiện reuse xử lý như mất token và revoke session theo `ADR-IAM-10`.
- Dùng `fid` projection (Redis) làm fast path cho invalidation khi permission hoặc policy thay đổi.

# Access Management (ACM) Domain Model

This document specifies the canonical domain model for the Access Management (ACM) bounded context. It codifies the Ubiquitous Language and domain events, aggregates, value objects, domain services and ports used by ACM. The content strictly follows the architecture decisions referenced in `docs/iam/iam-architecture.md` and the ADRs referenced there (notably `ADR-IAM-2`, `ADR-IAM-7`, `ADR-IAM-8`, `ADR-IAM-10`).

Key canonical decisions applied in this file:

- Access Tokens (AT): JWTs. JWT payload MUST include a `jti` claim (JWT ID). Revocation and fast lookup use `tokenReferenceHash = H(jti)` (do not persist raw `jti` in read models).
- Refresh Tokens (RT): opaque reference tokens (not JWTs). Only `refreshTokenHash` are persisted; never store raw refresh tokens.
- Session Versioning (`fid`): family-id used to represent an AT family for immediate invalidation when permissions/policies change (see `ADR-IAM-10`).
- Unique constraints (email, username): implemented using Guard Streams + atomic multi-stream writes (see `ADR-IAM-7`).
- Aggregate identifiers: use `UUID v7` for aggregates (stable monotonic ID for event-store ordering semantics where applicable).

---

## 1. Aggregate Roots

### 1.1 Session Aggregate Root

The `Session` aggregate models a user's authenticated session on a device/client and the tokens tied to that session. A Session has a lifecycle (created, active, expired, revoked) and is the authoritative source for session-level invariants.

Fields
| Field | Type | Description |
|---|---|---|
| `sessionId` | `SessionId` | Aggregate id (UUID v7). |
| `userId` | `UserId` | Reference to owning user. |
| `fid` | `string` | Family id (session family) used for AT invalidation / versioning. |
| `refreshTokenHash` | `string` | Hash of the current refresh token (never store raw token). |
| `roleIds` | `string[]` | Denormalized list of `RoleId` assigned at issue time |
| `rolesFingerprint` | `string` | Hash fingerprint of `roleIds` (quick change detection) |
| `permissionsSnapshot?` | `string[]` | Optional denormalized list of `PermissionId` effective at issue time |
| `permissionsSnapshotVersion?` | `string` | Version/timestamp of permission snapshot |
| `scopes` | `string[]` | Granted scopes for the session. |
| `deviceInfo` | `DeviceInfo` | Device/user-agent metadata. |
| `mfaVerified` | `boolean` | Whether MFA was verified for the session. |
| `status` | `SessionStatus` | `Active` / `Expired` / `Revoked`. |
| `createdAt` | `DateTime` | ISO timestamp. |
| `lastActiveAt` | `DateTime` | ISO timestamp. |
| `expiresAt` | `DateTime` | Absolute expiry (max lifetime). |
| `revokedAt?` | `DateTime` | Optional revocation timestamp. |

Business invariants

- A Session MUST be created with an associated refresh token; the system persist only `refreshTokenHash` in durable storage and events.
- Raw refresh tokens MUST NOT be persisted, emitted in cleartext events, or placed in projections.
- Access Tokens issued for a session MUST include a `jti` claim; revocation references must use `tokenReferenceHash = H(jti)`.
- Session-level invalidation (logout or admin revoke) MUST emit `SessionRevokedEvent` and remove/mark `refreshTokenHash` as revoked; downstream fast invalidation for active AT families should use `fid` blacklist projection (Redis) per `ADR-IAM-10`.
- `Session` projections SHOULD denormalize `roleIds` and `rolesFingerprint` so ACM can quickly determine which sessions are affected when roles or permissions change.
- Upon receiving `RoleGrantedEvent` / `RoleRevokedEvent` / `RolePermissionsChangedEvent`, ACM MUST locate affected sessions (by `membershipId`/`userId`) and either:
  - update `permissionsSnapshot`/`rolesFingerprint` for the session projection (and optionally re-evaluate tokens), or
  - immediately emit `AccessTokensRevokedEvent`/`SessionsRevokedEvent` using supplied `tokenReferenceHashes` or `fids` for fast invalidation. Implementations may combine both for safety (immediate revoke + projector reconciliation).

Ports used by Session aggregate: `ISessionRepository`, `IEventStore`, `IRevocationStore`.

Events emitted by Session aggregate are listed in section 3.

### 1.2 OAuth Client Aggregate Root

Models client registration and secret lifecycle.

Fields (abridged): `clientId` (UUID v7), `clientName`, `clientSecretHash?` (Argon2id hash), `grantTypes`, `redirectUris`, `scopes`, `status`, `createdAt`, `rotatedAt?`.

Invariants

- Raw client secrets MUST NOT be persisted or emitted. Confidential clients must store a hashed secret (`Argon2id`) and expose rotation metadata for `needsRehash` flows (see `ADR-IAM-8`).

Ports: `IOAuthClientRepository`, `IClientSecretHasher`, `IEventStore`.

---

## 2. Value Objects

### 2.1 SessionId

- Type: string (UUID v7)
- Invariants: Immutable, unique per session aggregate.

### 2.2 DeviceInfo

- Fields: `userAgent`, `ipAddress`, `location?`, `deviceFingerprint?`.

### 2.3 LoginMethod

- Enum: `Password`, `Social`, `Passwordless`, `SSO`.

### 2.4 SessionStatus

- Enum: `Active`, `Expired`, `Revoked`.

### 2.5 TokenReferenceHash

- Definition: cryptographic hash function over the `jti` (e.g., H(jti) using SHA-256). Used for AT revocation lookups. Do not store raw `jti` in projections; only store `tokenReferenceHash`.

### 2.6 RefreshTokenHash

- Definition: cryptographic hash of the opaque refresh token (store and compare hashes only). The raw refresh token is presented to the client only once (or during rotation) and must not be logged.

---

## 3. Events

All domain events are append-only and emitted to the Event Store. Event payloads MUST avoid including raw secrets or tokens.

### 3.1 Session & Token Events

#### 3.1.1 SessionCreatedEvent

| Field              | Type        | Description                        |
| ------------------ | ----------- | ---------------------------------- |
| `sessionId`        | `SessionId` | Created session id.                |
| `userId`           | `UserId`    | Owner.                             |
| `refreshTokenHash` | `string`    | Hash of the refresh token granted. |
| `fid`              | `string`    | Session family id issued.          |
| `issuedAt`         | `DateTime`  | Timestamp.                         |
| `expiresAt?`       | `DateTime`  | Optional expiry.                   |

#### 3.1.2 AccessTokenIssuedEvent

| Field                | Type        | Description                                                      |
| -------------------- | ----------- | ---------------------------------------------------------------- |
| `sessionId?`         | `SessionId` | Optional session context.                                        |
| `tokenReferenceHash` | `string`    | Hash of the `jti` claim in the JWT (used for revocation lookup). |
| `clientId?`          | `ClientId`  | Optional client.                                                 |
| `fid?`               | `string`    | Family id (if applicable).                                       |
| `issuedAt`           | `DateTime`  | Timestamp.                                                       |
| `expiresAt?`         | `DateTime`  | Optional expiry.                                                 |

Note: do not include raw `jti` in projections or persistent events; if an emitter transiently records `jti` for signing windows, it must ensure it is not persisted to read models.

#### 3.1.3 RefreshTokenIssuedEvent

| Field              | Type        | Description                              |
| ------------------ | ----------- | ---------------------------------------- |
| `sessionId`        | `SessionId` | Session that owns the refresh token.     |
| `refreshTokenHash` | `string`    | Hash of the issued opaque refresh token. |
| `issuedAt`         | `DateTime`  | Timestamp.                               |
| `expiresAt?`       | `DateTime`  | Optional expiry.                         |

#### 3.1.4 RefreshRotatedEvent

Emitted when a refresh token is rotated (a new RT is issued and the old one is invalidated).
| Field | Type | Description |
|---|---|---|
| `sessionId` | `SessionId` | Session affected. |
| `oldRefreshTokenHash` | `string` | Hash of the rotated-out refresh token. |
| `newRefreshTokenHash` | `string` | Hash of the new refresh token. |
| `issuedAt` | `DateTime` | Timestamp. |

#### 3.1.5 AccessTokensRevokedEvent

Emitted when one or more access tokens are revoked (token-level or family-level invalidation).

| Field                    | Type       | Description                                                                   |
| ------------------------ | ---------- | ----------------------------------------------------------------------------- | ----- | ----- | ----- | ------- | ------------------------ |
| `tokenReferenceHash?`    | `string[]` | Array of `tokenReferenceHash` (hashes of `jti`) for explicit token revocation |
| `fids?`                  | `string[]` | Family ids for bulk invalidation (optional)                                   |
| `revokedAt`              | `DateTime` | Timestamp                                                                     |
| `reason?`                | `string`   | Optional human-readable reason                                                |
| `affectedPermissionIds?` | `string[]` | Optional permission ids that triggered the revocation                         |
| `affectedUserIds?`       | `string[]` | Optional user ids affected (when provided by producer hint)                   |
| `initiatedBy?`           | `object`   | Optional provenance: `{ context: 'azm'                                        | 'idm' | 'ocs' | 'acm' | 'admin' | 'system', id?: string }` |

#### 3.1.6 SessionRevokedEvent

| Field       | Type        | Description       |
| ----------- | ----------- | ----------------- |
| `sessionId` | `SessionId` | Session revoked.  |
| `userId?`   | `UserId`    | Owner (optional). |
| `revokedAt` | `DateTime`  | Timestamp.        |
| `reason?`   | `string`    | Optional.         |

### 3.2 OAuth Client Events

- `OAuthClientRegisteredEvent`, `OAuthClientUpdatedEvent`, `OAuthClientSecretRotatedEvent`, `OAuthClientRevokedEvent` — same invariants: never include raw secrets in events.

---

## 4. Domain Services

Services below describe domain intent and required method signatures (ports are defined in section 5). Implementations (adapters) must ensure secrets are treated per ADRs.

### 4.1 SessionService

- `createSession(userId: string, deviceInfo: DeviceInfo, loginMethod: LoginMethod): Promise<{sessionId: string, refreshToken: string, refreshTokenHash: string}>`
- Creates a session and issues an opaque refresh token. Returns the raw opaque refresh token to the caller together with `refreshTokenHash` (persist only the hash) and emit `SessionCreatedEvent` with `refreshTokenHash`.
- Security: raw refresh tokens MUST NOT be persisted, logged or emitted in events/projections.
- `revokeSession(sessionId: string, reason?: string): Promise<void>`
  - Revokes the session, emits `SessionRevokedEvent`, and ensures refresh token hash is marked revoked.
- `refreshSession(refreshToken: string): Promise<{accessToken: string, refreshToken?: string, refreshTokenHash?: string}>`
- Validates the provided opaque refresh token by looking up `refreshTokenHash` in durable storage; on success issues a new access token (JWT) and optionally rotates the refresh token (emit `RefreshRotatedEvent` when rotation occurs). When rotation occurs, implementations SHOULD return the new raw refresh token together with the new `refreshTokenHash` (persist only the hash).
- `listActiveSessions(userId: string): Promise<SessionSummary[]>`

Invariants

- Rotation MUST detect reuse attempts (per `ADR-IAM-10`): if an old RT is used after rotation, treat as potential theft and revoke the session and related RTs.

### 4.2 TokenService / TokenIssuer

- `issueAccessToken(subject: string, claims: object, options?: {expiresInMs?: number, fid?: string}): Promise<{token: string, tokenReferenceHash: string}>`
  - Produces a JWT including `jti`; compute `tokenReferenceHash = H(jti)` and return it to be used in events/read models.
- `validateAccessToken(token: string): Promise<{valid: boolean, payload?: any}>`
  - Verifies signature and claims, then checks revocation (lookup `tokenReferenceHash = H(payload.jti)` in revocation store) per RevocationService fast path.
- `issueRefreshToken(sessionId: string, options?: {expiresInMs?: number}): Promise<{token: string, refreshTokenHash: string}>`
  - Produces an opaque refresh token; return raw token to caller and persist only `refreshTokenHash`.

### 4.3 RevocationService

- `revokeByTokenReference(tokenReferenceHash: string, ttlSeconds?: number, reason?: string): Promise<void>`
- `revokeByFid(fid: string, ttlSeconds?: number, reason?: string): Promise<void>`
- `isTokenRevoked(tokenReferenceHash: string): Promise<boolean>`

Implementation notes: RevocationService must project blacklists into Redis for fast lookup; `fid`-based invalidation is a first-class operation (see `ADR-IAM-10`).

### 4.4 OAuthClientService

- `registerClient(payload): Promise<ClientId>`
- `rotateClientSecret(clientId: string): Promise<void>`
- `validateRedirectUri(clientId: string, uri: string): Promise<boolean>`

---

## 5. Ports (interfaces)

Below are the domain-facing ports implementers must provide adapters for. The method signatures are intentionally small and focused on domain intent.

### ISessionRepository

- `findById(sessionId: string): Promise<Session | null>`
- `findActiveSessionsByUserId(userId: string): Promise<Session[]>`
- `save(session: Session): Promise<void>`
- `markRefreshTokenRevoked(sessionId: string, refreshTokenHash: string): Promise<void>`
- `revoke(sessionId: string, reason?: string): Promise<void>`

### ITokenIssuer / ITokenSigner / ITokenValidator

- `issueAccessToken(subject: string, claims: object, options?: any): Promise<{token: string, tokenReferenceHash: string}>`
- `issueRefreshToken(sessionId: string, options?: any): Promise<{token: string, refreshTokenHash: string}>` (opaque)
- `validateAccessToken(token: string): Promise<{valid: boolean, payload?: any}>`
- `sign(payload: object): Promise<string>`
- `verify(token: string): Promise<{valid: boolean, payload?: any}>`

### IRevocationStore

- `revokeTokenReference(tokenReferenceHash: string, ttlSeconds?: number, reason?: string): Promise<void>`
- `revokeFid(fid: string, ttlSeconds?: number, reason?: string): Promise<void>`
- `isTokenReferenceRevoked(tokenReferenceHash: string): Promise<boolean>`

### IOAuthClientRepository / IClientSecretHasher

- `findById(clientId: string): Promise<OAuthClient | null>`
- `save(client: OAuthClient): Promise<void>`
- `hash(secret: string): Promise<string>` (Argon2id)
- `verify(secret: string, hash: string): Promise<boolean>`
- `needsRehash(hash: string): Promise<boolean>`

### IEventStore / ISnapshotStore

- `append(streamId: string, events: DomainEvent[]): Promise<void>`
- `read(streamId: string, fromPosition?: number, limit?: number): Promise<DomainEvent[]>`
- `saveSnapshot(aggregateId: string, snapshot: any, version?: string): Promise<void>`

---

## 6. Appendix: Term ↔ ADR mapping (quick reference)

- `Access Token (AT)` → JWT with `jti` — `ADR-IAM-2`.
- `Refresh Token (RT)` → Opaque reference token; persist only `refreshTokenHash` — `ADR-IAM-2`, `ADR-IAM-10`.
- `fid` (family id) → Session/AT family invalidation semantics — `ADR-IAM-10`.
- `Guard Streams` → Unique key enforcement strategy — `ADR-IAM-7`.
- `Argon2id` → Password & secret hashing — `ADR-IAM-8`.

---

## 7. Notes & Implementation guidance

- Never emit raw secrets (refresh tokens, client secrets) in events or projections.
- Access token revocation uses a two-step validation: signature/claims validation (stateless) then fast revocation lookup via `tokenReferenceHash` (stateful) when required.
- Refresh token rotation must detect reuse and treat reuse as possible theft — revoke session and associated tokens (per `ADR-IAM-10`).
- The `fid` projection in Redis is a recommended fast path for user/permission-driven bulk invalidation.

```

# Access Management (ACM) Domain Model

Tài liệu này mô tả chi tiết thiết kế miền cho Bounded Context **Access Management (ACM)**, chịu trách nhiệm xác thực người dùng, quản lý phiên truy cập (session) và cấp phát tokens (OAuth2/OIDC). Nội dung trong file này tuân thủ các quyết định kiến trúc được ghi trong `docs/iam/iam-architecture.md` và các ADR được tham chiếu (đặc biệt `ADR-IAM-2`, `ADR-IAM-7`, `ADR-IAM-10`).

## 1. Aggregate Roots

### Session Aggregate Root

Đại diện một phiên đăng nhập (session) sau khi user đăng nhập — quản lý lifecycle cho session và authentication tokens.

| Field               | Type                              | Description                                     |
| ------------------- | --------------------------------- | ----------------------------------------------- |
| `sessionId`         | [`SessionId`](#SessionId)         | UUID v7 — Aggregate root identifier (readonly)  |
| `userId`            | [`UserId`](#UserId)               | Reference to owning User                        |
| `refreshTokenHash`  | `string`                          | Hash của refresh token                          |
| `scopes`            | `Array<string>`                   | Granted scopes                                  |
| `deviceInfo`        | [`DeviceInfo`](#DeviceInfo)       | User agent, IP, location and device fingerprint |
| `loginMethod`       | [`LoginMethod`](#LoginMethod)     | Enum: Password, Social, Passwordless, SSO       |
| `mfaVerified`       | `boolean`                         | Whether MFA was verified for this session       |
| `sessionStatus`     | [`SessionStatus`](#SessionStatus) | Enum: Active, Expired, Revoked                  |
| `createdAt`         | `DateTime`                        | Creation time of session                        |
| `lastActiveAt`      | `DateTime`                        | Last activity time (idle tracking)              |
| `expiresAt`         | `DateTime`                        | Absolute expiry (max lifetime)                  |
| `revokedAt?`        | `DateTime`                        | Revoked timestamp (optional)                    |
| `revocationReason?` | `string`                          | Human-readable reason for revocation (optional) |

- **Business Invariants:**
  - Session phải có Refresh Token liên kết; khi session bị revoke refresh token phải bị revoke.
- **Business Invariants:**
- **Business Invariants:**
- Session phải có Refresh Token liên kết; khi session bị revoke refresh token phải bị revoke.
- Session phải lưu `refreshTokenHash` (không lưu raw refresh token). Refresh Token là opaque token theo `ADR-IAM-2`/`ADR-IAM-10`.
-- Access Token (AT) là JWT và MUST include `jti` claim. ACM uses `tokenReferenceHash = H(jti)` for access-token revocation lookups (see `AccessTokensRevokedEvent`).
- Session Versioning: `fid` (Family ID) được sử dụng để thể hiện phiên bản của session/AT family. Khi policy/permission thay đổi, một `fid` mới được phát hành và ghi vào Redis blacklist để invalidation nhanh theo `ADR-IAM-10`.
- Khi nhận event cho thấy **permission đã tồn tại tại thời điểm cấp nhưng hiện đã bị loại bỏ**, hệ thống **phải** thu hồi access tokens liên quan — thu hồi này phải biểu diễn bằng `AccessTokensRevokedEvent` chứa `fids`, `revokedAt`, `reason`, và optional `affectedPermissionIds`. Việc thu hồi phiên (session) vẫn biểu diễn bởi `SessionRevokedEvent` (ví dụ logout hoặc admin session revoke).
- User có thể có nhiều Sessions đồng thời (giới hạn theo session policy).
- Session tự động expire theo idle timeout hoặc max lifetime.
- Nếu MFA được yêu cầu, MFA phải được verify trước khi cấp session.

- **Value Objects / Notes:** [`SessionId`](#SessionId), [`DeviceInfo`](#DeviceInfo), [`LoginMethod`](#LoginMethod), [`SessionStatus`](#SessionStatus)
- **Ports:** `ISessionRepository`, `IWebAuthnRepository`, `IEventStore`, `ISnapshotStore`
- **Events:** [`UserLoggedInEvent`](#UserLoggedInEvent), [`SessionCreatedEvent`](#SessionCreatedEvent), [`UserLoggedOutEvent`](#UserLoggedOutEvent), [`SessionRevokedEvent`](#SessionRevokedEvent), [`SessionExpiredEvent`](#SessionExpiredEvent), [`AccessTokenIssuedEvent`](#AccessTokenIssuedEvent), [`RefreshTokenIssuedEvent`](#RefreshTokenIssuedEvent), [`RefreshRotatedEvent`](#RefreshRotatedEvent), [`AccessTokensRevokedEvent`](#AccessTokensRevokedEvent), [`SessionsRevokedEvent`](#SessionsRevokedEvent)

### OAuth Client Aggregate Root

Quản lý lifecycle của OAuth / OIDC clients (confidential & public).

| Field               | Type                                    | Description                                                            |
| ------------------- | --------------------------------------- | ---------------------------------------------------------------------- |
| `clientId`          | [`ClientId`](#ClientId)                 | Public client identifier (UUID)                                        |
| `clientName`        | [`ClientName`](#ClientName)             | Human-friendly name                                                    |
| `clientSecretHash?` | [`ClientSecretHash`](#ClientSecretHash) | Hashed client secret (nullable for public clients)                     |
| `grantTypes`        | `string[]`                              | Allowed grant types (`authorization_code`, `client_credentials`, etc.) |
| `redirectUris`      | `string[]`                              | Registered redirect URIs (exact-match rules for auth_code)             |
| `scopes`            | `string[]`                              | Default/allowed scopes                                                 |
| `ownerId?`          | `UserId`                                | Optional owner/creator id                                              |
| `status`            | `string`                                | `active` / `revoked` / `disabled`                                      |
| `createdAt`         | `DateTime`                              | Creation timestamp                                                     |
| `rotatedAt?`        | `DateTime`                              | Last secret rotation timestamp                                         |

- **Business Invariants:**
  - `clientId` phải unique.
  - Nếu `grantTypes` chứa `authorization_code` thì `redirectUris` phải không rỗng và valid.
  - Confidential clients phải lưu `clientSecretHash`; raw secrets không được lưu trong events hoặc projections.
  - Revoked clients không được dùng để cấp token.

- **Value Objects:** [`ClientId`](#ClientId), [`ClientName`](#ClientName), [`ClientSecretHash`](#ClientSecretHash), [`RedirectUri`](#RedirectUri)
- **Ports:** `IOAuthClientRepository`, `IClientSecretHasher`, `IEventStore`
- **Events:** [`OAuthClientRegisteredEvent`](#OAuthClientRegisteredEvent), [`OAuthClientUpdatedEvent`](#OAuthClientUpdatedEvent), [`OAuthClientSecretRotatedEvent`](#OAuthClientSecretRotatedEvent), [`OAuthClientRevokedEvent`](#OAuthClientRevokedEvent)

## 2. Value Objects

<a id="SessionId"></a>

### 2.1 SessionId

- **Type:** string
- **Business Invariants:** UUIDv7, Immutable.

<!-- Refresh tokens are opaque or long-lived reference tokens; raw refresh tokens MUST NOT be persisted. Use `refreshTokenHash` to reference them. -->

<a id="DeviceInfo"></a>

### 2.3 DeviceInfo

- **Type:** object
- **Fields:** `userAgent`, `ipAddress`, `location?`, `deviceFingerprint?`

<a id="LoginMethod"></a>

### 2.4 LoginMethod

- **Type:** string
- **Values:** `Password`, `Social`, `Passwordless`, `SSO`

<a id="SessionStatus"></a>

### 2.5 SessionStatus

- **Type:** string
- **Values:** `Active`, `Expired`, `Revoked`

<a id="ClientId"></a>

### 2.6 ClientId

- **Type:** string
- **Business Invariants:** UUIDv7, Immutable.

<a id="ClientName"></a>

### 2.7 ClientName

- **Type:** string
- **Business Invariants:** Non-empty.

<a id="ClientSecretHash"></a>

### 2.8 ClientSecretHash

- **Type:** string
- **Type:** string
- **Business Invariants:** Hashed (Argon2id), never raw.
- **Notes / Rehashing:**
  - The system MUST record hashing metadata (Argon2id parameters or a `hashVersion`/`hashParams` object) alongside the stored `clientSecretHash` in the OAuth Client record so `needsRehash` can determine if parameters changed.
  - `IClientSecretHasher` implementations MUST expose `needsRehash(hash: string): Promise<boolean>` to allow on-present rehash when a confidential client authenticates.
  - Rehash flow: when a client authenticates with raw secret and `verify(secret, storedHash)` succeeds and `needsRehash(storedHash)` is true, the service MUST compute a new Argon2id hash (using current params) and atomically update the OAuth Client record. Emit `OAuthClientSecretRotatedEvent` (metadata only).
  - For clients that do not authenticate frequently, admins MUST be able to trigger `rotateClientSecret` (policy-driven rotation) to ensure migration to stronger parameters.

<a id="RedirectUri"></a>

### 2.9 RedirectUri

- **Type:** string
- **Business Invariants:** Absolute URI, exact-match policy.

## 3. Events

### 3.1 Session & Authentication Events

Session/User login and token lifecycle events.
#### UserLoggedInEvent

Được phát khi `User` xác thực thành công (login)

| Field         | Type          | Description                  |
| ------------- | ------------- | ---------------------------- |
| `sessionId`   | `SessionId`   | Định danh session được tạo   |
| `userId`      | `UserId`      | `User` đã thực hiện xác thực |
| `deviceInfo?` | `DeviceInfo`  | Metadata thiết bị            |
| `loginMethod` | `LoginMethod` | Phương thức đăng nhập        |
| `issuedAt`    | `DateTime`    | Thời điểm đăng nhập          |

#### SessionCreatedEvent

Được phát khi một bản ghi session được tạo (bao gồm việc cấp token)

| Field              | Type        | Description                   |
| ------------------ | ----------- | ----------------------------- |
| `sessionId`        | `SessionId` | Định danh session             |
| `userId`           | `UserId`    | `User` sở hữu session         |
| `refreshTokenHash` | `string`    | Refresh token hash            |
| `expiresAt`        | `DateTime`  | Thời điểm hết hạn của session |
| `createdAt`        | `DateTime`  | Thời điểm tạo                 |
| `roleIds?`         | `string[]`  | (tùy chọn) RoleIds assigned at issue time |
| `rolesFingerprint?`| `string`    | (tùy chọn) fingerprint/hash of roleIds |
| `permissionsSnapshotVersion?` | `string` | (tùy chọn) permission snapshot version/timestamp |

#### UserLoggedOutEvent

Được phát khi `User` thoát (logout)

| Field         | Type        | Description            |
| ------------- | ----------- | ---------------------- |
| `sessionId`   | `SessionId` | Session bị ảnh hưởng   |
| `userId?`     | `UserId`    | `User` sở hữu (nếu có) |
| `loggedOutAt` | `DateTime`  | Thời điểm logout       |
| `reason?`     | `string`    | Lý do (tùy chọn)       |

#### SessionRevokedEvent

Được phát khi một session bị thu hồi rõ ràng

| Field       | Type        | Description            |
| ----------- | ----------- | ---------------------- |
| `sessionId` | `SessionId` | Session bị ảnh hưởng   |
| `userId?`   | `UserId`    | `User` sở hữu (nếu có) |
| `revokedAt` | `DateTime`  | Thời điểm bị thu hồi   |
| `reason?`   | `string`    | Lý do (tùy chọn)       |

#### SessionExpiredEvent

Được phát khi một session hết hạn

| Field       | Type        | Description            |
| ----------- | ----------- | ---------------------- |
| `sessionId` | `SessionId` | Session bị ảnh hưởng   |
| `userId?`   | `UserId`    | `User` sở hữu (nếu có) |
| `expiredAt` | `DateTime`  | Thời điểm hết hạn      |

#### AccessTokenIssuedEvent

Được phát khi một access token (JWT) được cấp

| Field                | Type        | Description                                                   |
| -------------------- | ----------- | ------------------------------------------------------------- |
| `sessionId`?         | `SessionId` | (optional) Session liên quan nếu áp dụng                      |
| `tokenReferenceHash` | `string`    | Hash of `jti` used for revocation/projection                  |
| `clientId?`          | `ClientId`  | Client cho token S2S (nếu có)                                 |
| `issuedAt`           | `DateTime`  | Thời điểm cấp                                                 |
| `expiresAt?`         | `DateTime`  | Thời điểm hết hạn (nếu có)                                    |

#### RefreshTokenIssuedEvent

Được phát khi một refresh token được cấp

| Field              | Type            | Description                          |
| ------------------ | --------------- | ------------------------------------ |
| `refreshTokenHash` | `string`        | Refresh Token Hash (never raw token) |
| `scopes`           | `Array<string>` | Danh sách scope được cấp             |
| `sessionId`        | `SessionId`     | Session liên quan (nếu có)           |
| `issuedAt`         | `DateTime`      | Thời điểm cấp                        |
| `expiresAt?`       | `DateTime`      | Thời điểm hết hạn (nếu có)           |

#### AccessTokensRevokedEvent

Được phát khi một hoặc nhiều access token bị thu hồi (theo family `fid`). Redis revocation store có thể lưu các khóa tương ứng để downstream lookup nhanh.

| Field                    | Type        | Description                                                                 |
|-------------------------|-------------|-----------------------------------------------------------------------------|
| `fid`                  | `string`  | Family id dùng cho invalidation hàng loạt                     |
| `revokedAt`             | `DateTime`  | Thời điểm thu hồi                                                            |
| `reason?`               | `string`    | Lý do (tùy chọn)                                                             |
| `affectedPermissionIds?`| `string[]`  | Danh sách permission id khiến việc thu hồi được kích hoạt (tùy chọn)         |
| `affectedUserIds?`      | `string[]`  | (tùy chọn) Danh sách userId liên quan (nếu producer cung cấp hint)           |
| `initiatedBy?`          | `object`    | (tùy chọn) Provenance `{ context: 'azm'|'idm'|'ocs'|'acm'|'admin'|'system', id?: string }` |

**Processing contract for `RolePermissionsChangedEvent` (subscription contract):**

- On receiving `RolePermissionsChangedEvent` from AZM, ACM will:
  1. Treat them as fast-path hints and perform immediate invalidation via `AccessTokensRevokedEvent` (emit with `initiatedBy.context = 'azm'` and `initiatedBy.id = <roleId|eventId>`).
  2. Otherwise, compute mapping: `affectedMembershipIds`/`affectedUserIds` → sessions → `fids` and then emit `AccessTokensRevokedEvent` (or `SessionsRevokedEvent` when session-level revoke is required).
  3. Always dedupe revocation actions and include `initiatedBy` provenance in emitted revocation events for auditability.

#### SessionsRevokedEvent

Được phát khi một hoặc nhiều session bị thu hồi (logout, admin revoke hoặc sự cố bảo mật). Việc thu hồi session có thể được phối hợp với `AccessTokensRevokedEvent` để invalidation các access token liên quan.

| Field           | Type        | Description                                      |
|-----------------|-------------|--------------------------------------------------|
| `sessionIds?`   | `string[]`  | Mảng `sessionId` bị thu hồi                       |
| `userIds?`      | `string[]`  | Danh sách userId liên quan (tùy chọn)             |
| `revokedAt`     | `DateTime`  | Thời điểm thu hồi                                 |
| `reason?`       | `string`    | Lý do (tùy chọn)                                   |
| `initiatedBy?`  | `object`    | Provenance object `{ context: 'azm'|'idm'|'ocs'|'acm'|'admin'|'system', id?: string }` (tùy chọn)      |

### 3.2 OAuth Client Events

#### OAuthClientRegisteredEvent

Được phát khi một OAuth/OIDC client được đăng ký

| Field           | Type         | Description              |
| --------------- | ------------ | ------------------------ |
| `clientId`      | `ClientId`   | Định danh client         |
| `clientName`    | `ClientName` | Tên hiển thị             |
| `grantTypes`    | `string[]`   | Các grant type cho phép  |
| `redirectUris?` | `string[]`   | Redirect URIs đã đăng ký |
| `scopes?`       | `string[]`   | Scopes mặc định          |
| `createdAt`     | `DateTime`   | Thời điểm tạo            |

#### OAuthClientUpdatedEvent

Được phát khi metadata của client được cập nhật

| Field       | Type       | Description            |
| ----------- | ---------- | ---------------------- |
| `clientId`  | `ClientId` | Định danh client       |
| `changes`   | `object`   | Các thay đổi từng phần |
| `updatedAt` | `DateTime` | Thời điểm cập nhật     |

#### OAuthClientSecretRotatedEvent

Được phát khi secret của client được rotate — event KHÔNG BAO GỒM raw secret

| Field       | Type       | Description      |
| ----------- | ---------- | ---------------- |
| `clientId`  | `ClientId` | Định danh client |
| `rotatedAt` | `DateTime` | Thời điểm rotate |

#### OAuthClientRevokedEvent

Được phát khi một client bị revoke

| Field       | Type       | Description      |
| ----------- | ---------- | ---------------- |
| `clientId`  | `ClientId` | Định danh client |
| `revokedAt` | `DateTime` | Thời điểm revoke |
| `reason?`   | `string`   | Lý do (tùy chọn) |

## 4. Domain Services

Phần này liệt kê các Domain Services chính cần có cho BC ACM. Mỗi dịch vụ mô tả API (method), các bất biến nghiệp vụ chính, Aggregate Roots liên quan và các Ports (interfaces) cần để kết nối với hạ tầng hoặc repository.

### 4.1 SessionService

Quản lý lifecycle của session (tạo session, revoke, refresh) và đảm bảo quan hệ giữa session và refresh token.

- `createSession(userId: string, deviceInfo: object, loginMethod: string): Promise<{sessionId: string, refreshToken: string}>`: Tạo session và refresh token liên quan. Trả raw refresh token (opaque) cho caller (client). **Access tokens must include `jti` (JWT ID)**; refresh tokens MUST NOT be persisted raw and are referenced via `refreshTokenHash` in DB/secure store.
- `revokeSession(sessionId: string, reason?: string): Promise<void>`: Thu hồi session (và các token liên quan theo `sessionId`).
- `refreshSession(refreshToken: string): Promise<{accessToken: string, refreshToken?: string, refreshTokenHash: string}>`: Làm mới access token; có thể trả refresh token mới (raw opaque token) cho caller nếu policy yêu cầu, kèm theo một `refreshTokenHash` để lưu tham chiếu trong hệ thống theo ADR-IAM-2.
- `listActiveSessions(userId: string): Promise<any[]>`: Liệt kê sessions đang active cho user.

- **Business Invariants:**
  - Mỗi session luôn có một refresh token liên kết; khi session bị revoke refresh token phải bị revoke (atomic).
  - Khi role/permission thay đổi nên có khả năng thu hồi session liên quan.
    **Aggregate Root**: Session Aggregate Root
    **Ports:** `ISessionRepository`, `ITokenIssuer`, `IRevocationStore`, `IEventStore`

### 4.2 TokenService (TokenIssuer)

Phát hành và verify các token (access JWT, refresh tokens, S2S tokens).

- `issueAccessToken(subject: string, claims: object, expiresIn?: number): Promise<{token: string, tokenReferenceHash: string}>`: Tạo access token (JWT). Trả `token` (raw JWT) cho caller; issuer MUST compute `jti` and `tokenReferenceHash = H(jti)` and return `tokenReferenceHash` (the hash) to be stored in events/read models per ADR-IAM-2. JWT payload MUST include `jti`.
- `issueRefreshToken(sessionId: string, expiresIn?: number): Promise<{token: string, refreshTokenHash: string}>`: Tạo refresh token liên kết session; trả raw refresh token cho caller. The refresh token MUST be persisted only as `refreshTokenHash` (never raw) in the durable store and `refreshTokenHash` should reference that hash.
- `validateAccessToken(token: string): Promise<{valid: boolean, payload?: any}>`: Validate signature/claims and then check revocation by computing `tokenReferenceHash = H(payload.jti)` and consulting the revocation store (Redis) for that hash.

**Business Invariants:**

- Access token xác thực đầu tiên bằng signature/claims; sau đó kiểm tra blacklist/revocation store bằng `tokenReferenceHash` (hash of `jti`) nếu cần (fast path stateless + revocation lookup). Access tokens MUST include `jti` in payload; refresh tokens are validated by `refreshTokenHash` lookup in DB.
  **Aggregate Root**: Session Aggregate Root (logical)
  **Ports:** `ITokenSigner`, `ITokenValidator`, `IRevocationStore`

### 4.3 RevocationService

Quản lý danh sách thu hồi cho **access tokens** bằng `tokenReferenceHash` (hash of `jti`) trong Redis. Revocation lookup được thực hiện bằng `tokenReferenceHash` — khi một access token bị revoked, chỉ cần đánh dấu `token:{tokenReferenceHash}:revoked` trong Redis.

- `revokeTokenByReference(tokenReferenceHash: string, ttl?: number, reason?: string): Promise<void>`: Đánh dấu tokenReferenceHash bị revoked trong revocation store (Redis).
- `isTokenRevoked(tokenReferenceHash: string): Promise<boolean>`: Kiểm tra tokenReferenceHash đã bị revoke hay chưa.

**Business Invariants:**

- Revocation phải được phản ánh cho downstream services với độ trễ nhỏ (Redis replication constraints chấp nhận được theo ADR-IAM-2). Revocation lookup is performed by `tokenReferenceHash`.
  **Aggregate Root**: Session Aggregate Root (logical)
  **Ports:** `IRevocationStore` (Redis)

### 4.4 OAuthClientService

Quản lý lifecycle của OAuth/OIDC client (register, rotate secret, validate redirect URIs).

- `registerClient(payload: any): Promise<ClientId>`: Đăng ký client mới.
- `rotateClientSecret(clientId: string): Promise<void>`: Rotate secret (ghi `rotatedAt` nhưng không lưu raw secret).
- `validateRedirectUri(clientId: string, uri: string): Promise<boolean>`: Kiểm tra URI hợp lệ theo policy.

- **Business Invariants:**
  - Raw client secret không bao giờ xuất hiện trong events/projections.
    **Aggregate Root**: OAuth Client Aggregate Root
    **Ports:** `IOAuthClientRepository`, `IClientSecretHasher`

## 5. Ports

Below is a consolidated list of ports (interfaces) required by the ACM bounded context. Each port describes the primary methods it must expose and a short description so implementers can provide adapters that meet the domain needs.

### ISessionRepository

Quản lý persistence cho Session aggregate and session lifecycle.

- `findById(sessionId: string): Promise<Session | null>`: Tìm session theo id.
- `findActiveSessionsByUserId(userId: string): Promise<Session[]>`: Liệt kê sessions active cho user.
- `save(session: Session): Promise<void>`: Lưu/update session.
- `revoke(sessionId: string, reason?: string): Promise<void>`: Thu hồi session và liên kết refresh token.
- `revokeAllForUser(userId: string): Promise<void>`: Thu hồi tất cả sessions cho user.

### ITokenIssuer / ITokenSigner / ITokenValidator

Phát hành và xác thực tokens (access, refresh, S2S). Separated responsibilities allow different implementations (JWT signer).

- `issueAccessToken(subject: string, claims: object, expiresInMs?: number): Promise<{token: string, tokenReferenceHash: string}>`: Tạo access token (JWT). Trả `token` (raw JWT) và `tokenReferenceHash` (hash of `jti`) để lưu tham chiếu theo ADR-IAM-2. JWT payload MUST include `jti` (JWT ID).
- `issueRefreshToken(sessionId: string, expiresInMs?: number): Promise<{token: string, tokenReferenceHash: string}>`: Tạo refresh token (opaque) liên kết session; trả raw opaque token cho caller cùng `tokenReferenceHash` để lưu tham chiếu theo ADR-IAM-2.
- `validateAccessToken(token: string): Promise<{valid: boolean, payload?: any}>`: Verify signature/claims and return payload.
- `sign(payload: object): Promise<string>`: (ITokenSigner) Sign payload (JWT).
- `verify(token: string): Promise<{valid: boolean, payload?: any}>`: (ITokenValidator) Verify signature and claims.

### IRevocationStore

Store for token/session revocation (Redis blackout list per ADR-IAM-2).

- `revokeSession(sessionId: string, ttlSeconds?: number, reason?: string): Promise<void>`: Đánh dấu sessionId bị revoked trong revocation store.
- `isRevoked(sessionId: string): Promise<boolean>`: Kiểm tra sessionId đã bị revoke hay chưa.

### IOAuthClientRepository / IClientSecretHasher

Persistence and secret hashing for OAuth/OIDC clients.

- `findById(clientId: string): Promise<OAuthClient | null>`: Tìm client theo id.
- `findByClientId(clientPublicId: string): Promise<OAuthClient | null>`: Tìm client theo public client id.
- `save(client: OAuthClient): Promise<void>`: Lưu/update client.
- `revoke(clientId: string): Promise<void>`: Revoke client.
- `hash(secret: string): Promise<string>`: (IClientSecretHasher) Hash raw client secret.
- `verify(secret: string, hash: string): Promise<boolean>`: Verify client secret against hash.
- `hash(secret: string): Promise<string>`: (IClientSecretHasher) Hash raw client secret using Argon2id and current params.
- `verify(secret: string, hash: string): Promise<boolean>`: Verify client secret against hash.
- `needsRehash(hash: string): Promise<boolean>`: Return true when stored hash params are outdated and rehash is recommended.

### IEventStore

Source-of-truth event store (EventStoreDB semantics assumed). Adapter must support append and read semantics used by aggregates and workers.

- `append(streamId: string, events: DomainEvent[]): Promise<void>`: Ghi events vào stream (append-only).
- `read(streamId: string, fromPosition?: number, limit?: number): Promise<DomainEvent[]>`: Đọc events từ stream.
- `subscribe(streamId: string, handler: (e: DomainEvent)=>Promise<void>): Promise<Subscription>`: Subscribe / persistent subscription support.

### ISnapshotStore

Snapshot store used to speed up aggregate rehydration (ADR-IAM-5).

- `saveSnapshot(aggregateId: string, snapshot: any, version?: string): Promise<void>`: Lưu snapshot.
- `loadSnapshot(aggregateId: string): Promise<{snapshot: any, version?: string} | undefined>`: Lấy snapshot mới nhất.
- `deleteSnapshot(aggregateId: string): Promise<void>`: Xóa snapshot.

```
