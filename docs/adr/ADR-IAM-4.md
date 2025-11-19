# ADR-IAM-4 — Quy tắc Merge Quyền (Permissions Merge Rules)

## 1. Bối cảnh

IAM Service cung cấp Permission Registry cho phép các services khác đăng ký permissions của họ. Mỗi service có thể publish nhiều versions khác nhau của permission tree theo thời gian. Để hỗ trợ:

- **Rolling deployments:** Version mới và cũ chạy đồng thời
- **Gradual rollout:** Có thể rollback nếu có vấn đề
- **Backward compatibility:** Client cũ vẫn hoạt động với version mới

Hệ thống cần maintain đồng thời 3 major versions mới nhất của mỗi service và merge chúng thành một combined permission tree duy nhất.

**Vấn đề cần giải quyết:**

- Khi có conflict về permission key giữa các versions (ví dụ: `admin` là leaf node ở v1 nhưng là container node ở v2)
- Làm thế nào để xác định priority khi merge
- Đảm bảo merge deterministic và có thể audit được
- Trigger rebuild cache khi có version mới

**Yêu cầu:**

- Luôn ưu tiên version mới hơn
- Merge phải idempotent và deterministic
- Phải có audit trail để debug conflicts
- Performance: merge nhanh, cache aggressive

## 2. Quyết định

Implement **3-Major-Version Merge Strategy** với quy tắc priority-based deep merge.

### 2.1. Version Selection Strategy

Cho mỗi service, chỉ giữ **tối đa 3 major versions mới nhất** và từ mỗi major đó chọn một release theo semver (highest minor, rồi highest patch). Cụ thể:

- Lấy danh sách tất cả các release đã publish cho service.
- Group theo `major`, sắp xếp các major theo thứ tự giảm dần (major cao → thấp).
- Chọn **3 major lớn nhất** (ít hơn nếu dịch vụ có <3 major hiện có).
- Với mỗi major được chọn, chọn release _latest_ trong major đó theo quy tắc semver: chọn bản có **highest minor**, và trong minor đó chọn **highest patch**.

Pseudocode (summary):

- Group all published releases by `major`.
- Sort `major` values in descending order and take the top 3 majors (fewer if the service has <3 majors).
- For each selected major, choose the single release that is latest by semver within that major by preferring the highest `minor`, and within that minor the highest `patch`.

This selection produces up to three releases per service that will contribute to the merged permission tree.

**Lý do chọn 3 versions:**

- 2 versions: Không đủ buffer cho rollback phức tạp (ví dụ: đang chạy v2, deploy v3 có bug, muốn rollback về v1 nhưng v1 đã bị xóa).
- 4+ versions: Tăng complexity merge và storage overhead không cần thiết.
- 3 versions: Cân bằng giữa flexibility cho rollback/gradual rollout và chi phí/độ phức tạp của merge.

### 2.2. Priority Rules

Priority khi merge phải dựa trên semver tuple (major, minor, patch). Thực tế, ta so sánh theo thứ tự: higher major → higher minor → higher patch.

Để tiện xử lý trong code, có thể ánh xạ semver thành một `priorityScore` tuyến tính (đủ lớn để tránh va chạm):

Implementation note: compute a priority score based on the semver tuple so ordering is deterministic. For example, map `(major, minor, patch)` to a single integer such as `major * 1_000_000 + minor * 1_000 + patch`, then compare by that score (or compare tuples directly using semver ordering).

Khi so sánh, luôn dùng semver ordering thay vì chỉ dựa vào single-field (ví dụ chỉ major hoặc chỉ patch). Sử dụng semver compare ensures deterministic ordering across all three components.

### 2.3. Deep Merge Algorithm

Merge theo đệ quy với resolution dựa trên priority (semver desc). Các nguyên tắc chính:

- Sắp xếp sources (selected releases) theo semver desc (highest semver wins first).
- Duyệt theo thứ tự đó, chèn/merge nodes vào kết quả. Node được ghi metadata provenance (service + version).
- Khi key chỉ xuất hiện ở một nguồn → sao chép nguyên node kèm provenance.
- Khi key xuất hiện ở nhiều nguồn:
  - Nếu cả hai bên đều là `container` → merge children đệ quy.
  - Nếu một bên là `leaf` và bên kia là `container` → node từ source có semver cao hơn thắng (explicit override). Trường hợp này phải được log/audit.
  - Nếu cả hai là `leaf` → node từ source có semver cao hơn thắng.

