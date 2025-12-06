# Lộ trình RSM

## Sprint 0

Mục tiêu Sprint 0 (Bootstrapping): tạo skeleton codebase và các cấu hình vận hành cơ bản để các sprint sau có một nền tảng triển khai nhất quán.

- Thiết lập skeleton repo/service (monorepo layout, minimal service scaffold) cho RSM với README, Dockerfile.
- Thiết lập logging cơ bản (structured JSON logs, correlation IDs) và guideline cho log levels.
- Thêm OpenTelemetry (OTel) skeleton: traces + metrics exporter config (dev/observability defaults), starter instrumentation và docs how-to enable.
- Thêm healthcheck endpoints (liveness / readiness) và basic readiness checks (DB, object storage, dependencies), plus simple local healthcheck script for dev và CI.
- Thiết lập e2e test skeleton for healthcheck probe.

### Tiêu chí chấp nhận (Acceptance Criteria)

- Skeleton repository present with clear `README.md` và scripts để chạy local dev, tests và containerized service.
- Structured logging enabled và documented; sample logs emitted by a tiny hello endpoint.
- OpenTelemetry configured for local dev với một example trace emitted by a sample request.
- Liveness/readiness endpoints implemented và covered by a simple healthcheck test in CI.
- e2e test skeleton for healthcheck probe present.

## Sprint 1

Mục tiêu: Cung cấp MVP cho RSM với các tính năng nền tảng về upload file, xác nhận upload, quản lý quota, và cleanup file mồ côi.

- Quy trình upload file trực tiếp (pre-signed URL), xác nhận upload, và quản lý quota (reserve/release quota atomically).
- Cleanup file mồ côi khi upload không hoàn tất.
- Các yêu cầu non-functional thiết yếu: bảo mật, structured logging, atomic multi-stream writes cho quota.

### Tiêu chí chấp nhận (Acceptance Criteria)

- Functional:
  - [Upload Resource (Direct Upload)](rsm-use-cases.md#upload-resource-direct-upload): upload thành công khi quota còn đủ, file hợp lệ; trường hợp quota hết trả `QuotaExceeded`.
  - [Quản lý Quota Lưu Trữ](rsm-use-cases.md#quản-lý-quota-lưu-trữ): reserve quota khi upload, release quota khi xóa file hoặc upload thất bại.
  - [Cleanup File Mồ Côi](rsm-use-cases.md#cleanup-file-mồ-côi): cleanup worker tự động xóa file mồ côi và release quota.
- Non-functional:
  - Multi-stream atomic writes used for reserving/releasing quota.
  - Basic integration tests for happy paths và important failure modes — implement BDD scenarios from `rsm-use-cases.md` as executable acceptance tests.

- Không nằm trong phạm vi sprint:
  - Antivirus scanning, resource delivery, advanced quota policy.

### Milestones

#### Sprint 1.1

Upload & Quota Management

- Implement `UploadResourceCommand` với atomic write (reserve quota, emit `FileInitialized`, `QuotaReserved`).
- Implement `ConfirmUploadCommand` và event `FileUploadConfirmed`.
- Acceptance: không upload được nếu quota không đủ; tests for atomicity.

**Acceptance Criteria (mapped)**

- [Upload Resource (Direct Upload)](rsm-use-cases.md#upload-resource-direct-upload): upload thành công/quota exceeded.
- [Quản lý Quota Lưu Trữ](rsm-use-cases.md#quản-lý-quota-lưu-trữ): reserve/release quota đúng logic.

#### Sprint 1.2

Orphan File Cleanup

- Implement `CleanupOrphanFileCommand` và worker cleanup file mồ côi, release quota atomically.
- Acceptance: file mồ côi được cleanup đúng hạn, không double-release quota.

**Acceptance Criteria (mapped)**

- [Cleanup File Mồ Côi](rsm-use-cases.md#cleanup-file-mồ-côi): cleanup, release quota.

## Sprint 2

Mục tiêu: Bổ sung các tính năng phân phối tài nguyên (resource delivery), quét virus (antivirus), và xóa file/quản lý lifecycle file.

- Phân phối tài nguyên (public/private, proxy/redirect, authorization).
- Quét virus tự động sau upload, chặn file nhiễm virus.
- Xóa file và release quota atomically.

### Tiêu chí chấp nhận (Acceptance Criteria)

- [Phân phối tài nguyên (Resource Delivery)](rsm-use-cases.md#phân-phối-tài-nguyên-resource-delivery): truy cập file public/private đúng quyền, trả về proxy/redirect hoặc lỗi 403.
- [Quét Virus Tự Động](rsm-use-cases.md#quét-virus-tự-động): quét file sau upload, phát hiện virus thì chặn truy cập và emit event.
- [DeleteFileCommand](rsm-use-cases.md#deletefilecommand): xóa file và release quota atomically.

- Không nằm trong phạm vi sprint:
  - Quản lý quota nâng cao, process manager orchestration, advanced delivery policy.

### Milestones

#### Sprint 2.1

Resource Delivery & Delete

- Implement resource delivery endpoints (public/private, proxy/redirect, authorization check).
- Implement `DeleteFileCommand`, event `FileDeleted`, `QuotaReleased` (atomic).
- Acceptance: truy cập đúng quyền, xóa file release quota atomically.

**Acceptance Criteria (mapped)**

- [Phân phối tài nguyên (Resource Delivery)](rsm-use-cases.md#phân-phối-tài-nguyên-resource-delivery)
- [DeleteFileCommand](rsm-use-cases.md#deletefilecommand)

#### Sprint 2.2

Antivirus Scanning

- Implement `ScanFileCommand`, event `FileScanningStarted`, `FileScanningCompleted`/`FileInfected`.
- Block access to infected files, update file state.
- Acceptance: file nhiễm virus bị chặn truy cập, event đúng trạng thái.

**Acceptance Criteria (mapped)**

- [Quét Virus Tự Động](rsm-use-cases.md#quét-virus-tự-động)

## Sprint 3

Mục tiêu: Hoàn thiện read-side, query endpoints, và bổ sung Process Manager để điều phối các workflow nhiều bước.

- Implement read-models và query endpoints: `GetFileById`, `ListFilesByTenant`, `GetQuotaStatus`.
- Implement Process Managers: `UploadProcessManager`, `AntivirusProcessManager`, `QuotaProcessManager`.
- Add end-to-end integration tests và acceptance-test skeletons validating read-model behavior và PM workflows.

### Tiêu chí chấp nhận (Acceptance Criteria)

- Read endpoints trả về expected read-models, support pagination/filter và reflect projection updates.
- Process Managers coordinate multi-step flows end-to-end với clear failure/compensation semantics và pass integration tests.
- Acceptance/Integration tests for read-models và orchestrators are present in the repo và run in CI.

- Không nằm trong phạm vi sprint:
  - Advanced admin UIs, cross-BC policy, quota policy beyond basic.

### Milestones

#### Sprint 3.1

Read Models & Query Endpoints

- Implement required projections và query endpoints, including pagination/filter.
- Acceptance: queries match the behavior described in `rsm-use-cases.md` và được test.

**Acceptance Criteria (mapped)**

- [GetFileById, ListFilesByTenant, GetQuotaStatus](rsm-use-cases.md#queries)

#### Sprint 3.2

Process Managers & Integration Tests

- Implement PMs for upload, antivirus, quota; ensure idempotency và durable process state.
- Acceptance: PM workflows produce expected events, handle retries/timeouts và pass integration tests.

**Acceptance Criteria (mapped)**

- [Process Manager](rsm-use-cases.md#process-manager)
