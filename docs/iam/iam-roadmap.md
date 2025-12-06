# Lộ trình IAM

## Sprint 1 — MVP (1 tháng, đã ưu tiên)

Mục tiêu Sprint 1: giao một MVP end‑to‑end, có thể demo và dùng làm nền tảng tích hợp. Sprint 1 tập trung vào phạm vi hẹp để đảm bảo hoàn thành trong 4 tuần.

**Phạm vi:**

- IDM: `RegisterUser` với Guard Streams cho `email`/`username`, email verification, password hashing (Argon2id), password reset (SSPR) token.
- ACM: token issuance (`/token`) cho access + refresh, `/introspect`, `/revoke` (emit `SessionRevokedEvent` / revocation hint).
- AZM: `CheckPermission` API + middleware cho một dịch vụ đại diện; role assign/unassign cơ bản và lưu trữ projection.
- OCS: `CreateTenant` với guard‑stream để đảm bảo uniqueness của tên tenant và emit `TenantCreatedEvent`.
- Phần chung xuyên suốt (cross‑cutting): structured JSON logs + correlation IDs, OpenTelemetry skeleton, liveness/readiness endpoints, CI smoke e2e tests (sử dụng `testcontainers`).

**Mapping tới roadmap thành phần:**

- IDM: [Sprint 1](docs/iam/idm/idm-roadmap.md#sprint-1) (RegisterUser, Email verification, Password management), [Sprint 2](docs/iam/idm/idm-roadmap.md#sprint-2) (ChangeUsername, Soft‑delete).
- ACM: xem [Sprint 1](docs/iam/acm/acm-roadmap.md#sprint-1) (token issuance, introspection, basic revocation), [Sprint 2](docs/iam/acm/acm-roadmap.md#sprint-2) (refresh rotation, client management).
- AZM: [Sprint 1](docs/iam/azm/azm-roadmap.md#sprint-1)
- OCS: [Sprint 1](docs/iam/ocs/ocs-roadmap.md#sprint-1)

**Milestones:**

- Mốc 1 — Nền tảng & Observability (Tuần 0–1)
  - Kết quả bàn giao: service skeleton, `README`, `Dockerfile`, structured logging + correlation IDs, OpenTelemetry dev config, liveness/readiness endpoints và CI healthprobe.
  - Tiêu chí chấp nhận: container chạy cục bộ; health endpoints trả về OK; có trace mẫu và sample structured log; CI healthprobe xanh.
- Mốc 2 — IDM Core (Tuần 1–2)
  - Kết quả bàn giao: `RegisterUser` với atomic guard reservation (`unique-email-<hash>`, `unique-username-<hash>`), email verification endpoints, Argon2id cho password storage, password reset flow.
  - Tiêu chí chấp nhận: đăng ký trùng lặp bị từ chối; verify email cập nhật flag và emit event; password lưu dạng hash Argon2id; reset token dùng một lần và hết hạn.
- Mốc 3 — ACM + AZM + OCS Integration (Tuần 2–4)
  - Kết quả bàn giao: ACM `/token`, `/introspect`, `/revoke`; AZM `CheckPermission` + role assign; OCS `CreateTenant`; end‑to‑end integration tests (register → verify → token → introspect → assign role → permission check → create tenant) và một chaos concurrency test.
  - Tiêu chí chấp nhận: token được issue với claims và expiry đúng; `/introspect` trả inactive cho token bị revoke/expire; role assign cập nhật projection và middleware AZM chặn/cho phép đúng; tenant creation reserve tên nguyên tử; stage e2e CI xanh.

**Quy tắc & QA**

- Mỗi mốc phải kèm unit tests, integration testing, e2e testing.
- Mỗi mốc phải qua CI gating trước khi merge.
- Ràng buộc bảo mật: không lưu secrets ở dạng plaintext trong repo; Argon2id được kiểm tra trong review; threat review cho flows token.

## Sprint 2 — Hoàn thiện các tính năng lõi (1 tháng)

Mục tiêu Sprint 2: hoàn thiện các luồng còn lại dựa trên MVP, đảm bảo an toàn vòng đời token, quản lý client, soft‑delete/takeover và gia cố Guard Streams để đạt độ an toàn và tính nhất quán trong môi trường phân tán.

**Phạm vi:**

- IDM: `ChangeUsername`, `DeleteUserAccount` (soft delete) với release guard keys nguyên tử; profile updates và audit hooks.
- ACM: refresh token rotation, reuse detection (`RefreshTokenReuseDetected`), client registration/secret rotation, durable revocation publishing.
- AZM: role CRUD + assign/unassign, đảm bảo projection cập nhật và middleware enforcement.
- OCS: product registration/enrollment flows và tenant rename/delete với atomic semantics.
- Cross‑cutting: concurrency test harnesses (fuzzing), durable event publishing, CI integration cho chaos tests.

**Mapping tới roadmap thành phần:**

- IDM: xem [Sprint 2](docs/iam/idm/idm-roadmap.md#sprint-2) cho chi tiết `ChangeUsername` và soft‑delete flows.
- ACM: xem [Sprint 2](docs/iam/acm/acm-roadmap.md#sprint-2) cho refresh rotation và client management.
- AZM: xem [Sprint 2](docs/iam/azm/azm-roadmap.md#sprint-2) (role hierarchies / admin APIs) nếu cần mở rộng role management.
- OCS: xem [Sprint 2](docs/iam/ocs/ocs-roadmap.md#sprint-2) cho enrollment và membership flows.

**Milestones**

- Mốc 1 — Đổi username & gia cố Guard Streams (Tuần 1)
  - Kết quả bàn giao: `ChangeUsername` flow triển khai với atomic reservation cho tên mới và emit `UsernameChangedEvent`; thư viện tiện ích guard‑stream; concurrency harness cho test race conditions.
  - Tiêu chí chấp nhận: thử đổi tên đồng thời chỉ có một bên thành công; projection/read‑model phản ánh đúng; utilities có tài liệu sử dụng.
- Mốc 2 — Soft‑delete & Revocation Hints (Tuần 2)
  - Kết quả bàn giao: `DeleteUserAccount` (soft delete) thực hiện, kèm `UserAccountDeletedEvent` và sự giải phóng khóa guard nguyên tử; revocation hints được gửi tới ACM.
  - Tiêu chí chấp nhận: user đã xóa không thể authenticate; guard keys đã được giải phóng; revocation hint tối thiểu được ACM stub tiêu thụ trong test.
- Mốc 3 — Refresh Rotation & Client Management (Tuần 3)
  - Kết quả bàn giao: refresh token rotation + reuse detection hoạt động; API quản lý client (create/rotate secret) và persistence; revocation publishing có cơ chế retry/ack.
  - Tiêu chí chấp nhận: rotation vô hiệu hoá refresh token cũ; reuse detection phát hiện và emit sự kiện; client APIs trả về event xác nhận và được persist.
- Mốc 4 — AZM role management & OCS enrollment (Tuần 4)
  - Kết quả bàn giao: AZM role CRUD + assign/unassign; OCS product registration/enrollment flows; end‑to‑end integration tests bao gồm một chaos scenario; tài liệu và hardening cơ bản.
  - Tiêu chí chấp nhận: role changes persist và middleware AZM thực thi chính sách; product enrollment reserve tên và emit event; pipeline integration stage xanh.

**Quy tắc & QA**

- Mỗi mốc phải kèm unit tests, integration testing, e2e testing.
- Chạy các kịch bản concurrency/fuzzing cho Guard Streams trên môi trường staging trước khi merge mốc tương ứng.
- Các revocation/rotation flows phải có end‑to‑end test (ACM stub) và retry/ack semantics cho publishing.
- Ràng buộc bảo mật: secrets rotation và lưu trữ secrets được mã hoá; audit events cho các hành động nhạy cảm.

## Sprint 3

Mục tiêu Sprint 3: hoàn thiện các tính năng an toàn và consistency cần thiết để các dịch vụ phụ thuộc có thể vận hành ổn định ở môi trường production — tập trung vào Guard Streams guidance, RYOW/projector checkpoints, JWKS/key rotation và audit/revocation contracts.

**Phạm vi:**

- Guard Streams: test harness, utilities cho atomic reservation/release, concurrency fuzzing và single‑winner guarantees.
- Projectors & RYOW: projector checkpointing, `waitForProjection` helpers, và test hooks để hỗ trợ read‑your‑own‑writes cho client flows.
- ACM: JWKS publishing, key rotation (rolling rollover) và introspection enrichment (session metadata) — đảm bảo token verification không downtime.
- Audit & Revocation contract: append‑only audit stream, revocation hint schema, contract tests giữa IDM↔ACM↔AZM↔OCS.
- Security: secrets encryption validation, CI secret scanning, and key rotation runbook.

**Mapping tới roadmap thành phần:**

- IDM: Sprint 3 (Profile updates, MFA TOTP) — profile + MFA cần dựa trên RYOW/Projector checkpoints và audit stream.
- ACM: Sprint 3 (JWKS & Key Rotation) — ưu tiên cao để đảm bảo token verification an toàn.
- AZM: Sprint 3 (ABAC & Performance) — policy versioning và evaluation cache để đáp ứng latency khi mở rộng.
- OCS: Sprint 3 (Guard Streams guidance, RYOW) — core tooling cho uniqueness & projector integration.

**Milestones**

- Mốc 1 — Guard Streams Test Harness & Utilities (Tuần 0–1)
  - Kết quả bàn giao: thư viện guard‑stream reusable + test harness cho concurrency fuzzing (staged jobs).
  - Tiêu chí: chạy thử 1k concurrent reservation scenarios trên staging, single‑winner semantics xác nhận.
- Mốc 2 — Projector Checkpoints & RYOW Helpers (Tuần 1–2)
  - Kết quả bàn giao: projector checkpoint API, `waitForProjection` query support, SDK helper + integration test for common flows.
  - Tiêu chí: client flow `register → waitForProjection → query` thấy consistent state trong bounded time (configurable threshold).
- Mốc 3 — JWKS & Key Rotation (Tuần 2–3)
  - Kết quả bàn giao: JWKS endpoint, key rotation tool + test for rollover, enriched `/introspect` metadata for sessions.
  - Tiêu chí: token verification works across key rollover; introspect returns expected metadata; rotation playbook documented.
- Mốc 4 — Audit Stream & Revocation Contract Tests (Tuần 3–4)
  - Kết quả bàn giao: append‑only admin audit stream, revocation hint schema, consumer‑driven contract tests between IDM↔ACM↔AZM↔OCS.
  - Tiêu chí: contract tests pass; downstream ACM/AZM stubs accept revocation hints and simulate expected reactions.

**Quy tắc & QA**

- Chạy fuzzing/concurrency tests nightly on staging; failures require triage trước khi merge cho các thay đổi Guard Streams.
- JWKS rotation phải có automated rollback path và không gây downtime trong integration tests.
- Contract tests phải được đưa vào CI pipeline cho integration stage; mọi vi phạm contract block deploy.

## Sprint 4

Mục tiêu Sprint 4: hoàn thiện các phần vận hành, orchestration, và hardening để hệ thống có thể đi vào vận hành (monitoring, audit, process managers, takeover policies, MFA full flows, read‑models và admin endpoints).

**Phạm vi:**

- IDM: Change Email (atomic swap), Takeover policies, full MFA flows (TOTP confirm/disable) và read‑models/queries cho user.
- ACM: MFA step‑up integration, ListActiveSessions/Admin endpoints, introspection performance & reuse analytics.
- AZM: Enforcement adapters / SDKs, multi‑tenant scoping, Permission Registry + `RolePermissionsChangedEvent` → revocation hints.
- OCS: Harden tenant/product takeover/delete flows, process managers cho tenant deletion và bulk revocation.
- Cross‑cutting: process managers, operational runbooks, monitoring/alerts, admin audit UI hooks (nếu cần), và long‑running orchestrations testing.

**Mapping tới roadmap thành phần:**

- IDM: Sprint 4 (Change Email atomic swap, Takeover) + Sprint 5 (Read models & PMs) — Sprint 4 sẽ hoàn thành Change Email và takeover mechanics.
- ACM: Sprint 4 (MFA / Session management) — hoàn thiện session admin APIs và step‑up flows.
- AZM: Sprint 4–5 (Enforcement & Permission Registry) — tích hợp enforcement adapters và đảm bảo permission→revocation contract.
- OCS: Sprint 4–5 (Harden atomic flows, integration tests, read‑models & PMs).

**Milestones**

- Mốc 1 — Change Email (Atomic Swap) & Takeover Policy (Tuần 0–2)
  - Kết quả bàn giao: `InitiateEmailChange` / `ConfirmEmailChange` / `CancelEmailChange` flows with atomic guard‑stream swap; takeover policy implementation for contested keys.
  - Tiêu chí: atomic swap tests pass; takeover only allowed per policy; audit events emitted.
- Mốc 2 — MFA Step‑up & Session Admin (Tuần 1–3)
  - Kết quả bàn giao: full MFA flow integrated with ACM (challenge/verify), `ListActiveSessions` & `AdminListSessions` endpoints and admin projections.
  - Tiêu chí: MFA flows pass integration tests; admin endpoints return expected fields and support revoke.
- Mốc 3 — Process Managers & Read‑models (Tuần 2–4)
  - Kết quả bàn giao: Process Managers for TenantDeletion / BulkMembershipRevocation, read‑models for users/tenants/products available for queries, integration tests.
  - Tiêu chí: PMs handle failure/compensation, read‑models reflect projections within RYOW bounds; end‑to‑end integration CI xanh.
- Mốc 4 — Operational Runbooks & Monitoring (Tuần 3–4)
  - Kết quả bàn giao: runbooks for JWKS/key rotation, revocation, takeover; monitoring dashboards/alerts for token abuse, guard‑stream failures, projection lag.
  - Tiêu chí: runbooks reviewed; basic dashboards/alerts in place; on‑call playbook documented.

**Quy tắc & QA**

- Các Process Managers phải có idempotency và compensation tests.
- All admin APIs và các luồng nhạy cảm yêu cầu audit events và acceptance tests.
- Chuẩn bị rollback / canary release plan cho các thay đổi lớn (email swap, takeover, key rotation).
