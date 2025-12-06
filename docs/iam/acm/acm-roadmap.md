# ACM Roadmap

## Sprint 0

Mục tiêu Sprint 0 (Bootstrapping): tạo skeleton codebase và các cấu hình vận hành cơ bản để các sprint sau có một nền tảng triển khai nhất quán.

- Thiết lập skeleton repo/service (monorepo layout, minimal service scaffold) cho IDM với README, Dockerfile
- Thiết lập logging cơ bản (structured JSON logs, correlation IDs) và guideline cho log levels.
- Thêm OpenTelemetry (OTel) skeleton: traces + metrics exporter config (dev/observability defaults), starter instrumentation and docs how-to enable.
- Thêm healthcheck endpoints (liveness / readiness) and basic readiness checks (DB, event-store, dependencies), plus simple local healthcheck script for dev and CI.
- Thiết lập e2e test skeleton for healthcheck probe.

### Tiêu chí chấp nhận (Acceptance Criteria)

- Skeleton repository present with clear `README.md` and scripts to run local dev, tests and containerized service.
- Structured logging enabled and documented; sample logs emitted by a tiny hello endpoint.
- OpenTelemetry configured for local dev with an example trace emitted by a sample request.
- Liveness/readiness endpoints implemented and covered by a simple healthcheck test in CI.
- e2e test skeleton for healthcheck probe present.

## Sprint 1

Mục tiêu Sprint 1 (MVP): thiết lập khả năng quản lý phiên và token cơ bản, introspection và revocation đơn giản để phục vụ các luồng business-critical.

- Implement session issuance and introspection endpoints.
- Implement access token issuance (opaque or JWT adapter) and refresh token support.
- Implement basic revocation endpoint and revocation hint events for downstream systems (emit `SessionRevokedEvent`).

### Tiêu chí chấp nhận (Acceptance Criteria)

