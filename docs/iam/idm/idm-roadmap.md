# Lộ trình IDM

## Sprint 0

Mục tiêu Sprint 0 (Bootstrapping): tạo skeleton codebase và các cấu hình vận hành cơ bản để các sprint sau có một nền tảng triển khai nhất quán.

- Thiết lập skeleton repo/service (monorepo layout, minimal service scaffold) cho IDM với README, Dockerfile.
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

Mục tiêu của giai đoạn này là nhanh chóng cung cấp một MVP (Minimum Viable Product) cho IDM với phạm vi hẹp hơn, tập trung vào các tính năng nền tảng cần thiết để hỗ trợ đăng ký, xác thực email, quản lý mật khẩu và cập nhật hồ sơ.

- Quy trình đăng ký/định danh người dùng (registration) với ràng buộc unique trên email/username (Guard Streams — guard keys stored as hashed values, e.g. `unique-email-<hash(normalizedEmail)>`, `unique-username-<hash(username)>`).
- Xác thực email (email verification).
- Quản lý mật khẩu: thay đổi mật khẩu, phục hồi mật khẩu (SSPR) với token một lần.
- Quy trình đăng ký/định danh người dùng (registration) với ràng buộc unique trên email/username (Guard Streams).
- Xác thực email (email verification).
- Quản lý mật khẩu: thay đổi mật khẩu, phục hồi mật khẩu (SSPR) với token một lần.
- Các yêu cầu non-functional thiết yếu: bảo mật mật khẩu (Argon2id), lưu trữ bí mật được mã hoá khi cần thiết, audit/stream events, và atomic multi-stream writes cho khóa unique.

### Tiêu chí chấp nhận (Acceptance Criteria)

