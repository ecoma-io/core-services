# ADR-RM-6 — Async Cleanup với Delayed Queue

## 1. Bối cảnh

Direct-to-S3 upload flow (ADR-RM-2) có 2-phase process:

```
1. Client: POST /files/init → Server reserves quota, issues pre-signed URL
2. Client: PUT {S3 URL} → Upload directly to S3
3. Client: POST /files/{id}/confirm → Server finalizes upload
```

**Problem: Orphaned Files**

Nhiều scenarios client không complete phase 3:

- Network timeout giữa phase 2 và 3
- Client app crash sau upload
- User close browser/app
- Client bug không gọi confirm API

Result: **Orphaned files** = files uploaded to S3 nhưng never confirmed:

- File metadata status = `Initializing` (never moved to `Available`)
- Quota đã reserved nhưng file không được sử dụng
- Storage waste (file tồn tại trong S3 but không accessible)

**Scale of problem:**

- Với 1% incomplete upload rate và 100K uploads/day
- → 1000 orphaned files/day = ~10GB waste/day
- → 300GB/month storage waste + quota permanently locked

**Requirements:**

- Automatically detect và cleanup orphaned files
- Refund reserved quota khi cleanup
- Không impact normal upload flow
- Không require manual intervention
- Balance giữa: cleanup too early (legitimate slow uploads) vs too late (waste accumulation)

## 2. Quyết định

Implement **Delayed Queue Pattern** với safety window:

### 2.1. Workflow Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Init Upload                                        │
│  - Reserve quota                                            │
│  - Create DB record (status=Initializing)                  │
│  - Publish {fileId} to DelayedQueue (delay=1h)             │
│  - Return pre-signed URL                                   │
└─────────────────────────────────────────────────────────────┘
                         │
                         │  Normal case: Client uploads & confirms <1h
                         │  Orphan case: Client never confirms
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Cleanup Check (after 1h delay)                    │
│  - CleanupWorker consumes message from DelayedQueue        │
│  - Check DB: file.status still 'Initializing'?             │
│    → YES: Orphaned file detected, proceed cleanup          │
│    → NO: File confirmed, ignore message                    │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼ (if orphaned)
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: Cleanup Execution                                  │
│  - Delete file from S3                                      │
│  - Refund quota (Redis)                                     │
│  - Update DB: file.status = 'Deleted'                       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2. RabbitMQ Delayed Message Configuration

```yaml
# Exchange configuration
exchange:
  name: resource.delayed
  type: x-delayed-message
  arguments:
    x-delayed-type: direct

# Queue configuration
queue:
  name: resource.cleanup
  durable: true
  arguments:
    x-dead-letter-exchange: resource.cleanup.dlq
    x-message-ttl: 3600000 # 1 hour backup TTL
```

### 2.3. Implementation

**Init Upload (Publish to Delayed Queue):**

```typescript
@Injectable()
export class FileUploadService {
  async initUpload(tenantId: string, fileName: string, size: number): Promise<UploadInitResponse> {
    // 1. Reserve quota
    const quotaOk = await this.quotaService.reserve(tenantId, size);
    if (!quotaOk) {
      throw new QuotaExceededException();
    }

    try {
      // 2. Create DB record
      const file = await this.fileRepository.create({
        tenantId,
        fileName,
        size,
        status: 'Initializing',
      });

      // 3. Generate pre-signed URL
      const uploadUrl = await this.storageService.generateUploadUrl(file.id);

      // 4. Schedule cleanup check (delayed 1 hour)
      await this.messageQueue.publish(
        'resource.delayed',
        {
          action: 'CHECK_ORPHAN',
          fileId: file.id,
          tenantId,
          size,
        },
        {
          headers: {
            'x-delay': 3600000, // 1 hour in milliseconds
          },
        }
      );

      return {
        fileId: file.id,
        uploadUrl,
        expiresAt: addHours(new Date(), 1),
      };
    } catch (error) {
      // Rollback quota on any error
      await this.quotaService.refund(tenantId, size);
      throw error;
    }
  }
}
```

**Cleanup Worker (Consume Delayed Messages):**

```typescript
@Injectable()
export class CleanupWorker {
  @RabbitSubscribe({
    exchange: 'resource.delayed',
    routingKey: 'resource.cleanup',
    queue: 'resource.cleanup',
  })
  async handleCleanupCheck(message: CleanupMessage) {
    const { fileId, tenantId, size } = message;

    try {
      // 1. Check file status
      const file = await this.fileRepository.findById(fileId);

      if (!file) {
        // File already deleted by other means, skip
        return;
      }

      if (file.status !== 'Initializing') {
        // File was confirmed, no cleanup needed
        this.logger.log(`File ${fileId} confirmed, skipping cleanup`);
        return;
      }

      // 2. Orphaned file detected, proceed cleanup
      this.logger.warn(`Cleaning up orphaned file: ${fileId}`);

      // 3. Delete from S3
      try {
        await this.storageService.deleteObject({
          bucket: file.bucket,
          key: file.storageKey,
        });
      } catch (error) {
        // S3 delete can fail if file was never uploaded
        // Log but continue cleanup
        this.logger.error(`S3 delete failed for ${fileId}`, error);
      }

      // 4. Refund quota (MUST always execute)
      await this.quotaService.refund(tenantId, size);

      // 5. Mark as deleted in DB
      await this.fileRepository.update(fileId, {
        status: 'Deleted',
        deletedAt: new Date(),
      });

      // 6. Emit cleanup event for observability
      await this.eventBus.publish(
        new FileCleanedUpEvent({
          fileId,
          tenantId,
          reason: 'orphaned',
          sizeReclaimed: size,
        })
      );
    } catch (error) {
      // Log error and let message go to DLQ for manual intervention
      this.logger.error(`Cleanup failed for ${fileId}`, error);
      throw error;
    }
  }
}
```

