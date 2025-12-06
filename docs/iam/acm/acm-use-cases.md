# ACM — Mô tả hành vi của Bounded Context (ACM)

Tệp này chứa các kịch bản hành vi (Gherkin) cho Access Management (ACM), bao gồm vòng đời phiên (session) và token, quay vòng refresh token và phát hiện tái sử dụng, điều phối thu hồi (revocation), xác thực/introspection token, quản lý OAuth client, và xử lý các sự kiện kích hoạt từ các bounded context khác (IDM/AZM/OCS).

## 1. Kịch bản hành vi (Functional Behavior Specifications)

### Tạo Session (Đăng nhập)

```gherkin
Feature: Session Creation (Login)
  As an end user or client
  I want to authenticate and obtain an Access Token (AT) and Refresh Token (RT)
  So that I can access protected resources and refresh sessions securely

  Scenario: Đăng nhập thành công (mật khẩu)
    Given người dùng (`User`) tồn tại và `password` hợp lệ
    When thực thi `AuthenticateCommand` với thông tin đăng nhập và `deviceInfo`
    Then phát `SessionCreatedEvent` chứa `sessionId`, `userId`, `fid`, `refreshTokenHash`, `issuedAt`
    And phát `AccessTokenIssuedEvent` chứa `tokenReferenceHash` (H(jti)), `fid`, `issuedAt`
    And phát `RefreshTokenIssuedEvent` chứa `refreshTokenHash` và `issuedAt`
    And raw `refreshToken` chỉ trả cho caller một lần (KHÔNG được lưu hoặc phát ra sự kiện)

  Scenario: Đăng nhập thất bại (thông tin sai)
    Given người dùng (`User`) tồn tại
    And thông tin đăng nhập không hợp lệ
    When thực thi `AuthenticateCommand`
    Then trả về lỗi `InvalidCredentials`
    And không append bất kỳ sự kiện session hoặc token nào
```

---

### Refresh Token & Quay vòng (Rotation)

```gherkin
Feature: Refresh Token Rotation & Refresh
  As a client
  I want to exchange a Refresh Token for a new Access Token (and possibly rotate RT)
  So that sessions remain secure and reuse detection works

  Scenario: Refresh kèm quay vòng (thành công)
    Given `Session` tồn tại và `refreshTokenHash` đã được lưu
    And client cung cấp raw `refreshToken` khớp với `refreshTokenHash` đã lưu
    When thực thi `RefreshSessionCommand`
    Then cấp Access Token mới và có thể quay vòng Refresh Token
    And phát `AccessTokenIssuedEvent` với `tokenReferenceHash` mới và `fid`
    And nếu quay vòng RT thì phát `RefreshRotatedEvent` chứa `oldRefreshTokenHash` và `newRefreshTokenHash`
    And trả raw RT mới cho caller (caller phải lưu an toàn)

  Scenario: Refresh thất bại do refresh token không hợp lệ/không biết
    Given client cung cấp `refreshToken` không khớp hoặc đã bị revoke
    When thực thi `RefreshSessionCommand`
    Then trả về `InvalidOrExpiredRefreshToken`
    And không append sự kiện cấp token nào

  Scenario: Phát hiện tái sử dụng refresh token (nghi ngờ bị lộ)
    Given logic phát hiện tái sử dụng refresh token cho một session
    When phát hiện tái sử dụng trong `RefreshSessionCommand`
    Then coi là compromise và phát `SessionsRevokedEvent` cho session bị ảnh hưởng
    And phát `AccessTokensRevokedEvent` cho `fids` liên quan
    And trả lỗi `RefreshTokenReuseDetected` cho caller
```

---

### Logout và Thu hồi Session

