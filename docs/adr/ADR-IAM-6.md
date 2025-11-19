# ADR-IAM-6 — Ngữ nghĩa Checkpoint cho Projectors (Projection Checkpoint Semantics)

## 1. Bối cảnh

Projectors trong CQRS/ES architecture lắng nghe domain events và cập nhật Read Models. Để đảm bảo reliability và correctness, cần giải quyết các vấn đề:

**1. Progress Tracking:**

- Projector cần biết event nào đã được xử lý để không bị miss events hoặc process duplicate
- Khi projector restart (deploy mới, crash), phải resume từ đúng vị trí

**2. Read Your Own Writes (RYOW):**

- Query API cần biết projector đã xử lý đến event nào để quyết định có cần đợi không
- Cần checkpoint granular (per-stream hoặc global) để support RYOW efficiently

**3. Replay & Rebuild:**

- Khi cần rebuild Read Model (fix bug, change schema), phải reset checkpoint về 0
- Cần pause live consumption trong lúc replay để tránh conflicts

**4. Error Handling:**

- Khi event xử lý fail, cần track error count để trigger alerts
- Checkpoint không được tiến lên nếu xử lý fail (at-least-once semantics)

**5. Transactional Consistency:**

- Cập nhật Read Model và checkpoint phải atomic
- Nếu update Read Model thành công nhưng checkpoint fail → duplicate processing
- Nếu checkpoint thành công nhưng update Read Model fail → data loss

## 2. Quyết định

Implement **Per-Projector, Per-Stream Checkpoint** với transactional guarantees và admin control capabilities.

### 2.1. Checkpoint Schema

Lưu checkpoint trong cùng PostgreSQL database với Read Models:

```sql
CREATE TABLE projection_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projector_name VARCHAR(255) NOT NULL,
  stream_name VARCHAR(255) NOT NULL,
  last_position BIGINT NOT NULL,
  last_event_id UUID NOT NULL,
  last_event_type VARCHAR(255),
  updated_at TIMESTAMP DEFAULT NOW(),
  error_count INT DEFAULT 0,
  last_error TEXT,
  status VARCHAR(50) DEFAULT 'running',  -- running, paused, rebuilding, error

  UNIQUE(projector_name, stream_name)
);

CREATE INDEX idx_checkpoints_projector ON projection_checkpoints(projector_name);
CREATE INDEX idx_checkpoints_status ON projection_checkpoints(status);
```

**Design choices:**

- `projector_name`: Identify which projector (e.g., 'user-projector', 'role-projector')
- `stream_name`: Identify which stream (e.g., 'user-123', '$all' for global)
- `last_position`: Event sequence number trong stream
- `last_event_id`: UUID của event (cho idempotency check)
- `status`: Support pause/resume và rebuild workflows

### 2.2. Transactional Update Pattern

Đảm bảo atomicity giữa Read Model update và checkpoint update:

```typescript
async function handleEvent(event: DomainEvent): Promise<void> {
  const projectorName = this.constructor.name;

  await this.db.transaction(async (tx) => {
    // 1. Check idempotency
    const checkpoint = await tx.checkpoints.findOne({
      projector_name: projectorName,
      stream_name: event.streamId,
    });

    if (checkpoint && checkpoint.last_event_id === event.eventId) {
      // Already processed, skip
      return;
    }

    // 2. Update Read Model
    await this.updateReadModel(event, tx);

    // 3. Update checkpoint
    await tx.checkpoints.upsert({
      projector_name: projectorName,
      stream_name: event.streamId,
      last_position: event.position,
      last_event_id: event.eventId,
      last_event_type: event.type,
      updated_at: new Date(),
      error_count: 0, // Reset on success
      last_error: null,
      status: 'running',
    });
  });
}
```

**Rationale cho transactional approach:**

- **Atomic:** Hoặc cả 2 thành công, hoặc cả 2 fail → no partial state
- **Co-located storage:** Checkpoint và Read Model cùng DB → có thể dùng DB transaction
- **Performance:** Single transaction thay vì 2 separate writes

### 2.3. Error Handling & Retry

Track errors và support retry logic:

```typescript
async function handleEventWithRetry(event: DomainEvent): Promise<void> {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await this.handleEvent(event);
      return; // Success
    } catch (error) {
      attempt++;

      // Log error với context
      await this.logError(event, error, attempt);

      if (attempt >= maxRetries) {
        // Mark checkpoint as error
        await this.db.checkpoints.update(
          {
            projector_name: this.constructor.name,
            stream_name: event.streamId,
          },
          {
            error_count: attempt,
            last_error: error.message,
            status: 'error',
          }
        );

        // Send to DLQ
        await this.sendToDLQ(event, error);

        // Alert ops team
        await this.alerting.critical('Projector failed after retries', {
          projector: this.constructor.name,
          event: event.eventId,
          error: error.message,
        });

        throw error; // Stop processing this event
      }

      // Exponential backoff
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
}
```

### 2.4. Idempotency Guarantees

Đảm bảo idempotent processing:

```typescript
// Strategy 1: Check event ID in checkpoint
async function isEventProcessed(eventId: string): Promise<boolean> {
  const checkpoint = await this.db.checkpoints.findOne({
    projector_name: this.constructor.name,
    last_event_id: eventId
  });
  return !!checkpoint;
}

// Strategy 2: Unique constraints in Read Model
// Example: User table với unique constraint on userId
async function updateUserReadModel(event: UserRegisteredEvent): Promise<void> {
  await this.db.users.insert({
    user_id: event.userId,  // UNIQUE constraint
    email: event.email,
    name: event.name,
    created_at: event.timestamp
  }).onConflict('user_id').ignore();  // Idempotent
}

// Strategy 3: Store processed event IDs
CREATE TABLE processed_events (
  projector_name VARCHAR(255),
  event_id UUID,
  processed_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (projector_name, event_id)
);
```

