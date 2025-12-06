# RSM Bounded Context - Behavior Specifications

## 1. Behavior Specifications

### Upload Resource (Direct Upload)

```gherkin
Feature: Upload Resource Directly
	As a User or Internal Service
	I want to upload a file directly to storage via pre-signed URL
	So that I can efficiently store large files without overloading API service

	Scenario: Upload thành công
		Given quota của tenant còn đủ
		And file hợp lệ (định dạng, kích thước, MIME)
		When gửi yêu cầu upload và nhận pre-signed URL
		And upload file thành công lên S3/MinIO
		And xác nhận hoàn tất upload
		Then event `FileInitialized` và `FileUploadConfirmed` được append vào `rsm-file-<fileId>`

	Scenario: Upload thất bại do quota không đủ
		Given quota của tenant đã hết
		When gửi yêu cầu upload
		Then trả về lỗi `QuotaExceeded`
		And không có event `FileInitialized` nào được append
```

### Quản lý Quota Lưu Trữ

```gherkin
Feature: Storage Quota Management
	As an Admin or System
	I want to enforce and release quota atomically
	So that storage usage is always consistent

	Scenario: Đặt quota thành công khi upload
		Given tenant có quota policy
		When gửi yêu cầu upload file hợp lệ
		Then event `QuotaReserved` được append vào `rsm-file-<fileId>`

	Scenario: Hoàn trả quota khi xóa file hoặc upload thất bại
		Given file đã được cấp quota
		When file bị xóa hoặc upload không hoàn tất
		Then event `QuotaReleased` được append vào `rsm-file-<fileId>`
```

### Phân phối tài nguyên (Resource Delivery)

```gherkin
Feature: Resource Delivery
	As a User or Consumer Service
	I want to access files with proper authorization and delivery strategy
	So that I can download or stream files securely and efficiently

	Scenario: Truy cập file public thành công
		Given file ở trạng thái `Available` và `isPublic = true`
		When gửi yêu cầu truy cập file
		Then trả về 200 Stream Proxy hoặc 302 Redirect (tùy cấu hình)

	Scenario: Truy cập file private thành công
		Given file ở trạng thái `Available` và `isPublic = false`
		And user có quyền truy cập
		When gửi yêu cầu truy cập file
		Then trả về 302 Redirect đến signed URL

	Scenario: Truy cập thất bại do không đủ quyền
		Given file private và user không có quyền
		When gửi yêu cầu truy cập file
		Then trả về lỗi 403 Forbidden
```

### Quét Virus Tự Động

```gherkin
Feature: Antivirus Scanning
	As a System
	I want to scan uploaded files for malware
	So that only safe files are available for download

	Scenario: Quét thành công, file an toàn
		Given file đã upload thành công và ở trạng thái `Scanning`
		When Antivirus worker quét file
		And không phát hiện malware
		Then event `FileScanningCompleted` với `avStatus = Safe` được append

	Scenario: Phát hiện file nhiễm virus
		Given file đã upload thành công và ở trạng thái `Scanning`
		When Antivirus worker quét file
		And phát hiện malware
		Then event `FileInfected` được append
		And file bị chặn truy cập (410 Gone)
```

### Cleanup File Mồ Côi

```gherkin
Feature: Orphan File Cleanup
	As a System
	I want to automatically cleanup incomplete uploads
	So that storage and quota are not wasted

	Scenario: Cleanup thành công
		Given file ở trạng thái `Initializing` quá thời gian quy định
		When Cleanup worker phát hiện file mồ côi
		Then file bị xóa vật lý khỏi S3/MinIO
		And event `QuotaReleased` được append
```

## 2. Commands

### UploadResourceCommand

- **Payload:** `tenantId`, `fileName`, `size`, `mimeType`, `requestedBy`
- **Validation:** quota còn đủ, file hợp lệ (MIME, size, policy)
- **Aggregate:** `rsm-file-<fileId>`
- **Events emitted:** `FileInitialized`, `QuotaReserved`
- **Notes:** Không bao giờ lưu raw file content trong event. Nếu quota không đủ, không phát event nào.

### ConfirmUploadCommand

- **Payload:** `fileId`, `actualSize`, `requestedBy`
- **Validation:** file tồn tại, trạng thái hợp lệ, size khớp
- **Aggregate:** `rsm-file-<fileId>`
- **Events emitted:** `FileUploadConfirmed`
- **Notes:** Nếu xác nhận thất bại, không phát event.