```gherkin
Feature: Logout and Session Revocation
  As a user or admin
  I want to revoke sessions and tokens
  So that stolen or unwanted sessions are invalidated

  Scenario: User-initiated logout
    Given `Session` tồn tại và đang active
    When thực thi `LogoutCommand` với `sessionId`
    Then phát `SessionRevokedEvent` (chứa `sessionId`, `userId`, `revokedAt`)
    And đánh dấu `refreshTokenHash` là revoked trong projection

  Scenario: Admin thu hồi nhiều session
    Given admin yêu cầu revoke cho `sessionIds` hoặc `userId`
    When thực thi `RevokeSessionsCommand`
    Then phát `SessionsRevokedEvent` với `sessionIds`/`userIds`, `revokedAt`, `initiatedBy`
    And tùy chọn phát `AccessTokensRevokedEvent` với `fids` để invalidation nhanh
```

---

### Thu hồi theo fid (family invalidation)

```gherkin
Feature: Family (fid) Revocation
  As the platform
  I want to invalidate whole Access Token families quickly
  So that tokens issued under an old permission set are invalidated fast

  Scenario: Revoke by fid
    Given chính sách yêu cầu invalidation cho `fid`
    When thực thi `RevokeByFidCommand` với `fids`
    Then phát `AccessTokensRevokedEvent` với `fids`, `revokedAt`, `reason`
    And cập nhật revocation projection (Redis) để lookup nhanh
```

---

### Xác thực token / Introspection

```gherkin
Feature: Token Validation / Introspection
  As an internal service or gateway
  I want to validate Access Tokens and check revocation
  So that requests are authorized and revoked tokens are rejected

  Scenario: Xác thực access token thành công
    Given client cung cấp Access Token (JWT) có `jti`
    When gọi `ValidateAccessToken`
    Then verify chữ ký và claims
    And tính `tokenReferenceHash = H(jti)` và kiểm tra revocation store
    And trả về `valid: true` kèm payload nếu không bị revoke

  Scenario: Xác thực access token bị từ chối do đã bị revoke
    Given `tokenReferenceHash` của token tồn tại trong revocation store
    When gọi `ValidateAccessToken`
    Then trả về `valid: false` (revoked)
```

---

### Xử lý trigger từ IDM/AZM/OCS (Điều phối thu hồi)

```gherkin
Feature: Revocation Orchestration (Trigger Handling)
  As ACM
  I want to consume trigger events from IDM/AZM/OCS and decide revocation actions
  So that revocation is authoritative, deduped, and auditable

  Scenario: Xử lý trigger `UserAccountSuspendedEvent`
    Given ACM nhận `UserAccountSuspendedEvent` (initiatedBy: IDM)
    When xử lý trigger
    Then ACM tính toán các `sessionIds`/`fids` bị ảnh hưởng và phát `SessionsRevokedEvent` và/hoặc `AccessTokensRevokedEvent`
    And các event phát ra bao gồm provenance `initiatedBy` và `reason`

  Scenario: Xử lý trigger `RolePermissionsChangedEvent` từ AZM
    Given `RolePermissionsChangedEvent` có thể chứa các hint tùy chọn (`affectedFids`, `affectedTokenReferenceHashes`)
    When ACM xử lý event
    Then nếu có hint, ACM có thể fast-path revoke các family/token đó bằng cách phát `AccessTokensRevokedEvent`
    Else ACM tính toán các session bị ảnh hưởng qua projections và phát các event thu hồi phù hợp
```

---

### Quản lý OAuth Client

```gherkin
Feature: OAuth Client Lifecycle
  As an admin or system integrator
  I want to manage OAuth clients and secrets securely
  So that confidential clients keep secrets hashed and rotation is auditable

  Scenario: Đăng ký OAuth client (confidential)
    Given admin cung cấp cấu hình client và raw secret
    When thực thi `RegisterOAuthClientCommand`
    Then lưu `clientId`, `clientSecretHash` (Argon2id), `redirectUris`, `grantTypes`
    And phát `OAuthClientRegisteredEvent` (KHÔNG được include raw secret)

  Scenario: Quay vòng client secret
    Given client confidential tồn tại
    When thực thi `RotateClientSecretCommand`
    Then lưu `clientSecretHash` mới và phát `OAuthClientSecretRotatedEvent` (không phát raw secret)
```

