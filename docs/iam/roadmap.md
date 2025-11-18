# ROADMAP Triển khai IAM — Báo cáo và Kế hoạch (Tiếng Việt)

**Một câu tóm tắt:**

- Hệ thống IAM đã có nền tảng DDD/CQRS/CQRS + Event Sourcing mạnh (domain, command/query, event store adapter, outbox, projectors, migrations, permission merge), nhưng còn thiếu một số thành phần bảo mật, OIDC/JWKS, upcaster/snapshot production và công cụ vận hành để đạt trạng thái production-ready.

**Mục lục**

- Tóm tắt hiện trạng
- Những gì đã triển khai
- Khoảng trống kỹ thuật (gaps)
- Roadmap ưu tiên theo pha
- Các tác vụ khẩn cấp (2 tuần đầu)
- Rủi ro chính và lưu ý vận hành
- Các bước tiếp theo đề xuất

---

**Tóm tắt hiện trạng**

- Repo có đầy đủ cấu trúc: `apps/iam-command-service`, `apps/iam-query-service`, `apps/iam-projector-worker`, cùng các `libs/iam-domain`, `libs/iam-command-interactor`, `libs/iam-query-interactor`, `libs/iam-infrastructure`, `libs/iam-worker-infrastructure`.
- Đã triển khai core: aggregates, commands/handlers, queries/handlers, EventStoreDB adapter (với hook cho outbox & snapshot), projectors scaffold, checkpoint semantics, permission merge logic, read-model migrations, TOTP scaffold, social-login demo và TokenService cơ bản.

**Những gì đã triển khai (chi tiết)**

- Domain & CQRS: `libs/iam-domain`, `libs/iam-command-interactor`, `libs/iam-query-interactor`.
- Event sourcing: `EventStoreDbRepository` với khả năng append/read, tích hợp outbox và snapshot hooks.
- Outbox & Messaging: outbox entities/repository/publisher; RabbitMQ adapter, DLX/retry utilities.
- Projectors & Checkpoints: `BaseProjector`, `UpcasterRegistryImpl`, `CheckpointRepositoryImpl`, projectors cho các AR chính.
- Read models & Migrations: SQL migrations (bao gồm `combined_permissions_cache`) và entity/repository implementations.
- Permissions: `PermissionMergeService` (thuật toán merge theo ADR-5) và conventions cache Redis (`permissions:combined-tree`, `user_perms:{userId}:{tenantId}`).
- Auth primitives: JWT token service, TOTP service (speakeasy), Passport GitHub scaffold, demo auth endpoints.
- Observability scaffolding: package OTEL + logging present in lockfile and `packages/nestjs-observability`.
- CI/Build/Docker targets: Nx `project.json` và `docker:build` targets, infras compose files.

**Khoảng trống kỹ thuật quan trọng (phải xử lý trước production)**

- OIDC / OAuth Provider đầy đủ (discovery, JWKS, Authorization Code + PKCE, consent, client management) chưa triển khai.
- JWKS, key rotation và asymmetric signing chưa có — hiện đang dùng secret đồng bộ (dev).
- Token revocation / introspection chưa có — không thể thu hồi token ngay lập tức.
- Upcasters: registry có scaffold nhưng thiếu upcaster thực tế cho evolution of events.
- Snapshot policy & tooling (tạo snapshot theo N/T, retention, restore) chưa đầy đủ.
- Outbox publisher và guarantee vận hành (đảm bảo publisher chạy, atomicity) cần kiểm chứng.
- Permission projector & user-permission projector cần kiểm tra wiring để cập nhật Redis cache theo thiết kế.
- MFA flow chưa lưu secret người dùng và chưa yêu cầu MFA trong login; recovery codes chưa có.
- Social login mapping chưa hoàn chỉnh (link hoặc upsert user aggregate).
- RYOW tích hợp: query service cần xử lý `min_version`/`X-Stream-Version` polling.
- Observability: OTEL chưa được khởi tạo trong `main.ts` và traceId chưa được đính kèm vào metadata sự kiện.
- E2E tests / CI: cần test end-to-end command→event→projector→query; CI chưa có bước e2e hoàn chỉnh.
- Runbooks & Ops tools (replay, DLQ, snapshot management, key rotation UI) thiếu.

---

**ROADMAP Ưu tiên (Pha & Ước lượng)**

Ghi chú: 1 sprint ≈ 1–2 tuần. Ước lượng cho team 1–3 người.

- Phase 0 — Ổn định lõi & an toàn (1–3 tuần)
  - Hoàn thiện login thực tế (không dùng demo) — `AuthController` -> `UserReadRepository`.
  - Kiểm chứng EventStore + Outbox atomic bằng integration tests.
  - Bắt buộc validate biến môi trường (JWT, EVENTSTORE, RABBITMQ, REDIS).