- [Session Issuance](acm-use-cases.md#session-issuance): issue valid access tokens and refresh tokens; tokens include required claims and expiry.
- [Introspection](acm-use-cases.md#introspection): introspection endpoint returns token active flag and metadata; invalid tokens return inactive.
- [Revocation (basic)](acm-use-cases.md#revocation-basic): revoking a token prevents subsequent introspection from returning active; revocation hints emitted to revocation stream.

### Không nằm trong phạm vi sprint:

- Advanced rotation/reuse-detection; bulk/offline revocation mechanisms.

### Milestones

#### Sprint 1.1

Core Session & Token Issuance

- Implement token issuance endpoints (`/token`) for access and refresh tokens; support client credentials and initial auth code skeleton.
- Acceptance: tokens are issued with correct claims and backed by unit tests validating claim composition and expiry.

**Acceptance Criteria (mapped)**

- [Session Issuance](acm-use-cases.md#session-issuance)

#### Sprint 1.2

Introspection & Basic Revocation

- Implement `/introspect` endpoint and `/revoke` API that emits `SessionRevokedEvent` and writes revocation hints to a durable revocation stream.
- Acceptance: revoked tokens report inactive on introspection and revocation events are consumable by downstream services.

**Acceptance Criteria (mapped)**

- [Introspection](acm-use-cases.md#introspection)
- [Revocation (basic)](acm-use-cases.md#revocation-basic)

## Sprint 2

Sprint 2 tập trung vào hoàn thiện token lifecycle: rotation, reuse detection và quản lý client.

- Implement refresh token rotation and reuse detection flows.
- Implement client registration/management APIs (create/update/delete client, rotate client secrets) and persistent storage.
- Add revocation propagation reliability (retries/ack semantics) and basic rate-limiting on token endpoints.

### Tiêu chí chấp nhận (Acceptance Criteria)

- [Refresh Token Rotation](acm-use-cases.md#refresh-token-rotation): rotation invalidates previous refresh token; reuse detection emits `RefreshTokenReuseDetected` and invalidates session.
- [Client Management](acm-use-cases.md#client-management): client CRUD and secret rotation supported; emits `ClientCreatedEvent` / `ClientSecretRotatedEvent`.
- [Revocation Propagation](acm-use-cases.md#revocation-propagation): revocation hints are delivered reliably to downstream consumers.

### Không nằm trong phạm vi sprint:

- Full enterprise client portal UX; advanced caching at edge.

### Milestones

#### Sprint 2.1

Refresh Token Rotation & Reuse Detection

- Implement refresh rotation: on refresh, issue new refresh token and mark previous as rotated; detect reuse and emit `RefreshTokenReuseDetected`.
- Acceptance: rotated refresh tokens cannot be used; reuse triggers alert and session invalidation.

**Acceptance Criteria (mapped)**

- [Refresh Token Rotation](acm-use-cases.md#refresh-token-rotation)

#### Sprint 2.2

Client Management & Revocation Reliability

- Implement client registration, secret rotation APIs and persistence; add durable revocation publishing with retries/ack.
- Acceptance: client CRUD emits events and revocation messages are durable/acknowledged.

**Acceptance Criteria (mapped)**

- [Client Management](acm-use-cases.md#client-management)
- [Revocation Propagation](acm-use-cases.md#revocation-propagation)

## Sprint 3

Sprint 3 tập trung vào bảo mật nâng cao và observability: key rotation (JWKS), introspection enrichment, và analytics cho reuse/abuse detection.

- Implement key rotation & JWKS support for token verification.
- Enhance introspection metadata (session/actor metadata) and expose metrics/traces for token flows.
- Add a simple analytics pipeline for token reuse/abuse detection and emit `TokenAbuseDetectedEvent`.

### Tiêu chí chấp nhận (Acceptance Criteria)

- [JWKS & Key Rotation](acm-use-cases.md#jwks-key-rotation): publish JWKS and rotate signing keys without downtime.
- [Introspection Enrichment](acm-use-cases.md#introspection-enrichment): introspection returns requested metadata and meets latency SLO.
- [Reuse Analytics](acm-use-cases.md#reuse-analytics): abuse/reuse events are emitted and accessible to monitoring.

### Không nằm trong phạm vi sprint:

- Full ML-driven detection pipelines (consider in later stages).

### Milestones

#### Sprint 3.1

Key Rotation & JWKS

- Implement key management endpoints (publish JWKS), rotate signing keys and support key rollover in verification path.
- Acceptance: verification works across key rollover period and no downtime observed.

**Acceptance Criteria (mapped)**

- [JWKS & Key Rotation](acm-use-cases.md#jwks-key-rotation)

#### Sprint 3.2

Introspection Performance & Reuse Analytics

- Enrich introspection responses with session metadata, add metrics and traces, and implement simple analytics pipeline to detect reuse patterns.
- Acceptance: introspection meets latency SLO; analytics pipeline emits `TokenAbuseDetectedEvent` for suspected abuse.

**Acceptance Criteria (mapped)**

- [Introspection Enrichment](acm-use-cases.md#introspection-enrichment)
- [Reuse Analytics](acm-use-cases.md#reuse-analytics)

## Sprint 4

Sprint 4 tập trung vào bảo mật ứng dụng (MFA / step‑up), quản lý phiên và các endpoint truy vấn còn thiếu.

- Triển khai MFA enforcement / step‑up flows (AuthenticateCommand → challenge → VerifySessionMfaCommand) và tích hợp với IDM MFA provider (dùng stub cho integration tests).
- Triển khai các endpoint quản lý phiên: ListActiveSessions, AdminListSessions và GetSessionById cùng projection cập nhật và cơ chế phân quyền cho admin.
- Triển khai các endpoint truy vấn: GetSessionMfaStatus, GetRevocationStatus và bổ sung tài liệu RYOW (Read‑Your‑Own‑Writes) / projection‑checkpoint behaviour.

### Tiêu chí chấp nhận (Acceptance Criteria)

- [MFA & Step‑up](acm-use-cases.md#mfa--step-up-authentication-acm-side): luồng end‑to‑end hoạt động, `mfaVerified` chuyển trạng thái chính xác và emit `SessionMfaVerifiedEvent`.
- [Session Management](acm-use-cases.md#session-management-list--get--revoke): các endpoint List/Get/Admin trả đầy đủ trường, hỗ trợ revoke; AdminListSessions trả các trường admin (ip, lastSeen).
- [GetSessionMfaStatus & GetRevocationStatus](acm-use-cases.md#getsessionmfastatus): các truy vấn trả trạng thái đúng theo projection.

### Không nằm trong phạm vi sprint

- UX console quản lý phiên toàn diện (enterprise UI) và analytics nâng cao.

### Milestones

#### Sprint 4.1

MFA flows & Verify

- Triển khai endpoint challenge & verify cho MFA và tích hợp test harness.
- Acceptance: luồng vượt qua integration tests với IDM MFA provider stub.

**Acceptance Criteria (mapped)**

- [MFA & Step‑up](acm-use-cases.md#mfa--step-up-authentication-acm-side)

#### Sprint 4.2

Quản lý phiên & queries

- Triển khai ListActiveSessions, AdminListSessions, GetSessionById; triển khai GetSessionMfaStatus và GetRevocationStatus; document RYOW semantics.
- Acceptance: các endpoint trả đúng dữ liệu; behaviour checkpoint RYOW có test mẫu.

**Acceptance Criteria (mapped)**

- [Session Management](acm-use-cases.md#session-management-list--get--revoke)
- [GetSessionMfaStatus](acm-use-cases.md#getsessionmfastatus)
- [GetRevocationStatus](acm-use-cases.md#getrevocationstatus)