---

### Kỳ vọng Read-Your-Own-Writes (RYOW)

Đối với các lệnh ACM cập nhật projections dùng cho quyết định phân quyền (tạo/quay vòng/thu hồi session), handler của lệnh NÊN trả về một `projection-checkpoint` hoặc processing token để client có thể poll, HOẶC document một chiến lược timeout/backoff để client truy vấn read model cho đến khi thay đổi hiển thị (xem `ADR-IAM-9`).

---

### Bảo mật & Ngữ nghĩa sự kiện (Cross-cutting)

- KHÔNG bao giờ phát raw secrets (refresh tokens thô, raw client secrets, raw jti). Chỉ lưu/phát các giá trị đã băm/hash (`refreshTokenHash`, `clientSecretHash`, `tokenReferenceHash`).
- Các event khởi tạo thu hồi PHẢI bao gồm provenance `initiatedBy` và tùy chọn `revocationHints` (`fids`, `tokenReferenceHashes`, `sessionIds`) để hỗ trợ ACM fast-path revocation khi thích hợp (`ADR-IAM-10`).
- Khi phát hiện tái sử dụng refresh token, xử lý như compromise: phát các event thu hồi và annotate với `reason: 'refresh_token_reuse'` và `initiatedBy: 'acm'`.

---

### Đề xuất kiểm thử chấp nhận (ngắn)

- Kiểm tra rằng `SessionCreatedEvent` và `RefreshTokenIssuedEvent` không bao giờ chứa raw RT.
- Kiểm tra luồng quay vòng RT (happy path) và đảm bảo `RefreshRotatedEvent` chứa cả hash cũ và mới.
- Kiểm tra rằng phát hiện tái sử dụng refresh-token dẫn đến `SessionsRevokedEvent` và `AccessTokensRevokedEvent`.
- Kiểm tra xử lý trigger `UserAccountSuspendedEvent` dẫn đến ACM phát các event thu hồi (bao gồm `initiatedBy`).

---

### Thu hồi token (RFC 7009)

```gherkin
Feature: Token Revocation (RFC7009)
  As a client or user
  I want to revoke a Refresh Token or Access Token
  So that tokens are invalidated when user signs out or uninstalls the app

  Scenario: Client-initiated refresh token revocation (RFC7009)
    Given client xác thực bằng client credentials hoặc chứng minh quyền sở hữu
    And raw `refresh_token` được trình bày
    When gọi endpoint `RevokeToken`
    Then map raw token sang `refreshTokenHash` và đánh dấu nó bị revoke
    And phát `SessionRevokedEvent` hoặc `RefreshTokenRevokedEvent` tùy theo chính sách
    And trả về thành công (HTTP 200) mà không tiết lộ trạng thái

  Scenario: Server-side revoke theo sessionId (admin)
    Given admin yêu cầu revoke cho `sessionId`
    When thực thi `RevokeSessionCommand`
    Then phát `SessionRevokedEvent` và `AccessTokensRevokedEvent` cho `fids` liên quan
```

---

### Quản lý Session (Liệt kê / Lấy / Thu hồi)

```gherkin
Feature: Session Management
  As a user or admin
  I want to list and manage active sessions
  So that I can inspect and revoke device sessions

  Scenario: Người dùng liệt kê các session đang hoạt động của mình
    Given người dùng đã xác thực
    When gọi `ListActiveSessions` cho `userId`
    Then trả về danh sách session với `sessionId`, `deviceInfo`, `lastActiveAt`, `expiresAt`, `fid`, `mfaVerified`

  Scenario: Admin liệt kê session cho một user
    Given admin được ủy quyền
    When gọi `AdminListSessions(userId)`
    Then trả về sessions và khả năng revoke theo `sessionId`

  Scenario: Người dùng thu hồi một session từ UI
    Given `sessionId` thuộc về người dùng
    When thực thi `RevokeSessionCommand` cho `sessionId` đó
    Then phát `SessionRevokedEvent` và cập nhật projections
```

