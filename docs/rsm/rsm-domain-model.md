# Resource Management (RSM) Domain Model

Tài liệu này mô tả chi tiết mô hình miền cho bounded context **Resource Management Service (RSM)**, chịu trách nhiệm quản lý vòng đời tài nguyên số (file/object), kiểm soát quota, phân phối, bảo mật và cleanup tự động. Nội dung sử dụng tiếng Việt, giữ nguyên các thuật ngữ kỹ thuật bằng tiếng Anh (ví dụ: `File`, `StorageKey`, `Quota`, `AVStatus`, `UUID v7`).

---

## 1. Aggregate Roots

### 1.1 File (Aggregate Root)

`File` đại diện cho một tài nguyên số (file/object) trong hệ thống, liên kết với tenant, user/service, policy và trạng thái vòng đời.

| Field             | Type         | Mô tả                                                 |
| ----------------- | ------------ | ----------------------------------------------------- |
| `fileId`          | `FileId`     | Aggregate id (UUID v7)                                |
| `tenantId`        | `TenantId`   | Định danh tenant/namespace (UUID v7)                  |
| `ownerUserId?`    | `UserId`     | Chủ sở hữu là người dùng (nullable)                   |
| `ownerServiceId?` | `ServiceId`  | Chủ sở hữu là dịch vụ (nullable)                      |
| `fileName`        | `string`     | Tên gốc của file do client cung cấp                   |
| `mimeType`        | `MimeType`   | Kiểu nội dung (MIME)                                  |
| `size`            | `FileSize`   | Kích thước file (bytes)                               |
| `isPublic`        | `boolean`    | Hiển thị công khai (public) hoặc riêng tư (private)   |
| `storageKey`      | `StorageKey` | Khóa/đường dẫn object trong S3/MinIO                  |
| `status`          | `FileStatus` | `Initializing` / `Scanning` / `Available` / `Deleted` |
| `avStatus`        | `AVStatus`   | `Waiting` / `Scanning` / `Infected` / `Safe`          |
| `checksum?`       | `Checksum`   | Hash nội dung (SHA256, optional)                      |
| `createdAt`       | `DateTime`   | Thời điểm khởi tạo                                    |
| `updatedAt`       | `DateTime`   | Thời điểm cập nhật gần nhất                           |

**Invariants (Quy tắc Bất biến):**

- `fileId`, `storageKey` phải là duy nhất trong hệ thống.
- `size` >= 0, `mimeType` phải hợp lệ.
- Trạng thái vòng đời phải tuân thủ luồng nghiệp vụ (Initializing → Scanning → Available/Deleted).
- Chỉ file ở trạng thái `Available` mới được phân phối cho end-user.

### 1.2 StoragePolicy (Aggregate Root)

`StoragePolicy` định nghĩa chính sách lưu trữ áp dụng cho tenant/dịch vụ.

| Field              | Type          | Mô tả                                       |
| ------------------ | ------------- | ------------------------------------------- |
| `policyId`         | `PolicyId`    | Aggregate id (UUID v7)                      |
| `projectName`      | `string`      | Tên dự án áp dụng chính sách                |
| `serviceName`      | `string`      | Tên dịch vụ áp dụng chính sách              |
| `maxSize`          | `QuotaAmount` | Hạn ngạch dung lượng tổng cho dự án/dịch vụ |
| `allowedMimeTypes` | `MimeType[]`  | Danh sách MIME types được phép upload       |
| `createdAt`        | `DateTime`    | Thời điểm tạo policy                        |
| `updatedAt?`       | `DateTime`    | Thời điểm cập nhật gần nhất (nếu có)        |

**Invariants:**

- `maxSize` >= 0
- `allowedMimeTypes` không rỗng

---

## 2. Value Objects

### 2.1 FileId

- **Type:** string (UUID v7)
- **Business Invariants:** Phải là UUID v7, không thay đổi sau khi tạo.

### 2.2 StorageKey

- **Type:** string
- **Business Invariants:** Không chứa ký tự điều khiển, có cấu trúc tenant/.../fileId, duy nhất.

### 2.3 MimeType

- **Type:** string
- **Business Invariants:** Phải là MIME chuẩn (ví dụ: image/png).

### 2.4 FileSize

- **Type:** integer (bytes)
- **Business Invariants:** >= 0, không vượt quá quota policy.

### 2.5 Checksum

- **Type:** string (SHA-256, hex)
- **Business Invariants:** Non-empty nếu có, dùng để verify integrity.

### 2.6 QuotaAmount

- **Type:** integer (bytes)
- **Business Invariants:** >= 0

### 2.7 Visibility

- **Type:** enum (`public` | `private`)
- **Business Invariants:** Ảnh hưởng đến delivery logic và caching headers.

### 2.8 FileStatus

- **Type:** enum
- **Values:** `Initializing`, `Scanning`, `Available`, `Deleted`

### 2.9 AVStatus

- **Type:** enum
- **Values:** `Waiting`, `Scanning`, `Infected`, `Safe`

### 2.10 PolicyId

