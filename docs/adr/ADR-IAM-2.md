# ADR-IAM-2 — Cơ chế Đọc Lại Bản Ghi Của Chính Mình (Read Your Own Writes - RYOW)

## 1. Bối cảnh

Trong kiến trúc CQRS với eventual consistency, có độ trễ tự nhiên giữa khi Command được xử lý (Write Side) và khi Read Model được cập nhật (Read Side thông qua Projectors). Điều này dẫn đến tình huống user thực hiện một hành động (ví dụ: tạo Role) nhưng ngay lập tức query lại không thấy kết quả.

Vấn đề này đặc biệt nghiêm trọng với IAM vì:

- User expect thấy thay đổi ngay lập tức sau khi thực hiện action (UX requirement)
- Các service khác có thể query quyền ngay sau khi assign role (functional requirement)
- Testing và debugging khó khăn khi không có consistency guarantee

## 2. Quyết định

Implement cơ chế **Read Your Own Writes (RYOW)** thông qua checkpoint tracking và polling mechanism:

### 2.1. Checkpoint Store

Tạo bảng `projection_checkpoints` trong PostgreSQL (cùng database với Read Models) để tracking vị trí xử lý của mỗi Projector:

```sql
CREATE TABLE projection_checkpoints (
  projector_name VARCHAR(255) PRIMARY KEY,
  stream_name VARCHAR(255),
  last_position BIGINT NOT NULL,
  last_event_id UUID,
  updated_at TIMESTAMP DEFAULT NOW(),
  error_count INT DEFAULT 0
);
```

### 2.2. Write API Response

Sau khi lưu events thành công vào Event Store DB, `iam-command-service` trả về stream version trong response:

```json
{
  "data": { "roleId": "uuid-here" },
  "meta": {
    "streamVersion": 5,
    "eventId": "event-uuid"
  }
}
```

### 2.3. Read API với Version Check

Client gửi query kèm theo `stream_version`:

```
GET /roles/uuid-here?min_stream_version=5
```

`iam-query-service` thực hiện polling logic:

```typescript
async function waitForProjection(aggregateId: string, minVersion: number, maxWaitMs: number = 500): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 50; // ms

  while (Date.now() - startTime < maxWaitMs) {
    const checkpoint = await getCheckpoint('role-projector');
    if (checkpoint.last_position >= minVersion) {
      return true;
    }
    await sleep(pollInterval);
  }

  return false;
}
```

### 2.4. Response Strategy

- Nếu đạt được `min_stream_version` trong timeout: trả về data bình thường
- Nếu timeout: trả về data hiện tại + warning header `X-Projection-Lag: true`

## 3. Hệ quả

### Tích cực

- Giải quyết được vấn đề UX khi user expect thấy thay đổi ngay lập tức
- Cho phép các service consumer có guarantee về consistency khi cần
- Đơn giản hơn các giải pháp phức tạp như synchronous projections
- Polling timeout ngắn (500ms) chấp nhận được cho hầu hết use cases

### Tiêu cực

- Tăng latency cho Read API khi có lag (tối đa 500ms)
- Cần maintain checkpoint table đồng bộ với projector progress
- Database load tăng do polling queries (mitigated bởi interval 50ms và timeout ngắn)
- Edge case: nếu projector bị stuck, query sẽ luôn timeout

## 4. Các lựa chọn đã xem xét

- **Synchronous Projections:**
  - _Lý do từ chối:_ Mất đi lợi ích của CQRS về tách biệt và scalability. Command handler phải đợi projection hoàn thành.

- **WebSocket/SSE để notify client:**
  - _Lý do từ chối:_ Phức tạp hơn nhiều cho cả server và client. Không phù hợp với RESTful API pattern.

- **Client-side retry logic:**
  - _Lý do từ chối:_ Đẩy complexity sang client, khó maintain và inconsistent behavior giữa các clients.

- **Không giải quyết, chấp nhận eventual consistency:**
  - _Lý do từ chối:_ UX không chấp nhận được cho IAM service. User expect thấy role ngay sau khi assign.