---

### Client Credentials & Service Tokens

```gherkin
Feature: Client Credentials and Service Tokens
  As a service or integrator
  I want to obtain service tokens and manage client credentials
  So that services authenticate and ACM can revoke/inspect service tokens

  Scenario: Client Credentials grant (service token)
    Given client tồn tại và có `clientId` và `clientSecret` hợp lệ
    When gọi `TokenEndpoint` với `grant_type=client_credentials`
    Then cấp JWT access token có `jti`, tính `tokenReferenceHash = H(jti)` và phát `AccessTokenIssuedEvent` (include `clientId`)

  Scenario: Thu hồi token client sau quay vòng secret
    Given secret của client đã quay vòng
    When thực thi `RotateClientSecretCommand`
    Then phát `OAuthClientSecretRotatedEvent` và tùy chọn `AccessTokensRevokedEvent` cho `clientId` tùy chính sách
```

---

### Làm rõ vòng đời Refresh Token và xử lý tái sử dụng

```gherkin
Feature: Refresh Token Lifecycle Clarifications
  As implementers
  I want clear rules for marking RTs used and handling reuse
  So that security behavior is unambiguous

  Scenario: Đánh dấu refresh token đã sử dụng khi quay vòng
    Given RT hợp lệ và chính sách quay vòng là một lần sử dụng
    When `RefreshSessionCommand` quay vòng RT
    Then persist `newRefreshTokenHash` và đánh dấu `oldRefreshTokenHash` là used/revoked

  Scenario: Hệ quả khi phát hiện tái sử dụng
    Given phát hiện tái sử dụng cho `oldRefreshTokenHash`
    When phát hiện xảy ra
    Then phát `SessionsRevokedEvent` cho chủ session và `AccessTokensRevokedEvent` cho `fids` liên quan
```

---

### MFA / Step-up Authentication (phía ACM)

```gherkin
Feature: MFA Enforcement & Step-up
  As ACM
  I want to require MFA verification for sessions and step-up for sensitive actions
  So that higher-risk operations require additional assurance

  Scenario: Đăng nhập yêu cầu step-up MFA
    Given người dùng bật MFA (IDM)
    When `AuthenticateCommand` thành công nhưng MFA chưa được xác thực cho session
    Then trả về yêu cầu challenge và tạo session với `mfaVerified=false`
    And khi `VerifySessionMfaCommand` được thực thi với mã hợp lệ
    Then đặt `mfaVerified=true` và phát `SessionMfaVerifiedEvent` để cập nhật projection

  Scenario: Step-up trong hành động nhạy cảm
    Given `mfaVerified=false` và người dùng yêu cầu hành động nhạy cảm
    When ACM yêu cầu step-up
    Then yêu cầu xác thực bổ sung và khi thành công đặt `mfaVerified=true` cho session đó
```

---

### Introspection Endpoint (theo RFC 7662)

```gherkin
Feature: Token Introspection
  As a resource server or gateway
  I want to introspect tokens
  So that I can obtain token claims and revocation state

  Scenario: Introspect JWT access token
    Given trình bày JWT Access Token
    When gọi `Introspect`
    Then verify chữ ký và tính `tokenReferenceHash = H(jti)`
    And nếu không bị revoke trả `active: true` và các claim tiêu chuẩn (sub, aud, exp, scope, client_id, jti)

  Scenario: Introspect opaque token
    Given trình bày opaque token (ví dụ RT hoặc S2S opaque)
    When gọi `Introspect`
    Then map sang `refreshTokenHash` hoặc biểu diễn lưu trữ, kiểm tra revocation, và trả `active: true/false` kèm metadata
```

## 2. Yêu cầu phi chức năng (Non-functional Behavior Specifications)

### ACM Command Liveness Health Check