- Phase 1 — Permissions & Authorization (2–4 tuần)
  - Hoàn thiện `PermissionProjector` và `UserPermissionProjector` cập nhật Redis.
  - Tích hợp `IAuthorizationService` để API thực hiện O(1) lookup cho permission checks.
  - Thêm tests cho permission expansion/edge-cases.

- Phase 2 — Upcasters & Snapshotting (2–3 tuần)
  - Implement upcasters, register vào `UpcasterRegistry`.
  - Snapshot policy (N events / T time), job tạo snapshot, retention cleanup.
  - Tools tạo snapshot hàng loạt cho existing aggregates.

- Phase 3 — OIDC / Token security (3–6 tuần)
  - JWKS + key rotation + asymmetric signing.
  - OIDC discovery endpoints, JWKS endpoint, Authorization Code + PKCE, Client Credentials.
  - Token introspection & revocation endpoints; dynamic scope resolution từ permission cache.

- Phase 4 — MFA, Social login, SSO & S2S (2–4 tuần)
  - Persist TOTP secrets, enrollment APIs, recovery codes, enforce MFA in login flows.
  - Finalize social login mapping/upsert/linking and multiple providers support.
  - Harden S2S flows (audience, scopes).

- Phase 5 — Observability & infra automation (2–3 tuần)
  - Wire OpenTelemetry in `main.ts`, propagate `traceId` into event metadata.
  - Export Prometheus metrics, create Grafana dashboards and health checks.

- Phase 6 — Testing & CI/CD (2–4 tuần)
  - E2E tests (Testcontainers/docker-compose) covering command→event→projector→query.
  - CI pipeline: lint/test/build/e2e/docker:build and canary releases.

- Phase 7 — Ops tools & long-term maintenance (ongoing)
  - Admin CLI/UI for replay, DLQ inspect/requeue, snapshot management, JWKS/key rotation.

---

**Các tác vụ khẩn cấp (2 tuần đầu) — triển khai ngay**

- T1: Thay demo login bằng real `UserReadRepository` và verify password; trả `X-Stream-Version` khi ghi thành công.
- T2: Thêm config validation (AppConfigService) cho biến bắt buộc (`JWT_*`, `EVENTSTORE_*`, `RABBITMQ_*`, `REDIS_*`).
- T3: Kiểm chứng Outbox publisher và ensure outbox-to-rabbitmq pipeline hoạt động trong staging.
- T4: Wire `PermissionProjector` → Redis (`permissions:combined-tree`) và `UserPermissionProjector` → `user_perms:{user}:{tenant}`; viết integration test cho SISMEMBER check.
- T5: Thêm OTEL bootstrap (dev opt-in) và inject `traceId` vào metadata khi append event.

**Ví dụ ticket ngắn (có thể mở ngay)**

- Issue: `T1 - Implement real login using UserReadRepository` — Acceptance: login uses read model, returns tokens, and supports MFA check flag.
- Issue: `T4 - Permission projector wiring + test` — Acceptance: publishing a `ServiceVersionRegistered` updates `permissions:combined-tree` in Redis and `RoleAssignedToUser` updates `user_perms:*`.
- Issue: `T9 - JWKS key management design` — Acceptance: design doc + scripts for rotate keys and updating JWKS endpoint.

---

**Rủi ro chính & lưu ý vận hành**

- Upcasting or snapshot errors can corrupt replayed read models — luôn test full-replay trong staging.
- Key rotation without client coordination can invalidate tokens — cần grace period & dual-key signing.
- Permission tree lớn có thể gây performance/caching pressure — phải benchmark và set TTL/eviction rules.
- Nhiều thành phần infra tăng độ phức tạp vận hành → cần automation để chạy migrations, backup, restore, và alerting.

---

**Các bước tiếp theo (gợi ý bạn cho phép tôi thực hiện)**

- (A) Tạo danh sách issues chi tiết (T1..T12) với mô tả và acceptance criteria.
- (B) Mở PR: thay demo login bằng real lookup + config validation (T1 + T2).
- (C) Tạo patch mẫu để khởi tạo OpenTelemetry trong `main.ts` và inject traceId vào `EventStore` metadata.
- (D) Sinh template e2e (docker-compose/Testcontainers) để validate command→event→projector→query flow.

Vui lòng chọn một trong (A)/(B)/(C)/(D) để tôi bắt tay thực hiện tiếp — tôi sẽ thực hiện và gửi kết quả (PR/patch/issue list/code) ngay.
