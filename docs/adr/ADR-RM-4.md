# ADR-RM-4 — Hybrid Delivery Strategy (Stream vs Redirect)

## 1. Bối cảnh

Resource Management cần serve files với yêu cầu khác nhau tùy use case:

**Public Files (SEO & Performance):**

- Images/assets cho website cần index bởi search engines
- Cần CDN caching để reduce load và improve global latency
- Direct URL access từ browser (không yêu cầu authentication headers)
- Example: Product images, blog post images, public documents

**Private Files (Security & Access Control):**

- User documents, financial reports, private media
- Yêu cầu authentication và authorization check
- Không được public accessible hoặc sharable URLs
- Time-limited access (revocable)

**Vấn đề với single approach:**

1. **Nếu dùng Stream Proxy (200 OK) cho mọi files:**
   - ✅ Full control, có thể inject headers, modify response
   - ❌ API servers become I/O bottleneck (giống upload problem)
   - ❌ Waste bandwidth và compute resources
   - ❌ Khó scale cho high traffic

2. **Nếu dùng 302 Redirect cho mọi files:**
   - ✅ Offload traffic khỏi API servers
   - ❌ Search engines không index redirected content tốt
   - ❌ CDN không cache 302 responses efficiently
   - ❌ Extra network round-trip (latency overhead)

## 2. Quyết định

Implement **Hybrid Delivery Strategy** với intelligent routing dựa trên file visibility:

### 2.1. Strategy Matrix

| File Type | Visibility | Method          | Response       | CDN Cache  | Use Case               |
| --------- | ---------- | --------------- | -------------- | ---------- | ---------------------- |
| Public    | public     | Stream Proxy    | 200 + Body     | Aggressive | SEO, Marketing, Assets |
| Private   | private    | Signed Redirect | 302 + Location | None       | User Docs, Internal    |

### 2.2. Stream Proxy Implementation (Public Files)

```typescript
@Get('/files/:fileId')
@Public() // No authentication required
async servePublicFile(
  @Param('fileId') fileId: string,
  @Res() response: Response
) {
  // 1. Lookup file metadata
  const file = await this.fileRepository.findById(fileId);

  // 2. Verify public visibility
  if (!file.isPublic) {
    throw new ForbiddenException('File is private');
  }

  // 3. Check file status
  if (file.status !== 'AVAILABLE') {
    throw new NotFoundException('File not ready');
  }

  // 4. Stream from S3
  const s3Stream = await this.storageService.getObjectStream({
    bucket: file.bucket,
    key: file.storageKey
  });

  // 5. Set CDN-friendly headers
  response.set({
    'Content-Type': file.mimeType,
    'Content-Length': file.size.toString(),
    'Cache-Control': 'public, max-age=31536000, immutable', // 1 year
    'ETag': file.etag,
    'Last-Modified': file.updatedAt.toUTCString(),
  });

  // 6. Pipe stream to response
  s3Stream.pipe(response);
}
```

### 2.3. Signed Redirect Implementation (Private Files)

```typescript
@Get('/files/:fileId')
@UseGuards(JwtAuthGuard) // Authentication required
async servePrivateFile(
  @Param('fileId') fileId: string,
  @CurrentUser() user: User,
  @Res() response: Response
) {
  // 1. Lookup file metadata
  const file = await this.fileRepository.findById(fileId);

  // 2. Authorization check (ADR-RM-5)
  const hasAccess = await this.authzService.checkFileAccess(
    user.id,
    user.tenantId,
    fileId
  );
  if (!hasAccess) {
    throw new ForbiddenException('Access denied');
  }

  // 3. Check file status
  if (file.status === 'SCANNING') {
    throw new FileScanningException('File is being scanned');
  }
  if (file.status === 'INFECTED') {
    throw new FileInfectedException('File contains malware');
  }

  // 4. Generate short-lived signed URL (5 minutes)
  const signedUrl = await this.storageService.getSignedUrl({
    bucket: file.bucket,
    key: file.storageKey,
    expiresIn: 300, // 5 minutes
  });

  // 5. Redirect client to S3
  response.redirect(302, signedUrl);
}
```

### 2.4. Routing Logic

```typescript
function determineDeliveryMethod(file: File, user?: User): 'stream' | 'redirect' {
  // Rule 1: Public files → Stream (for SEO and CDN)
  if (file.isPublic) {
    return 'stream';
  }

  // Rule 2: Private files → Redirect (for security)
  if (!file.isPublic && user) {
    return 'redirect';
  }

  // Rule 3: No auth for private → deny
  throw new UnauthorizedException('Authentication required');
}
```

## 3. Hệ quả

### Tích cực

- **Optimized SEO**: Public files served với 200 response, search engines có thể index và cache
- **CDN efficiency**: Stream proxy cho public files work tốt với CDN caching layers
- **Security**: Private files không expose permanent URLs, time-limited access
- **Performance**: Offload private file traffic khỏi API servers qua S3 signed URLs
- **Flexibility**: Có thể thêm transformation layers (image resize) trước stream cho public files
- **Cost optimization**: Giảm egress costs từ API tier, leverage S3 direct transfer

### Tiêu cực

- **Complexity**: Maintain 2 code paths cho file delivery
- **Inconsistent URLs**: Public files có stable URLs, private files có temporary URLs
- **CDN config**: Cần configure CDN để respect Cache-Control headers correctly
- **Monitoring**: Phải monitor 2 delivery paths separately (stream errors vs redirect errors)

### Trade-offs

- **Public file bandwidth costs**: Stream proxy tăng API tier bandwidth. Mitigated bởi:
  - CDN caching (most traffic hits CDN, not origin)
  - Aggressive cache headers (1 year TTL)
  - Immutable content (content-addressed URLs)

- **Private file UX**: Extra redirect hop tăng latency ~100ms. Acceptable vì:
  - Security requirement justifies tradeoff
  - Alternative (stream proxy) không scale
  - 100ms acceptable cho private document access

## 4. Các lựa chọn đã xem xét

- **Stream proxy cho tất cả:**
  - _Lý do từ chối:_ Không scale, API servers thành I/O bottleneck, waste resources.

- **Redirect cho tất cả:**
  - _Lý do từ chối:_ SEO issues cho public content, CDN caching không efficient.

- **Pre-generated public URLs (permanent S3 URLs):**
  - _Lý do từ chối:_ Không có revocation mechanism, khó migrate storage backend, khó inject headers hoặc transformations.

- **CloudFront signed cookies cho private files:**
  - _Lý do từ chối:_ Vendor lock-in, complexity setup, không cần cho current scale. 302 redirect đơn giản hơn.

- **Separate domains (public.example.com vs private.example.com):**
  - _Decision:_ Có thể consider sau cho advanced CDN routing. Current single-domain approach đơn giản hơn.