Algorithm description (summary):

- Sort the selected sources (releases) in semver descending order so the highest-priority release is processed first.
- Maintain a result map keyed by permission `key`.
- For each source (in priority order) and for each node in its `permissionsTree`:
  - If the key is not yet present in the result map, copy the node into the result with provenance metadata (serviceId + version + score).
  - If the key already exists, resolve conflicts by these rules:
    - If both existing and incoming nodes are `container` nodes, recursively merge their children using the same rules and preserve provenance for nodes contributed by each source.
    - If one side is `leaf` and the other is `container`, the node from the source with higher semver priority wins (explicit override). Record provenance and the overridden source for audit.
    - If both sides are `leaf`, the node from the higher-priority source wins and provenance is recorded.
- Always record provenance (which service/version contributed the winning node) and any overridden sources to an audit table or metadata blob for traceability.

Implementation notes:

- Use semver tuple comparison (major, minor, patch) for deterministic ordering rather than ad-hoc single-field comparisons.
- Store provenance alongside merged nodes (e.g., `serviceId`, `version`, `priorityScore`) and persist conflict summaries to an audit table to aid debugging.
- Keep merge idempotent by deriving results deterministically from the same ordered set of sources.

### 2.4. Cache Invalidation Strategy

Khi service publish version mới:

1. **Event:** `ServiceVersionRegistered` được publish
2. **Projector:** Permission Projector nhận event
3. **Rebuild:** Tính toán lại combined tree cho service đó
4. **Store:** Lưu vào `permission_registry` table (PostgreSQL)
5. **Invalidate:** Flush Redis cache cho tất cả roles sử dụng permissions từ service này
6. **Audit:** Log merge conflicts vào audit table

Operation flow (summary):

1. When a `ServiceVersionRegistered` event is received for a service, fetch all published versions for that service from the read model.
2. Select up to three releases for merge using the Version Selection Strategy (see 2.1).
3. For each selected release, prepare a source descriptor including `serviceId`, `version`, the `permissionsTree`, and its calculated priority score.
4. Run the Deep Merge Algorithm (see 2.3) over the prepared sources to compute the combined permission tree.
5. Persist the merged result into the permission registry table and push the combined tree into the read cache (Redis). Persist provenance and conflict summaries to the audit table if there are overrides.
6. Invalidate or refresh downstream caches (e.g., role/user permission caches) and emit observability events/metrics for monitoring (merge duration, number of conflicts, size of merged tree).

### 2.5. Ví dụ (Input / Output)

Để minh họa rõ hơn quy tắc chọn phiên bản và hành vi merge, dưới đây là một số ví dụ đơn giản (input: các release/permission trees; output: cây đã hợp nhất và giải thích quyết định).

- Ví dụ A — Version Selection (chọn 3 major, per-major highest minor/patch)

  Input (published releases for `service-x`):
  - 2.0.5 — permissions: `[{ "key": "billing:read" }]`
  - 2.1.3 — permissions: `[{ "key": "billing:write" }]`
  - 3.0.0 — permissions: `[{ "key": "billing:admin" }]`
  - 3.1.1 — permissions: `[{ "key": "billing:report" }]`
  - 4.0.2 — permissions: `[{ "key": "billing:dashboard" }]`

  Selection step:
  - Distinct majors = [4, 3, 2] → top 3 majors are 4, 3, 2.
  - For major 4: only 4.0.2 → choose 4.0.2.
  - For major 3: releases 3.1.1 and 3.0.0 → choose 3.1.1 (highest minor/patch).
  - For major 2: releases 2.1.3 and 2.0.5 → choose 2.1.3.

  Output (selected sources): `4.0.2`, `3.1.1`, `2.1.3` (these 3 trees will be merged).