### DeleteFileCommand

- **Payload:** `fileId`, `deletedBy`
- **Validation:** file tồn tại, quyền xóa hợp lệ
- **Aggregate:** `rsm-file-<fileId>`
- **Events emitted:** `FileDeleted`, `QuotaReleased`
- **Notes:** Đảm bảo atomicity khi xóa file và release quota.

### ScanFileCommand

- **Payload:** `fileId`
- **Validation:** file tồn tại, trạng thái hợp lệ
- **Aggregate:** `rsm-file-<fileId>`
- **Events emitted:** `FileScanningStarted`, `FileScanningCompleted`/`FileInfected`
- **Notes:** Nếu phát hiện virus, event phải ghi rõ trạng thái và chặn truy cập file.

### CleanupOrphanFileCommand

- **Payload:** `fileId`
- **Validation:** file ở trạng thái `Initializing` quá thời gian quy định
- **Aggregate:** `rsm-file-<fileId>`
- **Events emitted:** `FileDeleted`, `QuotaReleased`
- **Notes:** Đảm bảo cleanup không double-release quota.

## 3. Queries

### GetFileById

- **Payload:** `fileId`
- **Returns:** trạng thái hiện tại của file (read model)
- **Source:** file projection (Postgres/ES)
- **Notes:** Dùng cho kiểm tra trạng thái, quyền truy cập, audit.

### ListFilesByTenant

- **Payload:** `tenantId`, filter (trạng thái, policy, ...)
- **Returns:** danh sách file thuộc tenant
- **Source:** file projection

### GetQuotaStatus

- **Payload:** `tenantId`
- **Returns:** quota đã sử dụng, quota còn lại
- **Source:** quota projection

## 4. Workflows

### Giới thiệu

RSM quản lý vòng đời file, quota, antivirus, cleanup file mồ côi. Nhiều quy trình nghiệp vụ gồm nhiều bước, có trạng thái trung gian, cần orchestration hoặc xử lý sự kiện bất đồng bộ.

### Danh sách các Workflow chính

- **Upload & Confirm:**
  - UploadResourceCommand → FileInitialized, QuotaReserved → ConfirmUploadCommand → FileUploadConfirmed.
  - Nếu không xác nhận trong thời gian quy định, CleanupOrphanFileCommand sẽ được trigger để xóa file và release quota.

- **Delete & Cleanup:**
  - DeleteFileCommand hoặc CleanupOrphanFileCommand → FileDeleted, QuotaReleased.
  - Đảm bảo atomicity khi xóa file và release quota.

- **Antivirus:**
  - ScanFileCommand → FileScanningStarted → FileScanningCompleted/FileInfected.
  - Nếu phát hiện virus, file bị chặn truy cập vật lý.

- **Quota management:**
  - Quota được reserve khi upload, release khi file bị xóa hoặc upload không hoàn tất.

- **Orphan file cleanup:**
  - Worker định kỳ kiểm tra file ở trạng thái `Initializing` quá hạn, trigger CleanupOrphanFileCommand.

## 5. Process Manager

### Giới thiệu

Process Manager (Saga/Orchestrator) trong RSM điều phối các workflow nhiều bước, lắng nghe sự kiện, phát sinh command tiếp theo, xử lý timeout, retry, hoặc orchestration giữa nhiều aggregate/stream.

### Đề xuất các Process Manager

- **UploadProcessManager:** Theo dõi trạng thái upload, orchestration upload/confirm, timeout, trigger cleanup nếu quá hạn. Đảm bảo idempotency và retry khi cần.
- **AntivirusProcessManager:** Theo dõi trạng thái quét virus, lắng nghe event upload thành công, phát ScanFileCommand, cập nhật trạng thái file, chặn truy cập nếu phát hiện virus.
- **QuotaProcessManager:** Theo dõi quota, lắng nghe event file bị xóa hoặc upload thất bại, trigger release quota, đảm bảo không double-release.

### Lưu ý thực thi

- Các process manager nên event-driven, subscribe các event liên quan, lưu trạng thái process (saga state), đảm bảo idempotency và khả năng retry.
- Có thể bổ sung bảng trạng thái process (process state table) để tracking các workflow dài hơi.
