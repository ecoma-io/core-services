# ADR-IAM-5 — Chính sách Snapshot cho Aggregates (Snapshot Policy)

## 1. Bối cảnh

Trong Event Sourcing, để rehydrate một Aggregate, hệ thống phải replay tất cả events từ đầu stream. Khi số lượng events tăng lên (ví dụ: một User có 1000+ events qua nhiều năm), performance của rehydration bị ảnh hưởng nghiêm trọng:

- **Latency:** Thời gian load aggregate tăng tuyến tính với số events
- **Database load:** Phải đọc nhiều events từ Event Store DB
- **Network overhead:** Transfer nhiều dữ liệu qua network
- **Memory pressure:** Phải giữ nhiều events trong memory để replay

**Snapshot** là giải pháp: Lưu trữ state của Aggregate tại một thời điểm cụ thể. Khi rehydrate, chỉ cần:

1. Load snapshot gần nhất
2. Replay các events sau snapshot

**Trade-offs cần cân nhắc:**

- **Quá thường xuyên:** Tốn storage và overhead cho việc tạo snapshot
- **Quá ít:** Không giải quyết được vấn đề performance
- **Storage:** Snapshot có thể rất lớn (ví dụ: Aggregate có nhiều nested entities)
- **Versioning:** Aggregate structure thay đổi theo thời gian, cần handle snapshot migration

## 2. Quyết định

Implement **Hybrid Snapshot Policy** dựa trên cả số lượng events và thời gian, với storage strategy phân tầng và versioning support.

### 2.1. Snapshot Trigger Policy

Snapshot được tạo khi **bất kỳ** điều kiện nào sau đây thỏa mãn:

```typescript
interface SnapshotPolicy {
  // Số events kể từ snapshot trước
  eventCountThreshold: number;

  // Thời gian kể từ snapshot trước (ms)
  timeThreshold: number;

  // Per-aggregate type override
  aggregateSpecific?: {
    [aggregateType: string]: {
      eventCountThreshold?: number;
      timeThreshold?: number;
    };
  };
}

const DEFAULT_POLICY: SnapshotPolicy = {
  eventCountThreshold: 100,
  timeThreshold: 24 * 60 * 60 * 1000, // 24 hours
  aggregateSpecific: {
    User: {
      eventCountThreshold: 50, // Users change frequently
    },
    Tenant: {
      eventCountThreshold: 200, // Tenants change less
    },
    Role: {
      eventCountThreshold: 150,
    },
  },
};
```

**Rationale cho thresholds:**

- **100 events:** Empirical testing cho thấy replay 100 events mất ~50ms. Chấp nhận được.
- **24 hours:** Đảm bảo có ít nhất 1 snapshot/day cho audit và recovery.
- **User = 50:** Users có nhiều actions (login, profile update), cần snapshot thường xuyên hơn.

### 2.2. Snapshot Storage Strategy

Phân tầng storage dựa trên kích thước:

```typescript
interface SnapshotMetadata {
  aggregateId: string;
  aggregateType: string;
  lastEventPosition: number;
  lastEventId: string;
  snapshotVersion: number; // For migration
  createdAt: Date;
  storageType: 'inline' | 'blob';
  blobReference?: string; // If stored in blob store
}

const INLINE_SIZE_THRESHOLD = 256 * 1024; // 256KB

async function saveSnapshot(aggregate: AggregateRoot): Promise<void> {
  const state = aggregate.getState();
  const serialized = JSON.stringify(state);
  const size = Buffer.byteLength(serialized);

  const metadata: SnapshotMetadata = {
    aggregateId: aggregate.id,
    aggregateType: aggregate.constructor.name,
    lastEventPosition: aggregate.version,
    lastEventId: aggregate.lastEventId,
    snapshotVersion: CURRENT_SNAPSHOT_VERSION,
    createdAt: new Date(),
    storageType: size <= INLINE_SIZE_THRESHOLD ? 'inline' : 'blob',
  };

  if (metadata.storageType === 'inline') {
    // Store in PostgreSQL directly
    await db.snapshots.insert({
      ...metadata,
      data: serialized,
    });
  } else {
    // Store in blob storage (S3/MinIO)
    const blobKey = `snapshots/${aggregate.type}/${aggregate.id}/${Date.now()}`;
    await blobStorage.put(blobKey, serialized);

    await db.snapshots.insert({
      ...metadata,
      blobReference: blobKey,
    });
  }
}
```

### 2.3. Snapshot Versioning & Migration

Support cho structural changes của Aggregates:

