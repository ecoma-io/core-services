# Lộ trình AZM

## Sprint 0

Mục tiêu Sprint 0 (Bootstrapping): tạo skeleton codebase và các cấu hình vận hành cơ bản để các sprint sau có một nền tảng triển khai nhất quán.

- Thiết lập skeleton repo/service (monorepo layout, minimal service scaffold) cho AZM với README, Dockerfile.
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

## Sprint 1 (Estimated effort: 12–20 developer-days)

Mục tiêu Sprint 1: cung cấp cơ chế ủy quyền cốt lõi (authorization checks) và mô hình RBAC tối thiểu để bảo vệ API/ressources và phục vụ các luồng business-critical.

- Implement permission evaluation API/middleware (synchronous check endpoint and library hooks).
- Implement basic RBAC: role definitions, assign/unassign roles to users, and simple permission-to-role mapping.
- Persist roles and permission mappings and emit events on changes.

### Tiêu chí chấp nhận (Acceptance Criteria)

- [Permission Evaluation](azm-use-cases.md#permission-evaluation): authorization check returns allow/deny with reason; enforced consistently by middleware.
- [Role Assignment](azm-use-cases.md#role-assignment): assigning/removing roles updates projections and emits `UserRoleAssignedEvent` / `UserRoleRemovedEvent`.
- [Permission Mapping](azm-use-cases.md#permission-mapping): mapping role→permission persists and is used by evaluation engine.

### Không nằm trong phạm vi sprint:

- Fine-grained attribute-based policies (ABAC) and delegated admin UIs.

### Milestones

#### Sprint 1.1

Core Evaluation & RBAC Store

- Implement `CheckPermission` API and middleware integration for one representative service.
- Implement persistence for roles and permissions and events for role changes.
- Acceptance: checks return correct result for common scenarios and role events are emitted.

**Acceptance Criteria (mapped)**

- [Permission Evaluation](azm-use-cases.md#permission-evaluation)

#### Sprint 1.2

Role Management Basics

- Implement APIs for create/read/delete roles and assign/unassign roles to users; update projections.
- Acceptance: role CRUD and assignments emit `RoleCreatedEvent` / `UserRoleAssignedEvent` and read-models reflect changes.

**Acceptance Criteria (mapped)**

- [Role Assignment](azm-use-cases.md#role-assignment)

## Sprint 2 (Estimated effort: 16–24 developer-days)

Mục tiêu Sprint 2: triển khai quản trị vai trò/quyền nâng cao và đảm bảo thay đổi được truyền tới các hệ thống tiêu thụ (propagation & audit).

- Implement role hierarchies and permission inheritance.
- Implement admin APIs for bulk role/permission updates and audit event stream for governance.
- Implement change propagation to caches/projections and simple rate-limited admin endpoints.

### Tiêu chí chấp nhận (Acceptance Criteria)

- [Role Hierarchy](azm-use-cases.md#role-hierarchy): hierarchical roles inherit permissions correctly and evaluation respects inheritance.
- [Admin Role Management](azm-use-cases.md#admin-role-management): admin APIs for bulk updates succeed and emit `RoleUpdatedEvent` / `PermissionsUpdatedEvent`.
- [Audit & Propagation](azm-use-cases.md#audit-propagation): all admin changes produce audit events and projection caches are updated within expected window.

### Không nằm trong phạm vi sprint:

- Full UI for admin portal and advanced policy authoring tools.

### Milestones

#### Sprint 2.1

Role Hierarchies & Inheritance

- Implement hierarchical role model and inheritance resolution in evaluation engine.
- Acceptance: tests demonstrate inherited permissions work across multiple levels.

**Acceptance Criteria (mapped)**

- [Role Hierarchy](azm-use-cases.md#role-hierarchy)

#### Sprint 2.2

Admin APIs & Audit Stream

- Implement bulk admin APIs for role/permission updates and an append-only audit stream for admin actions.
- Acceptance: bulk updates emit audit events and downstream projections consume changes.

**Acceptance Criteria (mapped)**

- [Admin Role Management](azm-use-cases.md#admin-role-management)
- [Audit & Propagation](azm-use-cases.md#audit-propagation)

## Sprint 3 (Estimated effort: 16–28 developer-days)

Mục tiêu Sprint 3: bổ sung khả năng chính sách dựa trên attributes (ABAC) cơ bản và tối ưu hoá hiệu năng/độ trễ cho evaluation path.

- Implement simple ABAC support (attributes on subject/resource and attribute rules) and policy versioning.
- Implement evaluation caching and TTL-based projection invalidation to meet latency targets.
- Provide policy validation and dry-run endpoints for safe rollout.

### Tiêu chí chấp nhận (Acceptance Criteria)

- [ABAC Policies](azm-use-cases.md#abac-policies): ABAC rules evaluate correctly with subject/resource attributes and policy versioning works.
- [Evaluation Performance](azm-use-cases.md#evaluation-performance): evaluation latency meets defined thresholds under load.
- [Policy Validation](azm-use-cases.md#policy-validation): policy dry-run and validation endpoints detect conflicts and report results.

### Không nằm trong phạm vi sprint:

- Full policy authoring UX and complex policy language extensions.

### Milestones

#### Sprint 3.1

ABAC Core & Versioning

- Implement attribute storage and simple ABAC rule evaluator integrated into the check path.
- Acceptance: ABAC scenarios from use-cases evaluate as expected and policy versions can be rolled back.

**Acceptance Criteria (mapped)**

- [ABAC Policies](azm-use-cases.md#abac-policies)

#### Sprint 3.2

Performance & Validation

- Add evaluation caches, TTL invalidation, and policy dry-run/validation endpoints.
- Acceptance: evaluation meets latency targets and validation endpoints flag conflicts.

**Acceptance Criteria (mapped)**

- [Evaluation Performance](azm-use-cases.md#evaluation-performance)
- [Policy Validation](azm-use-cases.md#policy-validation)

## Sprint 4 (Estimated effort: 18–28 developer-days)

Mục tiêu Sprint 4: làm cho AZM sẵn sàng sản xuất ở quy mô lớn — tích hợp với enforcement points, auditing hoàn chỉnh và hỗ trợ multi-tenant/resource scoping.

- Integrate with enforcement points (sidecar/OPA or middleware) and provide client SDKs/adapters.
- Implement multi-tenant scoping and resource-scoped policies.
- Implement comprehensive audit events for evaluations and admin actions and retention hooks.

### Tiêu chí chấp nhận (Acceptance Criteria)

- [Enforcement Integration](azm-use-cases.md#enforcement-integration): enforcement adapters/sidecars call AZM check APIs and enforce results reliably.
- [Multi-tenant Scoping](azm-use-cases.md#multi-tenant-scoping): policies and evaluations are correctly scoped per tenant/resource.
- [Evaluation & Admin Audits](azm-use-cases.md#evaluation-admin-audits): evaluation requests and admin changes are audited and exportable.

### Không nằm trong phạm vi sprint:

- Building a full multi-tenant UI and advanced analytics dashboards.

### Milestones

#### Sprint 4.1

Enforcement Adapters & SDKs

- Implement one enforcement adapter (sidecar or middleware) for a representative service and provide minimal SDK.
- Acceptance: enforcement adapter correctly blocks/allows requests based on AZM check responses.

**Acceptance Criteria (mapped)**

- [Enforcement Integration](azm-use-cases.md#enforcement-integration)

#### Sprint 4.2

Multi-tenant Policies & Audit

- Implement tenant-aware policy storage and evaluation; add audit export hooks for compliance.
- Acceptance: tenant isolation verified and audit exports produce required records.

**Acceptance Criteria (mapped)**

- [Multi-tenant Scoping](azm-use-cases.md#multi-tenant-scoping)
- [Evaluation & Admin Audits](azm-use-cases.md#evaluation-admin-audits)

## Sprint 5 (Estimated effort: 18–28 developer-days)

Mục tiêu Sprint 5: đảm bảo thay đổi quyền (permissions) có thể kích hoạt revocation/propagation chính xác tới ACM và thiết lập Permission Registry nâng cao (versioning / deprecate/replace).

- Implement Permission Registry features: register/update/deprecate permissions, implement replacementPermissionId and versioning.
- Implement Role Permissions Change flows: emit `RolePermissionsChangedEvent` with deterministic `removedPermissionIds`, `initiatedBy` và optional revocation hints (`affectedFids`, `affectedTokenReferenceHashes`) cho ACM xử lý.
- Thêm end-to-end tests verifying ACM tiêu thụ triggers và thực hiện revocation theo hint.

### Tiêu chí chấp nhận (Acceptance Criteria)

- [Permission Registry](azm-use-cases.md#permission-registry): register/update/deprecate permissions, replacement semantics rõ ràng.
- [Role Permissions Changed](azm-use-cases.md#role-permissions-change): events chứa `removedPermissionIds` và `revocationHints` khi phù hợp; downstream (ACM) có thể sử dụng hints để revoke.
- [Cross-cutting contract with ACM](azm-use-cases.md#cross-cutting-rules--contract-with-acm): AZM KHÔNG emit `AccessTokensRevokedEvent`/`SessionsRevokedEvent`; `initiatedBy` luôn có khi admin action.

### Không nằm trong phạm vi sprint:

- Full UI cho permission registry; advanced analytics cho permission usage.

### Milestones

#### Sprint 5.1

Permission Registry & Versioning

- Implement API/commands for permission register/update/deprecate and persistent storage.
- Acceptance: permission versions and replacement flows behave as spec.

**Acceptance Criteria (mapped)**

- [Permission Registry](azm-use-cases.md#permission-registry)

#### Sprint 5.2

Role Permissions Change → Revocation Triggers

- Emit `RolePermissionsChangedEvent` with `removedPermissionIds` + optional `revocationHints`.
- Acceptance: ACM can consume event hints and perform revocation end‑to‑end in tests.

**Acceptance Criteria (mapped)**

- [Role Permissions Changed](azm-use-cases.md#role-permissions-change)
- [Cross‑cutting contract with ACM](azm-use-cases.md#cross-cutting-rules--contract-with-acm)

## Sprint 6 (Estimated effort: 16–24 developer-days)

Mục tiêu Sprint 6: triển khai Role Assignment Request workflow (AZM → OCS integration) và cơ chế Guard Streams để đảm bảo uniqueness cho RoleName per Product.

- Implement RoleAssignmentRequestCommand workflow: emit `RoleAssignmentRequestedEvent`, handle `MembershipCreatedEvent`/`MembershipRejectedEvent` từ OCS.
- Implement Guard Streams / RoleName uniqueness enforcement và RoleNameLock events/compensation logic.
- Add Process Managers orchestrating long‑running flows (RoleAssignmentRequestProcessManager, RoleNameUniquenessProcessManager).

### Tiêu chí chấp nhận (Acceptance Criteria)

- [Role Assignment Request](azm-use-cases.md#role-assignment-request): end‑to‑end happy and rejection flows with OCS.
- [Guard Streams & Uniqueness](azm-use-cases.md#guard-streams--uniqueness): atomic guard writes prevent duplicate RoleName per Product.
- [Process Managers](azm-use-cases.md#commands): orchestration handles retries/compensation cleanly.

### Không nằm trong phạm vi sprint:

- UI for bulk role‑assignment workflows.

### Milestones

#### Sprint 6.1

Role Assignment Request Integration

- Implement request API + event mapping to OCS messages; handle success and rejection paths.
- Acceptance: `RoleAssignmentRequestedEvent` → `MembershipCreatedEvent` happy path and rejection paths covered by tests.

**Acceptance Criteria (mapped)**

- [Role Assignment Request](azm-use-cases.md#role-assignment-request)

#### Sprint 6.2

Guard Streams & Uniqueness

- Implement guard stream patterns for RoleName per Product, RoleNameLock events and compensation.
- Acceptance: atomic guard stream tests ensure duplicate role names rejected and recovery flows work.

**Acceptance Criteria (mapped)**

- [Guard Streams & Uniqueness](azm-use-cases.md#guard-streams--uniqueness)
