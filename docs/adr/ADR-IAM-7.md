# ADR-IAM-7 — Chiến lược Đảm bảo Tính duy nhất của email (Email Uniqueness Constraints)

## 1. Bối cảnh

Trong hệ thống CQRS + Event Sourcing (EventStoreDB là source-of-truth append-only), cần đảm bảo rằng các giá trị cần duy nhất (như email, username) không bị trùng khi nhiều command concurrent thực hiện ghi. EventStoreDB không cung cấp ràng buộc uniqueness global tại thời điểm ghi, do đó cần một cơ chế để thực thi invariant "email là duy nhất" tại write-time.

Yêu cầu chính:

- Ngăn chặn tạo nhiều user với cùng email tại thời điểm tạo (write-time enforcement).
- Hỗ trợ idempotent retries cho các command (Idempotency-Key).
- Hỗ trợ UX tốt cho flows có bước xác thực email (PendingVerification).
- Giảm rủi ro partial-failure giữa hệ thống khóa (reservation) và EventStore (append).
- Vận hành dễ dàng (sweeper, monitoring, reconciliation).

## 2. Quyết định

Chấp nhận mô hình **Reservation Pattern** sử dụng một bảng `email_reservations` trong PostgreSQL (UNIQUE(email)) làm canonical mechanism để enforce uniqueness tại write-time. Redis chỉ được dùng như **fast-path lock / accelerator** nếu cần — không bao giờ làm nguồn chân lý duy nhất.

Chi tiết kỹ thuật và luồng vận hành tham khảo `docs/iam/iam-architecture.md` (mục 4.4: "Luồng User Registration — Reservation & Verification").

## 3. Lý do

- PostgreSQL cung cấp ACID + UNIQUE constraint, phù hợp làm nguồn chân lý để enforce uniqueness.
- Giữ logic đơn giản, dễ audit và debug (xa lạ so với giải pháp hoàn toàn dựa trên EventStore).
- Hỗ trợ idempotency bằng cách lưu `idempotency_key` trong reservation record.
- Cho phép async email sending (queue) mà không mở cửa cho duplicate creations trong window verification.

## 4. Hậu quả (Consequences)

### Tích cực

- Guarantee uniqueness at write-time: tránh race conditions trên write path.
- Durable: reservation persisted survives process/Redis failures.
- Traceable: reservation record lưu thông tin audit (reserved_by, reserved_at, idempotency_key).

### Tiêu cực / chi phí

- Thêm dependency vận hành (bảng reservation phải backup, migrate, monitor).
- Latency: thêm một bước INSERT trước khi append event → tăng p50/p95 latency cho CreateUser.
- Single contention point: bảng reservation có thể trở thành bottleneck ở QPS rất cao; cần scale/partitioning.
- Partial failures: cần reconciliation between reservation state and EventStore (sweeper job).

## 5. Các lựa chọn đã xem xét

1. Postgres Reservation Table (được chọn)
   - Ưu: ACID, UNIQUE constraint, durable, audit
   - Nhược: latency, contention

2. Redis-only distributed lock
   - Ưu: low-latency
   - Nhược: non-durable, TTL/stale-lock risk, không phải nguồn chân lý

3. Per-email stream in EventStore (append with ExpectedVersion.NoStream)
   - Ưu: single-source-of-truth (ES-only), atomic append semantics
   - Nhược: stream explosion (operational cost), complex GC/retention, need projectors for lookup

4. UniqueIndex aggregate (sharded) inside EventStore
   - Ưu: leverages ES optimistic concurrency, can shard to reduce stream count
   - Nhược: complexity, need sharding strategy and reconciliation

5. Allow duplicates + compensating flows (projector enforces unique index)
   - Ưu: simpler write path
   - Nhược: bad UX, complex compensation and admin workflows

## 6. Operational Guidance (Tóm tắt)

- Schema: `email_reservations` với fields: `email` (PK), `user_id`, `reserved_by`, `idempotency_key`, `status` (reserved|pending_verification|committed|released), `reserved_at`, `expires_at`, `verification_sent_at`, `verification_token_hash`, `verification_attempts`.
- Idempotency: bắt buộc `Idempotency-Key` cho `POST /users`; store key in reservation to enable idempotent retries.
- TTL & Sweeper: `pending_verification` TTL (48–72h configurable); sweeper releases expired reservations and emits `EmailReservationExpired` events.
- Email sending: non-blocking enqueue → retry/backoff → DLQ. Provide `resend-verification` endpoint (rate-limited).
- Reconciliation: background job to detect and resolve partial failures (reserve without event, event without reservation).
- Monitoring: metrics for reservation_conflict_total, reservation_expired_total, email_send_dlq_total, pending_verification_gauge; alerts on spikes.
- Multi-region: if multi-region write is required, route registrations to a single writer region or implement global consensus; avoid async-replicated UNIQUE constraints across regions.

## 7. Implementation Notes

- Keep reservation insert as small/atomic as possible: `INSERT ... ON CONFLICT DO NOTHING` pattern and immediate read to decide next steps.
- After successful reservation, append domain event to EventStore; on success update reservation to `pending_verification` with `user_id`.
- Use `idempotency_key` to identify retries and to allow idempotent success responses.

## 8. Related ADRs

- ADR-IAM-6 (Projection Checkpoint Semantics) — for RYOW & projector behavior
- ADR-IAM-2 (RYOW) — client polling semantics after write

## 9. Decision

Chọn Postgres Reservation Pattern (as canonical) with Redis optional accelerator. Document operational procedures (TTL, sweeper, idempotency, reconciliation) and reference `docs/iam/iam-architecture.md` for flow details.