**Recommendation:** Combine Strategy 1 + 2:

- Checkpoint event ID check for quick short-circuit
- Unique constraints in Read Model as last defense

### 2.5. Admin Operations

Support cho operational workflows:

```typescript
class ProjectorAdminService {
  // Pause projector (for maintenance)
  async pauseProjector(projectorName: string): Promise<void> {
    await this.db.checkpoints.update({ projector_name: projectorName }, { status: 'paused' });
    await this.stopConsumer(projectorName);
  }

  // Resume projector
  async resumeProjector(projectorName: string): Promise<void> {
    await this.db.checkpoints.update({ projector_name: projectorName }, { status: 'running' });
    await this.startConsumer(projectorName);
  }

  // Reset checkpoint (for full rebuild)
  async resetCheckpoint(projectorName: string): Promise<void> {
    await this.pauseProjector(projectorName);

    await this.db.transaction(async (tx) => {
      // Clear Read Models
      await this.truncateReadModels(projectorName, tx);

      // Reset checkpoint
      await tx.checkpoints.update(
        { projector_name: projectorName },
        {
          last_position: 0,
          last_event_id: null,
          error_count: 0,
          status: 'rebuilding',
        }
      );
    });
  }

  // Set checkpoint to specific position (advanced)
  async setCheckpoint(projectorName: string, streamName: string, position: number): Promise<void> {
    await this.db.checkpoints.update({ projector_name: projectorName, stream_name: streamName }, { last_position: position });
  }

  // Get checkpoint status for monitoring
  async getCheckpointStatus(projectorName: string): Promise<CheckpointStatus> {
    const checkpoints = await this.db.checkpoints.find({
      projector_name: projectorName,
    });

    return {
      projector: projectorName,
      streams: checkpoints.map((cp) => ({
        streamName: cp.stream_name,
        position: cp.last_position,
        lastUpdated: cp.updated_at,
        status: cp.status,
        errorCount: cp.error_count,
      })),
      overallStatus: this.calculateOverallStatus(checkpoints),
    };
  }
}
```

### 2.6. Monitoring & Alerting

Metrics để track projector health:

```typescript
// Prometheus metrics
const metrics = {
  checkpointLag: new Gauge({
    name: 'projector_checkpoint_lag',
    help: 'Number of events behind latest',
    labelNames: ['projector', 'stream'],
  }),

  eventsProcessed: new Counter({
    name: 'projector_events_processed_total',
    help: 'Total events processed',
    labelNames: ['projector', 'event_type', 'status'],
  }),

  processingDuration: new Histogram({
    name: 'projector_processing_duration_seconds',
    help: 'Time to process event',
    labelNames: ['projector', 'event_type'],
  }),
};

// Alert rules
const alerts = [
  {
    name: 'ProjectorLagging',
    condition: 'projector_checkpoint_lag > 1000',
    severity: 'warning',
    message: 'Projector is lagging behind by more than 1000 events',
  },
  {
    name: 'ProjectorErrorRate',
    condition: 'rate(projector_events_processed_total{status="error"}[5m]) > 0.01',
    severity: 'critical',
    message: 'Projector error rate exceeds 1%',
  },
  {
    name: 'ProjectorStuck',
    condition: 'time() - projector_checkpoint_updated_at > 600',
    severity: 'critical',
    message: 'Projector checkpoint has not updated in 10 minutes',
  },
];
```

## 3. Hệ quả

### Tích cực

- **Reliability:** At-least-once processing với idempotency → no data loss
- **Observability:** Checkpoint status cung cấp visibility vào projector progress
- **RYOW support:** Query API có thể check checkpoint để implement RYOW
- **Operational control:** Admin operations cho pause/resume/rebuild
- **Transactional:** Atomic updates giữa Read Model và checkpoint
- **Error resilience:** Track errors và support retry với alerting

### Tiêu cực

- **Coupling:** Checkpoint phải co-locate với Read Model DB (hoặc dùng distributed transaction)
- **Overhead:** Mỗi event processing cần 2 writes (Read Model + checkpoint)
- **Complexity:** Logic transactional và idempotency phức tạp
- **Storage:** Processed events table có thể lớn (mitigate bằng TTL)
- **Testing:** Phải test nhiều edge cases (failure scenarios, idempotency, etc.)

## 4. Các lựa chọn đã xem xét

- **Global checkpoint (single position for all streams):**
  - _Lý do từ chối:_ Không hỗ trợ parallel processing của nhiều streams. RYOW không efficient.

- **Checkpoint trong RabbitMQ (consumer offset):**
  - _Lý do từ chối:_ Không transactional với Read Model updates. Có thể lose checkpoint khi RabbitMQ restart.

- **Checkpoint trong separate database:**
  - _Lý do từ chối:_ Không có transaction guarantee với Read Model. Phải dùng 2PC hoặc Saga (quá phức tạp).

- **No checkpoint, rely on message broker acknowledgment:**
  - _Lý do từ chối:_ Không support RYOW. Không biết projector progress. Khó rebuild/replay.

- **Event sourcing projector checkpoint trong Event Store DB:**
  - _Lý do từ chối:_ Có thể dùng nhưng không transactional với PostgreSQL Read Model. Prefer co-location với Read Model.
