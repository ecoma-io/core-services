# Lộ trình OCS

## Sprint 0

Mục tiêu Sprint 0 (Bootstrapping): tạo skeleton codebase và các cấu hình vận hành cơ bản để các sprint sau có một nền tảng triển khai nhất quán.

- Thiết lập skeleton repo/service (monorepo layout, minimal service scaffold) cho OCS với README, Dockerfile.
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

Mục tiêu Sprint 1: triển khai các luồng cốt lõi cho Tenant và Product, bao gồm tạo/đổi tên/xóa (atomic release), và đảm bảo tính duy nhất bằng Guard Streams.

- Implement `CreateTenantCommand` flow with Guard Stream reservation for `tenantName` and emit `TenantCreatedEvent`.
- Implement `RegisterProductCommand` with product-name uniqueness via Guard Stream and emit `ProductRegisteredEvent`.
- Implement `ChangeTenantNameCommand` and `DeleteTenantCommand` with atomic lock release/acquire semantics (appendAtomic).

### Tiêu chí chấp nhận (Acceptance Criteria)

- [Create Tenant](ocs-use-cases.md#create-tenant): successful create emits `TenantCreatedEvent` and reserves `unique-tenantname-<normalized>` via atomic write.
- [Update Tenant](ocs-use-cases.md#update-tenant): change name flows append atomically the name change and lock release/acquire events.
- [Register Product](ocs-use-cases.md#register-product): product registration reserves name and emits `ProductRegisteredEvent`.

### Không nằm trong phạm vi sprint:

- Enrollment, membership, and admin tooling.

### Milestones

#### Sprint 1.1

Tenant Create & Atomic Name Lock

- Implement tenant creation handler with Guard Stream atomic reservation and `TenantCreatedEvent` emission.
- Acceptance: concurrent create attempts result in single success and `TenantNameAlreadyTaken` on conflicts.

**Acceptance Criteria (mapped)**

- [Create Tenant](ocs-use-cases.md#create-tenant)

#### Sprint 1.2

Product Registration & Tenant Rename/Delete

- Implement product registration with Guard Stream and implement `ChangeTenantNameCommand` + atomic swap semantics and `DeleteTenantCommand` that releases name lock atomically.
- Acceptance: product name uniqueness enforced; tenant rename/delete perform atomic writes releasing/acquiring locks.

**Acceptance Criteria (mapped)**

- [Register Product](ocs-use-cases.md#register-product)
- [Delete Tenant](ocs-use-cases.md#delete-tenant)

## Sprint 2

Mục tiêu Sprint 2: triển khai Enrollment và Membership — cho phép link/unlink tenant↔product và phân quyền membership kèm trigger-hints cho ACM/AZM.

- Implement `LinkTenantToProductCommand` / `UnlinkTenantFromProductCommand` and emit `TenantLinkedToProductEvent` / `TenantUnlinkedFromProductEvent`.
- Implement `AssignMembershipCommand` / `RevokeMembershipCommand` and emit `MembershipCreatedEvent` / `MembershipRevokedEvent` with revocation hints.
- Ensure trigger-hint payloads include required fields for ACM/AZM integration (`initiatedBy`, `affectedTenantId`/`userId`, `revocationHints`).

### Tiêu chí chấp nhận (Acceptance Criteria)

- [Tenant ↔ Product Enrollment](ocs-use-cases.md#tenant-↔-product-enrollment): linking/unlinking emits enrollment events and respects preconditions.
- [Membership](ocs-use-cases.md#membership-assign--revoke-role-in-producttenant): assignment emits `MembershipCreatedEvent` and duplicates are rejected; revocation emits trigger hints.
- [Emit Trigger Events and Revocation Hints](ocs-use-cases.md#emit-trigger-events-and-revocation-hints): trigger events contain `initiatedBy` and `revocationHints` and do not claim revocation authority.

### Không nằm trong phạm vi sprint:

- Complex enrollment policies, UI admin portals.

### Milestones

#### Sprint 2.1

Enrollment Flows

- Implement tenant↔product linking and unlinking with necessary precondition checks and events.
- Acceptance: linking fails when product/tenant inactive; success emits `TenantLinkedToProductEvent`.

**Acceptance Criteria (mapped)**

- [Tenant ↔ Product Enrollment](ocs-use-cases.md#tenant-↔-product-enrollment)

#### Sprint 2.2

Membership Assignment & Revocation Hints

- Implement membership assign/revoke commands and ensure revocation hint payloads are generated for downstream ACM/AZM.
- Acceptance: duplicate assignments rejected; revoke emits `MembershipRevokedEvent` with proper hint fields.

**Acceptance Criteria (mapped)**

- [Membership](ocs-use-cases.md#membership-assign--revoke-role-in-producttenant)
- [Emit Trigger Events and Revocation Hints](ocs-use-cases.md#emit-trigger-events-and-revocation-hints)

## Sprint 3 (Estimated effort: 14–20 developer-days)

Mục tiêu Sprint 3: triển khai Guard Streams guidance, RYOW support and projector checkpoints so callers can observe writes deterministically.

- Implement Guard Stream utilities and test harnesses for multi-stream atomic writes and releases.
- Implement projector checkpointing and `waitForProjection` query parameter mechanics to support RYOW scenarios.
- Implement audit/append-only admin audit stream for key changes (tenant/product/membership events).

### Tiêu chí chấp nhận (Acceptance Criteria)

- [Guard Streams and Uniqueness Semantics (Guidance)](ocs-use-cases.md#guard-streams-and-uniqueness-semantics-guidance): atomic append patterns demonstrated in tests and harnesses.
- [Read-Your-Own-Writes Guidance for OCS](ocs-use-cases.md#read-your-own-writes-ryow-guidance): `waitForProjection` or checkpoint flows allow clients to observe writes within bounded time.
- [Emit Trigger Events and Revocation Hints](ocs-use-cases.md#emit-trigger-events-and-revocation-hints): audit stream contains required audit data for triggers.

### Không nằm trong phạm vi sprint:

- Full CI-integration for concurrency fuzzing (consider later).

### Milestones

#### Sprint 3.1

Guard Stream Test Harness

- Implement test harness and utilities for atomic reservation/release flows; include concurrency tests demonstrating single-winner behavior.
- Acceptance: concurrency tests pass demonstrating guard-stream uniqueness semantics.

**Acceptance Criteria (mapped)**

- [Guard Streams and Uniqueness Semantics (Guidance)](ocs-use-cases.md#guard-streams-and-uniqueness-semantics-guidance)

#### Sprint 3.2

Projector Checkpoints & Audit

- Implement projector checkpoint wait mechanics and an append-only audit stream for admin actions and trigger events.
- Acceptance: clients can request `waitForProjection` and receive consistent reads; audit stream contains required fields for tracing triggers.

**Acceptance Criteria (mapped)**

- [Read-Your-Own-Writes Guidance for OCS](ocs-use-cases.md#read-your-own-writes-ryow-guidance)

## Sprint 4

Mục tiêu Sprint 4: harden critical atomic flows (delete/rename/takeover), policy enforcement and integration testing with ACM/AZM for revocation contracts.

- Implement atomic takeover policies and `UserAccountExpiredEvent`/takeover flows where policy allows (design + implementation).
- Implement comprehensive integration tests with mock ACM/AZM verifying trigger-hint contracts and downstream reactions.
- Implement policy guards preventing delete/rename when preconditions (active enrollments/memberships) exist.

### Tiêu chí chấp nhận (Acceptance Criteria)

- [Atomic Takeover / Competing Claim](ocs-use-cases.md#guard-streams-and-uniqueness-semantics-guidance): takeover policy enforcement and atomic append semantics validated by integration tests.
- [Delete Tenant](ocs-use-cases.md#delete-tenant): delete flows blocked when active enrollments exist and successful deletes append atomic lock-release events.
- [Emit Trigger Events and Revocation Hints](ocs-use-cases.md#emit-trigger-events-and-revocation-hints): end-to-end integration tests show proper hint payloads and ACM mock reacts as expected.

### Không nằm trong phạm vi sprint:

- Broad policy authoring UIs and external stakeholder sign-off processes.

### Milestones

#### Sprint 4.1

Takeover Policy & Preconditions

- Implement policy checks for takeover/delete flows and enforce preconditions preventing unsafe deletes/renames.
- Acceptance: delete/rename commands return domain errors when preconditions fail.

**Acceptance Criteria (mapped)**

- [Delete Tenant](ocs-use-cases.md#delete-tenant)

#### Sprint 4.2

Integration Tests with ACM/AZM Mocks

- Implement integration test suite that runs OCS flows and asserts ACM/AZM mock consumers receive correct trigger-hints and react appropriately.
- Acceptance: integration tests pass demonstrating contract compliance.

**Acceptance Criteria (mapped)**

- [Emit Trigger Events and Revocation Hints](ocs-use-cases.md#emit-trigger-events-and-revocation-hints)

## Sprint 5 (Estimated effort: 22 developer-days)

Mục tiêu Sprint 5: triển khai các read-model / query endpoints và orchestration (Process Manager) cho các workflow dài, cộng thêm test/integration cần thiết.

- Implement read-models and query endpoints for OCS: `GetTenantById`, `FindTenantByName`, `CheckTenantNameAvailability`, `GetProductById`, `FindProductByName`, `ListEnrollmentsForTenant`, `GetMembershipById`, `ListMembershipsForUser`.
- Implement Process Manager workflows for multi-step orchestration such as Tenant Deletion Orchestration and Bulk Membership Revocation, including robust error handling and compensation logic.
- Add integration tests / acceptance tests for end-to-end read-models and PM flows.

### Tiêu chí chấp nhận (Acceptance Criteria)

- Read-model endpoints return expected results and support pagination where applicable (e.g., `ListEnrollmentsForTenant`, `ListMembershipsForUser`).
- Tenant Deletion process manager verifies enrollments/memberships and emits necessary trigger hints; fails with clear domain errors when preconditions are not met.
- Integration/acceptance tests for PMs and read-models are implemented and pass in CI.

### Không nằm trong phạm vi sprint:

- UI admin portals or large policy authoring surfaces.

### Milestones

#### Sprint 5.1

- Read-models & Query Endpoints

- Implement tenant/product/membership/enrollment projections and corresponding HTTP/GRPC query endpoints.
- Acceptance: queries match canonical behavior and support `waitForProjection` via projector checkpoints where applicable.

**Acceptance Criteria (mapped)**

- [`GetTenantById`, `FindTenantByName`, `FindProductByName`, etc.`](ocs-use-cases.md#queries)

#### Sprint 5.2

- Process Managers & Integration tests

- Implement Tenant Deletion orchestration and Bulk Membership Revocation PMs, with integration tests exercising trigger-hint contracts to mock ACM/AZM.
- Acceptance: PMs handle failure/compensation paths and integration tests demonstrate expected end-to-end behavior.

**Acceptance Criteria (mapped)**

- [Process Manager (Tenant Deletion / Bulk Membership Revocation)](ocs-use-cases.md#process-manager-n%E1%BA%A1u-neun)

## Sprint 6 (Estimated effort: 19 developer-days)

Mục tiêu Sprint 6: hoàn thiện các flows còn thiếu nhỏ hơn (suspend/activate, product update/deactivate), guard-stream tooling/inspection API, canonical event schemas, projector-check helpers và RYOW helpers.

- Implement `SuspendTenantCommand` / `ActivateTenantCommand` and ensure trigger-hint payloads include `initiatedBy` + `revocationHints` as required.
- Implement `UpdateProductCommand` and `DeactivateProductCommand` with precondition checks for active enrollments and proper domain errors.
- Implement Guard Stream inspection API / helper endpoints to query lock status (`unique-tenantname-<normalized>`, `unique-productname-<normalized>`) and owner metadata for operational use.
- Produce canonical JSON schemas for key events and create acceptance-test skeletons (Jest/e2e) and projector-checkpoint test helpers for RYOW scenarios.
- Add small guard-stream + RYOW helper APIs that combine lock-check + expected-checkpoint semantics.

### Tiêu chí chấp nhận (Acceptance Criteria)

- Suspend/Activate emits `TenantSuspendedEvent` / `TenantActivatedEvent` and publishes trigger hints containing required fields. Downstream ACM remains authoritative for revocation.
- Product update emits `ProductUpdatedEvent`; deactivation fails when active enrollments exist and succeeds otherwise emitting `ProductDeactivatedEvent`.
- Guard Stream inspection API returns lock status, owner metadata and integrates with the toolchain for incident ops.
- Canonical JSON schemas and acceptance test skeletons are present in the repo and CI test suite includes projector-checkpoint helpers for RYOW acceptance scenarios.

### Không nằm trong phạm vi sprint:

- Large UI work or cross-team policy design sessions.

### Milestones

#### Sprint 6.1

- Tenant Suspend/Activate & Product Update/Deactivate

- Implement commands, events, projector updates and tests for tenant suspend/activate and product update/deactivate flows.
- Acceptance: domain errors where preconditions fail; trigger hints and events emitted as described in `ocs-use-cases.md`.

**Acceptance Criteria (mapped)**

- [Suspend / Activate Tenant](ocs-use-cases.md#suspend--activate-tenant)
- [Update / Deactivate Product](ocs-use-cases.md#update--deactivate-product)

#### Sprint 6.2

- Guard Stream inspection, schemas & RYOW helpers

- Implement guard-stream inspection endpoints, produce canonical JSON schemas for key events and add acceptance-test skeletons + projector checkpoint helpers to support RYOW scenarios.
- Acceptance: inspection API works reliably and event schemas + tests are available for downstream consumers.

**Acceptance Criteria (mapped)**

- [Guard Streams and Uniqueness Semantics (Guidance)](ocs-use-cases.md#guard-streams-and-uniqueness-semantics-guidance)
- [Read-Your-Own-Writes Guidance for OCS](ocs-use-cases.md#read-your-own-writes-ryow-guidance)