```typescript
interface SnapshotUpcaster {
  fromVersion: number;
  toVersion: number;
  upcast(data: any): any;
}

const SNAPSHOT_UPCASTERS: SnapshotUpcaster[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    upcast(data: any) {
      // User snapshot v1 -> v2: add emailVerified field
      return {
        ...data,
        emailVerified: data.email ? false : true,
      };
    },
  },
];

async function loadSnapshot(aggregateId: string): Promise<AggregateState | null> {
  const metadata = await db.snapshots.findLatest(aggregateId);
  if (!metadata) return null;

  let data: string;
  if (metadata.storageType === 'inline') {
    data = metadata.data;
  } else {
    data = await blobStorage.get(metadata.blobReference);
  }

  let state = JSON.parse(data);

  // Upcast if needed
  let currentVersion = metadata.snapshotVersion;
  while (currentVersion < CURRENT_SNAPSHOT_VERSION) {
    const upcaster = SNAPSHOT_UPCASTERS.find((u) => u.fromVersion === currentVersion);
    if (!upcaster) {
      throw new Error(`Missing upcaster from version ${currentVersion}`);
    }
    state = upcaster.upcast(state);
    currentVersion = upcaster.toVersion;
  }

  return state;
}
```

### 2.4. Snapshot Lifecycle Management

Retention policy để tránh storage bloat:

```typescript
const SNAPSHOT_RETENTION = {
  keepLatestCount: 3, // Always keep 3 latest
  deleteOlderThanDays: 90, // Delete older than 90 days (except latest 3)
};

async function cleanupOldSnapshots(aggregateId: string): Promise<void> {
  const snapshots = await db.snapshots.findAll(aggregateId).orderBy('createdAt', 'DESC');

  // Keep latest 3
  const toKeep = snapshots.slice(0, SNAPSHOT_RETENTION.keepLatestCount);
  const candidates = snapshots.slice(SNAPSHOT_RETENTION.keepLatestCount);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - SNAPSHOT_RETENTION.deleteOlderThanDays);

  for (const snapshot of candidates) {
    if (snapshot.createdAt < cutoffDate) {
      if (snapshot.storageType === 'blob') {
        await blobStorage.delete(snapshot.blobReference);
      }
      await db.snapshots.delete(snapshot.id);
    }
  }
}

// Scheduled job
cron.schedule('0 2 * * *', async () => {
  // Run cleanup at 2 AM daily
  const aggregates = await db.snapshots.getDistinctAggregateIds();
  for (const aggregateId of aggregates) {
    await cleanupOldSnapshots(aggregateId);
  }
});
```

### 2.5. On-Demand Snapshot Operations

Admin tools cho manual operations:

```typescript
// Force create snapshot
async function forceSnapshot(aggregateId: string): Promise<void> {
  const aggregate = await loadAggregate(aggregateId);
  await saveSnapshot(aggregate);
}

// Rebuild aggregate from events (bypass snapshot)
async function rebuildFromEvents(aggregateId: string): Promise<void> {
  const events = await eventStore.readStream(aggregateId, 0);
  const aggregate = new AggregateRoot();
  for (const event of events) {
    aggregate.apply(event);
  }
  // Create fresh snapshot
  await saveSnapshot(aggregate);
}
```

## 3. Hệ quả

### Tích cực

- **Performance improvement:** Giảm ~90% thời gian rehydration cho aggregates có nhiều events
- **Flexible policy:** Có thể tune per-aggregate type
- **Storage efficient:** Phân tầng inline/blob dựa trên size
- **Evolvability:** Versioning và upcasting hỗ trợ structural changes
- **Operational control:** Admin tools cho force snapshot và rebuild

### Tiêu cực

- **Complexity:** Thêm logic snapshot creation, storage, versioning và cleanup
- **Storage cost:** Phải lưu snapshots (mitigated bởi retention policy)
- **Consistency:** Snapshot có thể stale nếu không cleanup đúng
- **Testing:** Phải test snapshot creation, loading, upcasting và cleanup
- **Monitoring:** Cần monitor snapshot creation failures và storage usage

## 4. Các lựa chọn đã xem xét

- **Không dùng snapshot:**
  - _Lý do từ chối:_ Performance degradation nghiêm trọng cho long-lived aggregates. Không chấp nhận được cho production.

- **Snapshot sau mỗi N events (chỉ event count):**
  - _Lý do từ chối:_ Không đảm bảo có snapshot gần đây cho aggregates ít thay đổi. Khó cho audit và recovery.

- **Snapshot theo time interval chặt chẽ (ví dụ: mỗi giờ):**
  - _Lý do từ chối:_ Tốn overhead cho aggregates không thay đổi. Waste storage và compute.

- **Lazy snapshot (tạo khi load chậm):**
  - _Lý do từ chối:_ User request bị penalty khi trigger snapshot creation. Không predictable.

- **Lưu tất cả snapshots không retention:**
  - _Lý do từ chối:_ Storage cost tăng vô hạn. Không sustainable.