```gherkin
Feature: Acm Command Liveness Health Check
  Scenario: Kiểm tra liveness healthy trả về trạng thái healthy
    Given tiến trình dịch vụ `acm-command` đã được khởi động và đang chạy
    When operator hoặc orchestrator gọi `GET /health/liveness`
    Then dịch vụ trả về HTTP 200
    And nội dung response có trường `message` = "Service still alive"
```

### ACM Command Readiness Health Check

```gherkin
Feature: Acm Command Readiness Health Check
  Scenario: Kiểm tra readiness healthy trả về trạng thái healthy
    When operator hoặc orchestrator gọi `GET /health/ready`
    Then dịch vụ trả về HTTP 200
    And body của response là `ISuccessResponse<HealthDetails>` với `data` ánh xạ các khóa component tới `ServiceHealthStatus.UP` (ví dụ `{ postgresql: 'up', redis: 'up', eventstoredb: 'up', rabbitmq: 'up' }`)

  Scenario: Readiness khi PostgreSQL (projection DB) bị down
    Given PostgreSQL (dùng cho projections/read models) không khả dụng
    When operator gọi `GET /health/ready`
    Then dịch vụ trả về HTTP 503
    And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ postgresql: ServiceHealthStatus.DOWN }` (các component khác có thể là `UP`/`UNKNOWN` tùy trường hợp)

  Scenario: Readiness khi Redis (revocation cache) bị down
    Given Redis (revocation cache nhanh) không khả dụng
    When operator gọi `GET /health/ready`
    Then dịch vụ trả về HTTP 503
    And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ redis: ServiceHealthStatus.DOWN }`

  Scenario: Readiness khi EventStoreDB (event store) bị down
    Given EventStoreDB (event store authoritative) không khả dụng
    When operator gọi `GET /health/ready`
    Then dịch vụ trả về HTTP 503
    And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ eventstoredb: ServiceHealthStatus.DOWN }`

  Scenario: Readiness khi RabbitMQ (message bus) bị down
    Given RabbitMQ (message bus) không khả dụng
    When operator gọi `GET /health/ready`
    Then dịch vụ trả về HTTP 503
    And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ rabbitmq: ServiceHealthStatus.DOWN }`

  Scenario: Readiness khi Elasticsearch (search/index) bị down (non-critical)
    Given Elasticsearch (search/index) không khả dụng
    When operator gọi `GET /health/ready`
    Then dịch vụ trả về HTTP 200
    And body của response là `ISuccessResponse<HealthDetails>` trong đó `data.elasticsearch` là `ServiceHealthStatus.UNKNOWN` (được dùng để biểu diễn degraded/partially-available) và thông điệp tổng thể chỉ ra `ready (degraded)`

  Scenario: Readiness khi nhiều thành phần critical bị down
    Given PostgreSQL và Redis đều không khả dụng
    When operator gọi `GET /health/ready`
    Then dịch vụ trả về HTTP 503
    And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ postgresql: ServiceHealthStatus.DOWN, redis: ServiceHealthStatus.DOWN }`
```

### ACM Query Liveness Health Check

```gherkin
Feature: Acm Query Liveness Health Check
  Scenario: Kiểm tra liveness của `acm-query`
    Given tiến trình dịch vụ `acm-query` đã được khởi động và đang chạy
    When operator hoặc orchestrator gọi `GET /health/liveness` trên `acm-query`
    Then dịch vụ trả về HTTP 200
    And nội dung response có trường `message` = "Service still alive"
