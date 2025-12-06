# ADR-RM-2 — Direct-to-S3 Upload với Pre-signed URLs

## 1. Bối cảnh

Trong kiến trúc microservices truyền thống, việc upload file thường đi qua API server như một reverse proxy. Client upload file → API server nhận → API server ghi vào storage. Pattern này gặp các vấn đề:

**Bottleneck tại API Layer:**

- API servers phải xử lý toàn bộ traffic upload, consuming CPU/memory/network bandwidth
- Không scale horizontally hiệu quả vì I/O intensive
- Single point of failure cho upload operations

**Latency và User Experience:**

- Double network hop: Client → API → Storage (thay vì Client → Storage trực tiếp)
- Tăng latency cho end users, đặc biệt với large files
- API server timeout issues với uploads chậm

**Cost:**

- Phải provision API servers với high bandwidth
- Waste compute resources cho simple I/O proxying tasks

Resource Management cần xử lý millions of file uploads (images, documents, videos) từ diverse clients (web, mobile, external integrations) với varying network conditions.

## 2. Quyết định

Implement **Direct-to-Storage Upload** pattern sử dụng Pre-signed URLs:

### 2.1. Upload Flow

```
1. Client → POST /api/files/init { filename, size, mimeType }
2. API validates, reserves quota (ADR-RM-3)
3. API generates Pre-signed URL from S3/MinIO
4. API → Client { fileId, uploadUrl, expiresAt }
5. Client → PUT {uploadUrl} [binary data] (direct to S3)
6. S3 validates signature, accepts upload
7. Client → POST /api/files/{fileId}/confirm
8. API updates metadata, triggers scanning
```

### 2.2. Pre-signed URL Configuration

```typescript
interface PreSignedUrlOptions {
  bucket: string;
  key: string;
  contentType: string;
  contentLength: number;
  expiresIn: number; // seconds, default 3600 (1 hour)
  conditions: {
    'Content-Type': string;
    'Content-Length-Range': [min, max];
  };
}

async function generateUploadUrl(fileId: string, options: PreSignedUrlOptions): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: options.bucket,
    Key: options.key,
    ContentType: options.contentType,
  });

  return await s3Client.getSignedUrl(command, {
    expiresIn: options.expiresIn,
    // Enforce conditions for security
    signatureVersion: 'v4',
  });
}
```

### 2.3. Security Constraints

Pre-signed URLs enforce:

- **Content-Type**: Prevent MIME confusion attacks
- **Content-Length**: Prevent quota abuse
- **Expiration**: Short-lived (1 hour default) to limit exposure
- **Key prefix**: Isolate per tenant (`{tenantId}/{fileId}`)

## 3. Hệ quả

### Tích cực

- **Offload I/O**: API servers chỉ handle metadata operations, không touch file binary
- **Improved throughput**: Có thể handle 10x uploads so với reverse proxy approach
- **Better UX**: Lower latency, direct connection đến storage layer
- **Cost optimization**: Giảm bandwidth và compute requirements cho API tier
- **Scalability**: Storage layer (S3) scale infinitely, không cần scale API servers cho I/O
- **Resume capability**: Client có thể implement retry/resume với same URL

### Tiêu cực

- **Complexity**: Cần implement 2-phase upload (init + confirm)
- **Client requirements**: Client phải handle direct S3 upload (mostly không phải issue với modern SDKs)
- **Orphaned files risk**: Client có thể không confirm sau upload → mitigated bởi ADR-RM-6 (async cleanup)
- **Limited transformation**: Không thể transform file on-the-fly during upload (e.g., resize image) → có thể làm post-upload nếu cần
- **CORS configuration**: S3 bucket cần expose CORS để allow browser uploads

### Trade-offs

- **API không control upload process**: Trade-off cho performance. Mitigated bởi:
  - Validate trước khi issue URL
  - Verify sau khi confirm (file size, checksum if provided)
  - Async scanning (ADR-RM-4)

## 4. Các lựa chọn đã xem xét

- **Traditional reverse proxy (qua API server):**
  - _Lý do từ chối:_ Không scale, waste resources, poor UX, bottleneck tại API layer.

- **Multipart upload qua API:**
  - _Lý do từ chối:_ Vẫn proxy traffic qua API. Phức tạp hơn nhưng không giải quyết được root problem.

- **Upload qua CDN (như CloudFront):**
  - _Lý do từ chối:_ Thêm complexity và cost. CDN tốt cho distribution (read), không phải upload (write).

- **Persistent upload queues (như upload to message queue):**
  - _Lý do từ chối:_ Asynchronous nature khó cho user experience. Client cần biết khi nào upload complete.

- **Client-side encryption trước khi upload:**
  - _Decision:_ Có thể layer thêm sau nếu cần. Pre-signed URL pattern vẫn work với encrypted files. Not addressing immediate problem.
