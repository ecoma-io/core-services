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

## 3. Lý do:

- **Per-Projector, Per-Stream Checkpoint:** Mỗi projector có bảng checkpoint riêng, tracking vị trí đã xử lý cho từng event stream. Hỗ trợ parallel processing và granular RYOW.
- **Transactional Updates:** Sử dụng database transaction để đảm bảo atomicity giữa Read Model updates và checkpoint updates.
- **Idempotent Processing:** Mỗi event có unique ID, projector kiểm tra nếu event đã được xử lý (dựa trên checkpoint) để tránh duplicate processing.
- **Admin Operations:** Cung cấp API để pause/resume projector, reset checkpoint (cho rebuild), và inspect checkpoint status.
- **Error Tracking:** Mỗi lần event processing fail, increment error count trong checkpoint record. Nếu vượt threshold, trigger alert.
- **Storage of Checkpoints:** Checkpoint được lưu trong cùng database với Read Model để đảm bảo transactionality và co-location.
- **Replay Support:** Khi rebuild, reset checkpoint về 0 và pause live consumption. Sau khi replay xong, resume live processing từ checkpoint mới.

## 4. Hệ quả

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

## 5. Các lựa chọn đã xem xét

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