- Functional:
  - [Register User Account](idm-use-cases.md#register-user-account): đăng ký thành công chỉ khi `email` (và `username` nếu có) chưa bị reserve/được sử dụng.
  - [Verify Email](idm-use-cases.md#verify-email): thực thi verify token phải đặt `emailVerified = true` khi token hợp lệ, và trả lỗi khi token không hợp lệ/hết hạn.
  - [Change User Password](idm-use-cases.md#change-user-password): thay đổi mật khẩu khi biết `currentPassword` phải thành công chỉ khi `currentPassword` hợp lệ; `newPassword` phải được băm (Argon2id) trước khi lưu và emit `UserPasswordChangedEvent`.
  - [Password Reset (SSPR)](idm-use-cases.md#password-reset-sspr): issue/reset token flow phải cho phép reset mật khẩu một lần, băm `newPassword` bằng Argon2id và emit `UserPasswordChangedEvent`; token invalid/expired phải trả lỗi `InvalidOrExpiredVerificationToken`.

- Non-functional
  - Passwords hashed with `Argon2id` (configurable cost parameters).
  - Secrets at rest are encrypted where applicable;
  - Multi-stream atomic writes used for reserving/releasing unique keys (`IEventStore.appendAtomic`).
  - Basic integration tests for happy paths and important failure modes — implement BDD scenarios from `idm-use-cases.md` as executable acceptance tests.

- Không nằm trong phạm vi sprint:
  - Các quy trình takeover/atomic takeover đầy đủ (có thể lên kế hoạch cho sprint sau).
  - Thay đổi Email (Khởi tạo/Xác nhận/Hủy bỏ): quy trình hoán đổi email nguyên tử sử dụng Guard Streams (email/username reservations are stored using hashed keys like `unique-email-<hash(normalizedNewEmail)>`).

### Milestones

#### Sprint 1.1

Register & Unique Key Guards

- Implement `RegisterUserCommand` with Guard Stream atomic write (reserve email/username using hashed guard keys: `unique-email-<hash(normalizedEmail)>` / `unique-username-<hash(username)>`).
- Emit `UserRegisteredEvent`, `EmailLockAcquiredEvent`, `UsernameLockAcquiredEvent`.
- Acceptance: cannot register duplicated email/username; tests for guard stream atomicity.

**Acceptance Criteria (mapped)**

- [Register User Account](idm-use-cases.md#register-user-account): đăng ký thành công khi email/username chưa bị reserve/được sử dụng; trường hợp email đã tồn tại trả `EmailAlreadyTaken`.
- Guard-stream behavior & uniqueness: các event khóa phải được append atomically (`IEventStore.appendAtomic`) cùng với `UserRegisteredEvent` (xem scenarios trong `Register User Account`).

#### Sprint 1.2

Email Verification + Password Management

- Implement verify email flow, issue/verify tokens, mark emailVerified.
- Implement change-password and password-reset (issue token + reset).
- Acceptance: token expiry handling, password hashed with Argon2id, no raw password in storage/events.

**Acceptance Criteria (mapped)**

- [Verify Email](idm-use-cases.md#verify-email): verify token hợp lệ phải đặt `emailVerified = true` và emit `UserEmailVerifiedEvent`; token invalid/expired trả lỗi `InvalidOrExpiredVerificationToken`.
- [Change User Password](idm-use-cases.md#change-user-password): thay đổi mật khẩu khi biết `currentPassword` thành công; `newPassword` băm Argon2id và emit `UserPasswordChangedEvent`.
- [Password Reset (SSPR)](idm-use-cases.md#password-reset-sspr): issue/reset token flow cho phép reset một lần; khi reset thành công băm `newPassword` bằng Argon2id và emit `UserPasswordChangedEvent`; token invalid/expired trả lỗi.

## Sprint 2

Sprint 2 được điều chỉnh để ưu tiên các chức năng có tác động trực tiếp đến tính năng cơ bản và trải nghiệm người dùng: đổi `username` an toàn (guaranteed uniqueness via guard streams) và xóa mềm tài khoản kèm giải phóng khóa nguyên tử. `Change Email` được dời sang sprint sau để giảm rủi ro và cho phép team tập trung triệt để vào những phần quan trọng hơn.

### Tiêu chí chấp nhận (Acceptance Criteria)

- [Change Username](idm-use-cases.md#change-username): username change must reserve `newUsername` and emit `UsernameChangedEvent` only when uniqueness holds; invalid format returns `InvalidUsernameFormat` and already-taken returns `UsernameAlreadyTaken`.
- [Delete User Account](idm-use-cases.md#delete-user-account): soft-delete sets `deletedAt` and emits `UserAccountDeletedEvent`; atomically release keys via guard streams (`EmailLockReleasedEvent`/`UsernameLockReleasedEvent`).

### Không nằm trong phạm vi sprint:

- Full takeover/atomic takeover flows (can be planned for later).

### Milestones

#### Sprint 2.1

Change Username (Guard Streams)

- Implement `ChangeUsernameCommand` that reserves `newUsername` (`UsernameLockAcquiredEvent`) and appends `UsernameChangedEvent` atomically.
- Implement validation for username format and produce `InvalidUsernameFormat` when applicable.
- Acceptance: cannot change to `newUsername` that is reserved or taken; success emits `UsernameChangedEvent` and releases old username lock atomically.

**Acceptance Criteria (mapped)**

- [Change Username](idm-use-cases.md#change-username): reserve new username, emit `UsernameChangedEvent` on success; return `UsernameAlreadyTaken` or `InvalidUsernameFormat` otherwise.

#### Sprint 2.2

Soft Delete + Key Release

- Implement `DeleteUserAccountCommand` to soft-delete user and atomically append `UserAccountDeletedEvent` + `EmailLockReleasedEvent`/`UsernameLockReleasedEvent`.
- Implement revocation hints and audit logging as part of the delete flow.
- Acceptance: soft-delete releases locks atomically and sets `deletedAt` and `accountStatus=Deleted`.

**Acceptance Criteria (mapped)**

- [Delete User Account](idm-use-cases.md#delete-user-account): soft-delete sets `deletedAt` and emits `UserAccountDeletedEvent`; atomically release keys via guard streams.

## Sprint 3

Sprint 3 sẽ tập trung vào cải thiện trải nghiệm người dùng và bảo mật thứ cấp: cập nhật hồ sơ người dùng (profile) và triển khai MFA cơ bản (TOTP) như một nâng cấp bảo mật quan trọng.

### Tiêu chí chấp nhận (Acceptance Criteria)

- [Update User Profile](idm-use-cases.md#update-user-profile): cập nhật `firstName`/`lastName`/`avatarUrl`/`metadata` phải emit `UserProfileUpdatedEvent`; invalid data trả `InvalidProfileData`.
- [Manage MFA (TOTP)](idm-use-cases.md#manage-mfa-totp): TOTP registration must issue secret/QR to client (raw secret not stored unencrypted); Confirm must store encrypted secret and emit `MFAEnabledEvent`; Disable must emit `MFADisabledEvent`.

### Không nằm trong phạm vi sprint:

- Advanced MFA methods beyond TOTP (push, hardware tokens).

### Milestones

#### Sprint 3.1

Profile Updates

- Implement `UpdateUserProfileCommand` and `UserProfileUpdatedEvent`.
- Add validation rules for profile fields and return `InvalidProfileData` when appropriate.
- Acceptance: valid updates emit `UserProfileUpdatedEvent` and update projections/read-models.

**Acceptance Criteria (mapped)**

- [Update User Profile](idm-use-cases.md#update-user-profile): see success and failure scenarios.

#### Sprint 3.2

Basic MFA (TOTP)

- Implement TOTP registration flow: `EnableMFACommand` returns secret/QR to client (do not store raw secret).
- Implement `ConfirmMFACommand` to validate TOTP code, store encrypted secret, and emit `MFAEnabledEvent`.
- Implement `DisableMFACommand` to remove MFA and emit `MFADisabledEvent`.
- Acceptance: cannot confirm with invalid code; stored secret is encrypted and not returned in events.

**Acceptance Criteria (mapped)**

- [Manage MFA (TOTP)](idm-use-cases.md#manage-mfa-totp): registration, confirm and disable scenarios as specified.

## Sprint 4

Sprint 4 sẽ giải quyết các trường hợp phức tạp hơn liên quan đến ownership và chuyển giao khóa: đổi email nguyên tử và flows takeover/atomic takeover khi cần.

### Tiêu chí chấp nhận (Acceptance Criteria)

- [Change Email](idm-use-cases.md#change-email): Initiate reserves new email; Confirm atomically swaps and emits `EmailChangedEvent`; Cancel releases reserved lock.
- [Atomic Takeover / Competing Claim](idm-use-cases.md#atomic-takeover-competing-claim): takeover flows must append atomically the takeover events (expire old account, assign key to new account) and respect policy constraints.

### Không nằm trong phạm vi sprint:

- Advanced admin UIs beyond necessary operational tooling.

### Milestones

#### Sprint 4.1

Change Email (Atomic Swap)

- Implement `InitiateEmailChangeCommand`, `ConfirmEmailChangeCommand`, and `CancelEmailChangeCommand` with guard-stream reservations and atomic swap via `IEventStore.appendAtomic`.
- Acceptance: cannot initiate if `newEmail` reserved; confirm performs atomic swap and emits `EmailChangedEvent`.

**Acceptance Criteria (mapped)**

- [Change Email](idm-use-cases.md#change-email): initiation, confirm and cancel scenarios.

#### Sprint 4.2

Atomic Takeover (Competing Claim)

- Design and implement takeover policy enforcement and `UserAccountExpiredEvent` flows that can be triggered atomically with new registrations/changes when policy allows.
- Acceptance: takeover succeeds only when policy allows and the atomic append updates both accounts and guard streams consistently.

**Acceptance Criteria (mapped)**

- [Atomic Takeover / Competing Claim](idm-use-cases.md#atomic-takeover-competing-claim): see takeover success and failure scenarios.

## Sprint 5 (Estimated effort: 22 developer-days)

Mục tiêu Sprint 5: hoàn thiện read-side và surface query endpoints, đồng thời bổ sung Process Managers để điều phối các workflow nhiều bước quan trọng.

- Implement read-models and query endpoints: `GetUserById`, `FindUserByEmail`, `FindUserByUsername`, `CheckEmailAvailability`, `CheckUsernameAvailability`, `GetPendingEmailChange`, `GetMfaStatus`, `GetAccountPreconditions`, and any supporting paging/indexing.
- Implement Process Managers / orchestrators for long-running flows: `EmailVerificationProcessManager`, `EmailChangeProcessManager`, `PasswordResetProcessManager`, and `AccountDeletionProcessManager` (idempotency and compensation handling).
- Add end-to-end integration tests and acceptance-test skeletons validating read-model behavior and PM workflows.

### Tiêu chí chấp nhận (Acceptance Criteria)

- Read endpoints return expected read-models, support pagination where applicable and reflect projection updates (with RYOW guidance applied in Sprint 6 helpers).
- Process Managers coordinate multi-step flows end-to-end with clear failure/compensation semantics and pass integration tests.
- Acceptance/Integration tests for read-models and orchestrators are present in the repo and run in CI.

### Không nằm trong phạm vi sprint:

- Large UI admin surfaces or cross-BC policy negotiations.

### Milestones

#### Sprint 5.1

- Read Models & Query Endpoints

- Implement the required projections and query endpoints, including pagination and stable surface contracts.
- Acceptance: queries match the behavior described in `idm-use-cases.md` and are exercised by tests.

**Acceptance Criteria (mapped)**

- [GetUserById, FindUserByEmail/Username, CheckAvailability, Pending Email/ MFA status](idm-use-cases.md#queries)

#### Sprint 5.2

- Process Managers & Integration Tests

- Implement PMs for EmailVerification, EmailChange, PasswordReset and AccountDeletion; ensure idempotency and durable process state.
- Acceptance: PM workflows produce expected events, handle retries/timeouts and pass integration tests using mocked/sandboxed dependencies.

**Acceptance Criteria (mapped)**

- [Process Manager](idm-use-cases.md#process-manager)

## Sprint 6 (Estimated effort: 19 developer-days)

Mục tiêu Sprint 6: bổ sung các flows vận hành và cross-boundary ports, tạo các JSON event schemas, RYOW helpers và các API giám sát guard-stream / operational endpoints.

- Implement Lock / Unlock User Account flows (system/admin triggered locks and unlocks) and `UserAccountLockedEvent` / `UserAccountUnlockedEvent`.
- Implement cross-BC operational ports and inspection endpoints: `GetUserSessions` (port/contract), `VerifyTokenStatus` port, and `GetGuardStreamStatus` / guard-stream inspection API for operational use.
- Produce canonical JSON schemas for key IDM events and add acceptance-test skeletons (Jest/e2e) and projector-checkpoint helpers to support RYOW acceptance tests.

### Tiêu chí chấp nhận (Acceptance Criteria)

- Lock/unlock flows set account status correctly and emit expected events; integration tests simulate rate-limiter triggered locks and admin unlocks.
- Cross-BC ports / inspection APIs are defined, implemented or scaffolded, and covered by tests or stable contracts for downstream consumers.
- JSON event schemas and acceptance-test skeletons are added to the repo; projector-check helpers for RYOW are present for test use.

### Không nằm trong phạm vi sprint:

- Significant UI development or multi-team policy workshops.

### Milestones

#### Sprint 6.1

- Lock/Unlock & Cross-BC Ports

- Implement account lock/unlock commands and events, and provide adapters/ports for `GetUserSessions` and `VerifyTokenStatus` where applicable.
- Acceptance: lock flows and ports pass unit + integration tests and are documented.

**Acceptance Criteria (mapped)**

- [Lock / Unlock User Account](idm-use-cases.md#lock--unlock-user-account)

#### Sprint 6.2

- Guard Stream Inspection, Event Schemas & RYOW helpers

- Implement guard-stream inspection endpoints for operational diagnostics, create canonical JSON schemas for events (major events enumerated in use-cases), and add projector-checkpoint / RYOW test helpers.
- Acceptance: operational endpoints return expected lock state/metadata; schemas and test helpers are available in the repo and used by acceptance/e2e skeletons.

**Acceptance Criteria (mapped)**

- [GetGuardStreamStatus](idm-use-cases.md#getguardstreamstatus-conceptual--port)
- [Read-Your-Own-Writes Guidance for IDM flows] (idm-use-cases.md)