```

### ACM Query Readiness Health Check

```gherkin
Feature: Acm Query Readiness Health Check
  Scenario: Kiểm tra readiness healthy cho `acm-query`
    When operator gọi `GET /health/ready` trên `acm-query`
    Then dịch vụ trả về HTTP 200
    And body của response là `ISuccessResponse<HealthDetails>` với `data` ánh xạ các khóa component tới `ServiceHealthStatus.UP` (ví dụ `{ postgresql: 'up', redis: 'up', elasticsearch: 'up' }`) và optional `metadata.checkedAt`

  Scenario: Readiness khi PostgreSQL (read models) cho `acm-query` bị down
    Given PostgreSQL (read models) không khả dụng cho `acm-query`
    When operator gọi `GET /health/ready` trên `acm-query`
    Then dịch vụ trả về HTTP 503
    And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ postgresql: ServiceHealthStatus.DOWN }`

  Scenario: Readiness khi Elasticsearch (search/index) cho `acm-query` bị down (degraded)
    Given Elasticsearch (search/index) không khả dụng cho `acm-query`
    When operator gọi `GET /health/ready` trên `acm-query`
    Then dịch vụ trả về HTTP 200
    And body của response là `ISuccessResponse<HealthDetails>` trong đó `data.elasticsearch` là `ServiceHealthStatus.UNKNOWN` và thông điệp tổng thể chỉ ra `ready (degraded)`

  Scenario: Readiness khi Redis (cache) cho `acm-query` bị down
    Given Redis (cache) không khả dụng cho `acm-query`
    When operator gọi `GET /health/ready` trên `acm-query`
    Then dịch vụ trả về HTTP 503
    And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ redis: ServiceHealthStatus.DOWN }`
```

### ACM Projector Liveness Health Check

```gherkin
Feature: Acm Projector Liveness Health Check
  Scenario: Kiểm tra liveness của `acm-projector`
    Given tiến trình dịch vụ `acm-projector` đã được khởi động và đang chạy
    When operator hoặc orchestrator gọi `GET /health/liveness` trên `acm-projector`
    Then dịch vụ trả về HTTP 200
    And nội dung response có trường `message` = "Service still alive"
```

### ACM Projector Readiness Health Check

```gherkin
Feature: Acm Projector Readiness Health Check
  Scenario: Kiểm tra readiness healthy cho `acm-projector`
    When operator gọi `GET /health/ready` trên `acm-projector`
    Then dịch vụ trả về HTTP 200
    And body của response là `ISuccessResponse<HealthDetails>` với `data` ánh xạ các khóa component tới `ServiceHealthStatus.UP` (ví dụ `{ eventstoredb: 'up', postgresql: 'up', redis: 'up', rabbitmq: 'up' }`) và optional `metadata.checkedAt`

  Scenario: Readiness khi EventStoreDB (event store) cho `acm-projector` bị down
    Given EventStoreDB (event store) không khả dụng cho `acm-projector`
    When operator gọi `GET /health/ready` trên `acm-projector`
    Then dịch vụ trả về HTTP 503
    And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ eventstoredb: ServiceHealthStatus.DOWN }`

  Scenario: Readiness khi PostgreSQL (projections DB) cho `acm-projector` bị down
    Given PostgreSQL (projections) không khả dụng cho `acm-projector`
    When operator gọi `GET /health/ready` trên `acm-projector`
    Then dịch vụ trả về HTTP 503
    And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ postgresql: ServiceHealthStatus.DOWN }`

  Scenario: Readiness khi Redis hoặc RabbitMQ cho `acm-projector` bị down
    Given Redis hoặc RabbitMQ không khả dụng cho `acm-projector`
    When operator gọi `GET /health/ready` trên `acm-projector`
    Then dịch vụ trả về HTTP 503
    And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ redis: ServiceHealthStatus.DOWN }` or `{ rabbitmq: ServiceHealthStatus.DOWN }` accordingly

  Scenario: Readiness khi Elasticsearch (indexing) cho `acm-projector` bị down (degraded)
    Given Elasticsearch (indexing) không khả dụng cho `acm-projector`
    When operator gọi `GET /health/ready` trên `acm-projector`
    Then dịch vụ trả về HTTP 200
    And body của response là `ISuccessResponse<HealthDetails>` trong đó `data.elasticsearch` là `ServiceHealthStatus.UNKNOWN` (degraded) và thông điệp tổng thể chỉ ra `ready (degraded)`
```