- **Type:** string (UUID v7)
- **Business Invariants:** Phải là UUID v7, không thay đổi sau khi tạo.

---

## 3. Events

Các domain event phát ra bởi các aggregate trong RSM. Mỗi event phải chứa metadata `traceId`/`causationId` để liên kết trace xuyên suốt. Không được chứa raw secrets hoặc dữ liệu nhạy cảm chưa mã hóa.

### 3.1 File Events

#### FileInitializedEvent

| Field            | Type       | Mô tả                          |
| ---------------- | ---------- | ------------------------------ |
| `fileId`         | `FileId`   | File được khởi tạo             |
| `tenantId`       | `TenantId` | Tenant sở hữu                  |
| `size`           | `FileSize` | Kích thước dự kiến             |
| `storageKey`     | `string`   | Storage key                    |
| `presignedMeta?` | `object`   | Metadata URL upload (tùy chọn) |
| `createdAt`      | `DateTime` | Thời điểm khởi tạo             |

#### FileUploadConfirmedEvent

| Field         | Type       | Mô tả                     |
| ------------- | ---------- | ------------------------- |
| `fileId`      | `FileId`   | File xác nhận upload      |
| `actualSize`  | `FileSize` | Kích thước thực tế        |
| `etags?`      | `string[]` | ETags xác nhận (tùy chọn) |
| `confirmedAt` | `DateTime` | Thời điểm xác nhận        |

#### FileUploadAbortedEvent

| Field       | Type       | Mô tả         |
| ----------- | ---------- | ------------- |
| `fileId`    | `FileId`   | File bị hủy   |
| `reason`    | `string`   | Lý do         |
| `abortedAt` | `DateTime` | Thời điểm hủy |

#### FileDeletedEvent

| Field       | Type       | Mô tả               |
| ----------- | ---------- | ------------------- |
| `fileId`    | `FileId`   | File bị xóa         |
| `deletedBy` | `string`   | Actor thực hiện xóa |
| `deletedAt` | `DateTime` | Thời điểm xóa       |

#### FileScanningStartedEvent

| Field           | Type       | Mô tả             |
| --------------- | ---------- | ----------------- |
| `fileId`        | `FileId`   | File bắt đầu quét |
| `scanRequestId` | `string`   | Id request quét   |
| `startedAt`     | `DateTime` | Thời điểm bắt đầu |

#### FileScanningCompletedEvent

| Field       | Type       | Mô tả                 |
| ----------- | ---------- | --------------------- |
| `fileId`    | `FileId`   | File hoàn tất quét    |
| `avStatus`  | `AVStatus` | Kết quả AV            |
| `scannedAt` | `DateTime` | Thời điểm hoàn tất    |
| `report?`   | `object`   | Báo cáo AV (tùy chọn) |

#### FileInfectedEvent

| Field        | Type       | Mô tả                |
| ------------ | ---------- | -------------------- |
| `fileId`     | `FileId`   | File nhiễm virus     |
| `threatInfo` | `object`   | Thông tin mối đe dọa |
| `detectedAt` | `DateTime` | Thời điểm phát hiện  |

### 3.2 Quota Events

#### QuotaReservedEvent

| Field           | Type          | Mô tả                  |
| --------------- | ------------- | ---------------------- |
| `tenantId`      | `TenantId`    | Tenant đặt trước quota |
| `reservationId` | `string`      | Id đặt trước           |
| `amountBytes`   | `QuotaAmount` | Số bytes đặt trước     |
| `reservedAt`    | `DateTime`    | Thời điểm đặt trước    |

#### QuotaReleasedEvent

| Field           | Type          | Mô tả                 |
| --------------- | ------------- | --------------------- |
| `tenantId`      | `TenantId`    | Tenant hoàn trả quota |
| `reservationId` | `string`      | Id đặt trước          |
| `amountBytes`   | `QuotaAmount` | Số bytes hoàn trả     |
| `reason`        | `string`      | Lý do                 |
| `releasedAt`    | `DateTime`    | Thời điểm hoàn trả    |

### 3.3 StoragePolicy Events

#### StoragePolicyCreatedEvent

| Field         | Type          | Mô tả           |
| ------------- | ------------- | --------------- |
| `policyId`    | `PolicyId`    | Policy được tạo |
| `projectName` | `string`      | Tên dự án       |
| `serviceName` | `string`      | Tên dịch vụ     |
| `maxSize`     | `QuotaAmount` | Hạn ngạch       |
| `mimes`       | `MimeType[]`  | MIME types      |
| `createdAt`   | `DateTime`    | Thời điểm tạo   |

#### StoragePolicyUpdatedEvent

| Field           | Type       | Mô tả                |
| --------------- | ---------- | -------------------- |
| `policyId`      | `PolicyId` | Policy được cập nhật |
| `updatedFields` | `object`   | Trường thay đổi      |
| `updatedAt`     | `DateTime` | Thời điểm cập nhật   |

---

## 4. Domain Services

Lưu ý: Domain service chỉ mô tả ý định nghiệp vụ, adapter/implementation phải tuân thủ các ràng buộc bảo mật và nhất quán dữ liệu.