- Ví dụ B — Conflict: Leaf vs Container (leaf override)

  Input (selected releases for `service-y`):
  - Version 3.0.0 (higher semver):
    permissionsTree:
    [ { "key": "admin", "type": "leaf", "description": "full admin" } ]

  - Version 2.5.0 (lower semver):
    permissionsTree:
    [ { "key": "admin", "type": "container", "children": [ { "key": "admin:user:read", "type": "leaf" } ] } ]

  Merge decision:
  - `admin` exists in both sources. Types differ (leaf vs container).
  - Source 3.0.0 has higher semver priority → the `leaf` node from 3.0.0 wins and replaces the container.
  - Child `admin:user:read` from 2.5.0 is therefore not present in the merged tree; the override must be recorded in provenance/audit logs with both winner (3.0.0) and overridden source (2.5.0).

  Output (merged):
  [ { "key": "admin", "type": "leaf", "description": "full admin", "metadata": { "resolvedFrom": "3.0.0", "overrides": ["2.5.0"] } } ]

  Explanation: explicit override is intentionally deterministic (semver ordering), but must be monitored since it can remove previously available child permissions.

- Ví dụ C — Container Merge with Multiple Children (children union with provenance)

  Input (selected releases for `service-z`):
  - Version 4.2.0:
    permissionsTree:
    [ { "key": "reports", "type": "container", "children": [ { "key": "reports:read", "type": "leaf" } ] } ]

  - Version 3.9.1:
    permissionsTree:
    [ { "key": "reports", "type": "container", "children": [ { "key": "reports:export", "type": "leaf" } ] } ]

  Merge decision:
  - Both define `reports` as `container` → children merged recursively.
  - `reports:read` (from 4.2.0) and `reports:export` (from 3.9.1) are different child keys → both present in merged tree.
  - For each child node we record provenance indicating which version contributed it.

  Output (merged):
  [ {
  "key": "reports",
  "type": "container",
  "children": [
  { "key": "reports:read", "type": "leaf", "metadata": { "resolvedFrom": "4.2.0" } },
  { "key": "reports:export", "type": "leaf", "metadata": { "resolvedFrom": "3.9.1" } }
  ],
  "metadata": { "resolvedFrom": "4.2.0" }
  } ]

  Explanation: container+container merges allow combining capabilities from different majors while preserving traceability per child.

Ví dụ trên nhằm minh họa các kết quả điển hình; trong thực tế projector phải lưu metadata/audit cho mọi override và expose metrics (conflict count, nodes dropped, merged tree size) để vận hành an toàn.

## 3. Hệ quả

### Tích cực

- **Deterministic:** Cùng input luôn cho cùng output
- **Auditable:** Metadata cho biết version nào win trong conflict
- **Flexible:** Hỗ trợ rolling deployment và rollback
- **Performance:** Merge result được cache, chỉ rebuild khi cần
- **Backward compatible:** Version cũ vẫn contribute vào merged tree

### Tiêu cực

- **Complexity:** Logic merge phức tạp, cần test kỹ
- **Cache invalidation:** Cần invalidate nhiều cache entries khi có version mới
- **Storage overhead:** Phải lưu 3 versions thay vì 1
- **Conflict resolution:** Có thể có conflicts không mong muốn, cần monitoring
- **Debugging:** Khi có vấn đề về permissions, phải trace qua nhiều versions

## 4. Các lựa chọn đã xem xét

- **Chỉ dùng latest version:**
  - _Lý do từ chối:_ Không hỗ trợ rolling deployment. Khi deploy version mới có bug, không thể rollback gracefully.

- **Dùng 2 versions thay vì 3:**
  - _Lý do từ chối:_ Cần thêm buffer cho rollback phức tạp (v3 → v1). Ví dụ: đang chạy v2, deploy v3 có bug, muốn rollback về v1 nhưng v1 đã bị xóa.

- **Merge tất cả versions không giới hạn:**
  - _Lý do từ chối:_ Complexity tăng theo số versions. Storage và merge performance degradation. Khó debug khi có nhiều sources.

- **Client-specified version (không merge):**
  - _Lý do từ chối:_ Client phải biết version nào đang available. Không transparent. Breaking change cho clients khi upgrade.

- **Feature flags thay vì multi-version:**
  - _Lý do từ chối:_ Feature flags solve khác problem (feature toggle). Không giải quyết được vấn đề rolling deployment và compatibility.