## 3. Commands

### AuthenticateCommand

- Payload: `identifier` (email/username), `password`, `deviceInfo` (optional), `mfaHint` (optional)
- Validation: credentials format, account not suspended/locked, rate-limited
- Aggregate: `acm-session-<sessionId>` (new session stream) and `acm-user-<userId>` for session-affecting aggregates
- Events emitted: `SessionCreatedEvent`, `AccessTokenIssuedEvent`, `RefreshTokenIssuedEvent`
- Notes: raw refresh tokens MUST NOT be persisted or emitted; only hashes. Handler should return raw RT to caller securely.

### RefreshSessionCommand

- Payload: raw `refreshToken`, optional `deviceInfo`
- Validation: token format, not revoked, reuse detection checks
- Aggregate: `acm-session-<sessionId>` (append rotation/issue events)
- Events emitted: `AccessTokenIssuedEvent`, optional `RefreshRotatedEvent`
- Notes: on reuse detection emit `SessionsRevokedEvent` and handle as compromise.

### LogoutCommand / RevokeSessionCommand

- Payload: `sessionId` (or list of `sessionIds`), optional `initiatedBy`
- Validation: session exists and caller authorized
- Aggregate: `acm-session-<sessionId>` streams
- Events emitted: `SessionRevokedEvent` or `SessionsRevokedEvent`

### RevokeByFidCommand

- Payload: `fids` (array), `initiatedBy`, `reason`
- Validation: caller authorized (admin/service)
- Aggregate: revocation projection writes; authoritative events appended to `acm-revocation-<id>` stream
- Events emitted: `AccessTokensRevokedEvent`

### RegisterOAuthClientCommand

- Payload: `clientId`, raw `clientSecret` (confidential), `redirectUris`, `grantTypes`, metadata
- Validation: clientId uniqueness (guard stream), secret complexity
- Aggregate: `acm-oauthclient-<clientId>` stream
- Events emitted: `OAuthClientRegisteredEvent` (never include raw secret)

### RotateClientSecretCommand

- Payload: `clientId`, raw `newSecret`, `initiatedBy`
- Validation: client exists and caller authorized
- Aggregate: `acm-oauthclient-<clientId>` stream
- Events emitted: `OAuthClientSecretRotatedEvent`

### RevokeTokenCommand (RFC7009 style)

- Payload: raw `token` or `tokenReferenceHash`, `clientId`/`sessionId` for auth
- Validation: proof of possession and authorization
- Aggregate: `acm-session-<sessionId>` / revocation stream
- Events emitted: `SessionRevokedEvent` or `RefreshTokenRevokedEvent`

### VerifySessionMfaCommand

- Payload: `sessionId`, `mfaAssertion`
- Validation: assertion validity via `IMFAProvider`/IDM ports
- Aggregate: `acm-session-<sessionId>` stream
- Events emitted: `SessionMfaVerifiedEvent`

## 4. Queries

### ValidateAccessToken

- Payload: raw Access Token (JWT)
- Returns: `{ valid: boolean, claims?: {...}, reason?: string }`
- Source: ACM token verification logic + revocation store (Redis/projection)
- Notes: compute `tokenReferenceHash = H(jti)` and consult fast revocation store.

### IntrospectToken

- Payload: raw token or `tokenReferenceHash`
- Returns: `{ active: boolean, sub, aud, exp, client_id, scope, jti }`
- Source: signature verification + revocation projection

### ListActiveSessions

- Payload: `userId`, optional pagination
- Returns: list of sessions with `sessionId`, `deviceInfo`, `lastActiveAt`, `expiresAt`, `fid`, `mfaVerified`
- Source: session projections (Postgres/ES)

### AdminListSessions

- Payload: `userId`, admin credentials, filters
- Returns: same as `ListActiveSessions` with extra admin fields (ip, lastSeen)
- Source: session projections

### GetSessionById

- Payload: `sessionId`
- Returns: session detail or not found
- Source: session projection