### 4.1 FileService

- `initializeFile(tenantId: string, ownerUserId: string | null, ownerServiceId: string | null, fileName: string, mimeType: string, size: number): Promise<{fileId: string, storageKey: string, presignedMeta: object}>`
  - Khởi tạo file, cấp storage key và presigned URL upload. Persist metadata và emit `FileInitializedEvent`.
- `confirmUpload(fileId: string, actualSize: number, etags?: string[]): Promise<void>`
  - Xác nhận upload hoàn tất, cập nhật trạng thái, emit `FileUploadConfirmedEvent`.
- `abortUpload(fileId: string, reason: string): Promise<void>`
  - Hủy upload, cập nhật trạng thái, emit `FileUploadAbortedEvent`.
- `deleteFile(fileId: string, deletedBy: string): Promise<void>`
  - Xóa file (soft-delete), emit `FileDeletedEvent`.

### 4.2 QuotaService

- `reserveQuota(tenantId: string, amountBytes: number): Promise<{reservationId: string}>`
  - Đặt trước quota cho upload, emit `QuotaReservedEvent`.
- `releaseQuota(tenantId: string, reservationId: string, amountBytes: number, reason: string): Promise<void>`
  - Hoàn trả quota, emit `QuotaReleasedEvent`.

### 4.3 AVService

- `startScan(fileId: string): Promise<{scanRequestId: string}>`
  - Bắt đầu quét AV, emit `FileScanningStartedEvent`.
- `completeScan(fileId: string, avStatus: string, report?: object): Promise<void>`
  - Hoàn tất quét AV, emit `FileScanningCompletedEvent` hoặc `FileInfectedEvent` nếu phát hiện virus.

### 4.4 StoragePolicyService

- `createPolicy(projectName: string, serviceName: string, maxSize: number, mimes: string[]): Promise<{policyId: string}>`
  - Tạo mới policy, emit `StoragePolicyCreatedEvent`.
- `updatePolicy(policyId: string, updatedFields: object): Promise<void>`
  - Cập nhật policy, emit `StoragePolicyUpdatedEvent`.

---

## 5. Ports

Các port (interface) dưới đây định nghĩa hợp đồng tích hợp chính của BC RSM. Mỗi port gồm mô tả ngắn và danh sách hàm với input/output, ý nghĩa rõ ràng, theo đúng phong cách IDM.

### IFileRepository

Lưu trữ và truy vấn aggregate File (metadata, trạng thái, lookup, filter).

- `findById(fileId: string): Promise<File | null>`: Tìm file theo fileId.
- `findByStorageKey(storageKey: string): Promise<File | null>`: Tìm file theo storageKey.
- `findByTenant(tenantId: string, filter?: object, page?: number, pageSize?: number): Promise<File[]>`: Truy vấn file theo tenant, filter trạng thái, phân trang.
- `save(file: File): Promise<void>`: Lưu hoặc cập nhật file aggregate.
- `remove(fileId: string): Promise<void>`: Xóa (soft-delete) file.

### IQuotaRepository

Quản lý quota, reservation và release cho tenant/dịch vụ.

- `reserve(tenantId: string, amountBytes: number): Promise<{reservationId: string}>`: Đặt trước quota cho upload.
- `release(tenantId: string, reservationId: string, amountBytes: number): Promise<void>`: Hoàn trả quota đã đặt trước.
- `getAvailable(tenantId: string): Promise<number>`: Lấy quota còn lại của tenant.

### IAVScanService

Tích hợp dịch vụ quét virus/AV bên ngoài.

- `requestScan(fileId: string, storageKey: string): Promise<{scanRequestId: string}>`: Gửi yêu cầu quét file.
- `getScanResult(scanRequestId: string): Promise<{status: string, report?: object}>`: Lấy kết quả scan AV.

### IStoragePolicyRepository

Lưu trữ và truy vấn aggregate StoragePolicy.

- `findById(policyId: string): Promise<StoragePolicy | null>`: Tìm policy theo policyId.
- `findByProject(projectName: string): Promise<StoragePolicy[]>`: Tìm policy theo projectName.
- `save(policy: StoragePolicy): Promise<void>`: Lưu hoặc cập nhật policy.
- `remove(policyId: string): Promise<void>`: Xóa policy.

### IEventStore

Event sourcing cho các aggregate RSM (File, StoragePolicy, Quota, AV).

- `append(streamId: string, events: DomainEvent[]): Promise<void>`: Ghi events vào stream (append-only).
- `appendAtomic(writes: AtomicWriteRequest[]): Promise<void>`: Ghi nhiều events vào nhiều stream trong một giao dịch nguyên tử (Multi-Stream Atomic Write).
- `read(streamId: string, fromPosition?: number, limit?: number): Promise<DomainEvent[]>`: Đọc events từ stream.
- `subscribe(streamId: string, handler: (e: DomainEvent)=>Promise<void>): Promise<Subscription>`: Đăng ký nhận events (persistent subscription).