**Confirm Upload (Happy Path):**

```typescript
async confirmUpload(fileId: string, checksum?: string) {
  const file = await this.fileRepository.findById(fileId);

  if (file.status !== 'Initializing') {
    throw new BadRequestException('File already confirmed or deleted');
  }

  // Optional: Verify file exists in S3 và matches size
  const s3Metadata = await this.storageService.headObject({
    bucket: file.bucket,
    key: file.storageKey,
  });

  if (s3Metadata.size !== file.size) {
    throw new BadRequestException('File size mismatch');
  }

  // Update status → Cleanup worker will skip this file
  await this.fileRepository.update(fileId, {
    status: 'Scanning', // Move to next stage
    confirmedAt: new Date(),
  });

  // Publish event cho antivirus worker
  await this.eventBus.publish(new FileUploadedEvent({ fileId }));
}
```

### 2.4. Monitoring & Alerting

```typescript
// Metrics
const METRICS = {
  orphaned_files_cleaned: new Counter({
    name: 'resource_orphaned_files_cleaned_total',
    help: 'Total orphaned files cleaned up',
    labelNames: ['tenant_id'],
  }),

  quota_refunded: new Counter({
    name: 'resource_quota_refunded_bytes_total',
    help: 'Total quota refunded from cleanup',
    labelNames: ['tenant_id'],
  }),

  cleanup_failures: new Counter({
    name: 'resource_cleanup_failures_total',
    help: 'Total cleanup failures',
    labelNames: ['error_type'],
  }),
};

// Alert rules
const ALERTS = [
  {
    name: 'HighOrphanedFileRate',
    condition: 'rate(resource_orphaned_files_cleaned_total[1h]) > 100',
    severity: 'warning',
    description: 'Orphaned file rate is high, investigate client issues',
  },
  {
    name: 'CleanupWorkerDown',
    condition: 'up{job="cleanup-worker"} == 0',
    severity: 'critical',
    description: 'Cleanup worker is down, orphaned files accumulating',
  },
];
```

## 3. Hệ quả

### Tích cực

- **Automatic cleanup**: Không require manual intervention
- **Quota recovery**: Reserved quota được refund, prevent quota leak
- **Storage optimization**: Waste files removed, save cost
- **Safe window**: 1 hour delay accommodate slow uploads (large files, slow network)
- **Idempotent**: Cleanup worker can process same message multiple times safely
- **Observable**: Metrics và events provide visibility into cleanup operations

### Tiêu cực

- **1-hour delay**: Orphaned files tồn tại tối thiểu 1 giờ trước cleanup
  - Trade-off: shorter delay risk cleaning legitimate slow uploads
  - Acceptable: 1 giờ balance giữa safety và cleanup efficiency
- **RabbitMQ dependency**: Cleanup không work nếu RabbitMQ down
  - Mitigated: RabbitMQ Cluster cho HA, messages persisted (durable queue)
  - Backup: Có thể add cronjob scan DB cho old `Initializing` files as fallback
- **Extra message per upload**: Mỗi upload create 1 delayed message
  - Minimal overhead, acceptable cho benefit

### Trade-offs

- **Delay duration (1 hour) vs Storage waste**: Shorter delay = less waste nhưng risk false positives
  - Decision: 1 hour generous cho legitimate uploads, acceptable waste accumulation

## 4. Các lựa chọn đã xem xét

- **Cronjob scan database cho orphaned files:**
  - _Lý do từ chối:_ Không real-time, full table scan expensive, complex query (WHERE status='Initializing' AND created_at < NOW() - INTERVAL '1 hour'). Delayed queue elegant hơn.

- **S3 Lifecycle Rules để auto-delete:**
  - _Lý do từ chối:_ Không trigger quota refund, không update DB. Need application-level logic.

- **Shorter delay (15 minutes):**
  - _Lý do từ chối:_ Risk cleaning legitimate slow uploads (large files, slow network). 1 hour safer.

- **Longer delay (24 hours):**
  - _Lý do từ chối:_ Too much waste accumulation. 1 hour balance better.

- **No cleanup, let storage accumulate:**
  - _Lý do từ chối:_ Waste money, quota leak critical issue. Must cleanup.