### GetRevocationStatus

- Payload: `tokenReferenceHash` or `fid`
- Returns: `{ revoked: boolean, revokedAt?: timestamp }`
- Source: revocation projection (Redis + Postgres backup)

### GetOAuthClient

- Payload: `clientId`
- Returns: client metadata (no secrets)
- Source: oauth client projection

### GetSessionMfaStatus

- Payload: `sessionId`
- Returns: `{ mfaVerified: boolean }`
- Source: session projection

---

## 5. Workflows

### Giới thiệu

ACM quản lý vòng đời session, token, revocation, MFA, OAuth client và orchestration các trigger từ IDM/AZM/OCS. Nhiều quy trình nghiệp vụ gồm nhiều bước, có trạng thái trung gian, cần orchestration hoặc xử lý sự kiện bất đồng bộ.

### Danh sách các Workflow chính

- **Đăng nhập & tạo session:**
  - AuthenticateCommand → SessionCreatedEvent, AccessTokenIssuedEvent, RefreshTokenIssuedEvent.
  - Nếu MFA yêu cầu, session ở trạng thái mfaVerified=false, chờ VerifySessionMfaCommand.

- **Refresh/rotation & reuse detection:**
  - RefreshSessionCommand → AccessTokenIssuedEvent, RefreshRotatedEvent (nếu có), kiểm tra reuse.
  - Nếu reuse phát hiện, emit SessionsRevokedEvent, AccessTokensRevokedEvent.

- **Revocation orchestration (trigger từ IDM/AZM/OCS):**
  - Nhận các trigger event (UserAccountSuspendedEvent, RolePermissionsChangedEvent, ...), tính toán affected sessions/fids, emit SessionsRevokedEvent, AccessTokensRevokedEvent.

- **MFA/step-up:**
  - Khi login hoặc sensitive action yêu cầu MFA, session ở trạng thái mfaVerified=false, chờ VerifySessionMfaCommand.
  - Khi xác thực thành công, emit SessionMfaVerifiedEvent.

- **OAuth client lifecycle:**
  - RegisterOAuthClientCommand, RotateClientSecretCommand → OAuthClientRegisteredEvent, OAuthClientSecretRotatedEvent, có thể trigger AccessTokensRevokedEvent khi rotate secret.

- **Token revocation (RFC7009):**
  - RevokeTokenCommand → SessionRevokedEvent hoặc RefreshTokenRevokedEvent, update revocation projection.

- **Session management (list/revoke):**
  - ListActiveSessions, AdminListSessions, RevokeSessionCommand, update projections, emit SessionRevokedEvent.

- **Client credentials/service tokens:**
  - TokenEndpoint (client_credentials grant) → AccessTokenIssuedEvent, revoke khi RotateClientSecretCommand.

---

## 6. Process Manager

### Giới thiệu

Process Manager (Saga/Orchestrator) trong ACM điều phối các workflow nhiều bước, lắng nghe sự kiện, phát sinh command tiếp theo, xử lý timeout, retry, hoặc orchestration giữa nhiều aggregate/stream.

### Đề xuất các Process Manager

- **SessionMfaProcessManager:** Theo dõi trạng thái session mfaVerified, orchestration login/step-up, timeout, retry.
- **RefreshReuseDetectionProcessManager:** Theo dõi refresh token reuse, orchestration revoke affected sessions/tokens khi phát hiện reuse.
- **RevocationOrchestrationProcessManager:** Lắng nghe trigger từ IDM/AZM/OCS, tính toán affected sessions/fids, orchestration emit revocation events.
- **OAuthClientSecretRotationManager:** Orchestrate revoke tokens khi rotate client secret.

### Lưu ý thực thi

- Các process manager nên event-driven, subscribe các event liên quan, lưu trạng thái process (saga state), đảm bảo idempotency và khả năng retry.
- Có thể bổ sung bảng trạng thái process (process state table) để tracking các workflow dài hơi.
