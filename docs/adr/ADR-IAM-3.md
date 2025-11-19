# ADR-IAM-3 — Xử lý Lỗi Sự kiện và Tái Phát (Event Handling & Replay)

## 1. Bối cảnh

Trong hệ thống Event Sourcing, việc xử lý lỗi và khả năng replay events là quan trọng để đảm bảo:

- **Reliability:** Hệ thống có khả năng phục hồi từ lỗi tạm thời (transient errors)
- **Maintainability:** Có thể sửa lỗi logic trong Projector và rebuild Read Models
- **Evolvability:** Hỗ trợ thay đổi schema của events khi hệ thống phát triển
- **Auditability:** Đảm bảo không mất events và có thể trace được lỗi

Các loại lỗi cần xử lý:

1. **Transient errors:** Network timeout, temporary DB unavailability
2. **Logic errors:** Bug trong Projector code
3. **Schema evolution:** Event structure thay đổi qua các versions
4. **Poison messages:** Events không thể xử lý được (malformed, corrupt)

## 2. Quyết định

Implement chiến lược xử lý lỗi 3 tầng: Retry, Dead Letter Queue và Replay Mechanism.

### 2.1. Tầng 1: Retry với Exponential Backoff

Cấu hình RabbitMQ với retry queue pattern:

```yaml
# Main Queue
queue: iam.events.main
  x-message-ttl: 300000  # 5 minutes
  x-dead-letter-exchange: iam.events.retry

# Retry Queue (delayed)
queue: iam.events.retry
  x-message-ttl: 5000  # 5 seconds delay
  x-dead-letter-exchange: iam.events.main
  x-max-retries: 5  # Custom header
```

Projector tracking retry count:

```typescript
async function handleEvent(event: DomainEvent, retryCount: number = 0) {
  try {
    await processEvent(event);
    await updateCheckpoint(event);
  } catch (error) {
    if (isTransientError(error) && retryCount < MAX_RETRIES) {
      await sendToRetryQueue(event, retryCount + 1);
    } else {
      await sendToDLQ(event, error);
    }
  }
}
```

### 2.2. Tầng 2: Dead Letter Queue (DLQ)

Sau khi vượt quá số lần retry, event được chuyển đến DLQ:

```yaml
queue:
  iam.events.dlq
  # No TTL, messages stay until manual intervention
  # Alerting trigger when messages arrive
```

DLQ được monitor và có dashboard để:

- Xem danh sách events failed
- Xem error details và stack trace
- Retry individual messages sau khi fix
- Archive hoặc discard messages

### 2.3. Tầng 3: Event Upcasting

Đặt trong `adapters/iam-infrastructure/event-upcasting`:

```typescript
interface EventUpcaster {
  canUpcast(event: RawEvent): boolean;
  upcast(event: RawEvent): DomainEvent;
}

class UserRegisteredV1toV2Upcaster implements EventUpcaster {
  canUpcast(event: RawEvent): boolean {
    return event.type === 'UserRegistered' && event.version === 1;
  }

  upcast(event: RawEvent): DomainEvent {
    return {
      ...event,
      version: 2,
      data: {
        ...event.data,
        // Add new required field with default
        emailVerified: false,
      },
    };
  }
}
```

Upcaster Registry xử lý chain of upcasters:

```typescript
class UpcasterRegistry {
  private upcasters: EventUpcaster[] = [];

  upcastToLatest(rawEvent: RawEvent): DomainEvent {
    let event = rawEvent;
    for (const upcaster of this.upcasters) {
      if (upcaster.canUpcast(event)) {
        event = upcaster.upcast(event);
      }
    }
    return event;
  }
}
```

### 2.4. Full Replay Mechanism

Công cụ ops cho rebuild hoàn toàn Read Model:

```typescript
async function rebuildReadModel(projectorName: string) {
  // 1. Pause live consumption
  await pauseRabbitMQConsumer(projectorName);

  // 2. Clear checkpoint
  await clearCheckpoint(projectorName);

  // 3. Truncate read model tables
  await truncateReadModelTables(projectorName);

  // 4. Read all events from Event Store DB
  const eventStream = eventStore.readStreamForward('$all', 0);

  // 5. Process through upcaster and projector
  for await (const rawEvent of eventStream) {
    const event = upcasterRegistry.upcastToLatest(rawEvent);
    await projector.handle(event);
    await updateCheckpoint(projectorName, event.position);
  }

  // 6. Resume live consumption
  await resumeRabbitMQConsumer(projectorName);
}
```

## 3. Hệ quả

### Tích cực

- **Resilience:** Tự động phục hồi từ transient errors
- **Visibility:** DLQ cung cấp visibility vào events failed
- **Evolvability:** Upcasting cho phép thay đổi event schema an toàn
- **Recoverability:** Full replay cho phép sửa logic errors và rebuild
- **Audit trail:** Không mất events, tất cả được preserve

### Tiêu cực

- **Complexity:** Cần implement và maintain upcaster registry
- **Ops overhead:** Cần monitoring và alerting cho DLQ
- **Downtime cho replay:** Read Model unavailable trong quá trình rebuild
- **Storage:** Cần lưu trữ events failed trong DLQ
- **Testing:** Cần test scenarios cho retry, DLQ và upcasting

## 4. Các lựa chọn đã xem xét

- **Chỉ dùng retry không có DLQ:**
  - _Lý do từ chối:_ Events failed vĩnh viễn sẽ block queue. Không có visibility vào failures.

- **Synchronous error handling:**
  - _Lý do từ chối:_ Command handler phải đợi projection success, mất lợi ích của async processing.

- **Không có upcasting, breaking changes require full migration:**
  - _Lý do từ chối:_ Không linh hoạt, mỗi breaking change cần downtime để migrate toàn bộ event store.

- **Schema registry (như Confluent Schema Registry):**
  - _Lý do từ chối:_ Overkill cho quy mô hiện tại. Upcaster pattern đơn giản và đủ dùng. Có thể consider sau nếu số lượng event types và versions tăng đáng kể.
