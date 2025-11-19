# ADR-RM-3 — Atomic Quota Management via Redis Lua Script

## 1. Bối cảnh

Resource Management cần enforce storage quota cho mỗi tenant để prevent abuse và ensure fair resource allocation. Quota operations phải atomic trong high-concurrency environment:

**Scenario mô tả vấn đề:**

```
Time    Thread A (upload 100MB)         Thread B (upload 150MB)
-------------------------------------------------------------------
T1      READ quota_used = 800MB
T2                                       READ quota_used = 800MB
T3      CHECK: 800 + 100 < 1000 ✓
T4                                       CHECK: 800 + 150 < 1000 ✓
T5      WRITE quota_used = 900MB
T6                                       WRITE quota_used = 950MB (WRONG!)
T7      Result: Both uploads allowed, actual usage = 1050MB > limit 1000MB
```

Đây là classic **race condition** trong distributed systems. Cần atomic "check-and-set" operation.

**Yêu cầu:**

- Atomic check quota availability
- Atomic reserve (deduct) quota trước khi upload
- Atomic refund quota khi upload fails hoặc file deleted
- High performance (low latency) vì mỗi upload cần quota check
- Support concurrent operations từ multiple API instances

**Constraints:**

- PostgreSQL transactions quá chậm cho hotspot này (hundreds of concurrent quota checks/second)
- Application-level locking không work trong multi-instance environment
- Cần eventual consistency với database (periodic sync acceptable)

## 2. Quyết định

Sử dụng **Redis với Lua Scripting** để implement atomic quota operations:

### 2.1. Quota Reserve (Check và Deduct nguyên tử)

```lua
-- reserve_quota.lua
local tenant_key = KEYS[1]         -- "quota:tenant:{tenantId}:used"
local limit_key = KEYS[2]          -- "quota:tenant:{tenantId}:limit"
local reserve_amount = tonumber(ARGV[1])

-- Get current usage and limit
local current = tonumber(redis.call('GET', tenant_key) or 0)
local limit = tonumber(redis.call('GET', limit_key) or 0)

-- Check if enough quota available
if current + reserve_amount > limit then
  return {-1, current, limit}  -- Error: quota exceeded
end

-- Reserve quota (deduct)
local new_usage = redis.call('INCRBY', tenant_key, reserve_amount)
return {1, new_usage, limit}  -- Success
```

Sử dụng:

```typescript
interface QuotaReserveResult {
  success: boolean;
  currentUsage: number;
  limit: number;
}

async function reserveQuota(tenantId: string, size: number): Promise<QuotaReserveResult> {
  const usedKey = `quota:tenant:${tenantId}:used`;
  const limitKey = `quota:tenant:${tenantId}:limit`;

  const result = await redis.eval(
    RESERVE_QUOTA_SCRIPT,
    2, // number of keys
    usedKey,
    limitKey,
    size.toString()
  );

  const [status, currentUsage, limit] = result as [number, number, number];
  return {
    success: status === 1,
    currentUsage,
    limit,
  };
}
```

### 2.2. Quota Refund (Hoàn lại quota)

```lua
-- refund_quota.lua
local tenant_key = KEYS[1]
local refund_amount = tonumber(ARGV[1])

-- Decrease usage (but not below 0)
local current = tonumber(redis.call('GET', tenant_key) or 0)
local new_usage = math.max(0, current - refund_amount)
redis.call('SET', tenant_key, new_usage)

return new_usage
```

### 2.3. Quota Sync Worker (Self-healing)

Để đảm bảo eventual consistency giữa Redis và PostgreSQL:

```typescript
// Chạy cronjob hàng đêm
async function syncQuotaFromDatabase() {
  const tenants = await db.tenants.findAll();

  for (const tenant of tenants) {
    // Calculate actual usage từ database
    const actualUsage = await db.files.where({ tenantId: tenant.id, status: 'AVAILABLE' }).sum('size');

    // Overwrite Redis với actual value
    await redis.set(`quota:tenant:${tenant.id}:used`, actualUsage.toString());
  }
}
```

### 2.4. Error Handling và Retry

```typescript
async function uploadFileWithQuota(tenantId: string, size: number): Promise<Result> {
  // 1. Reserve quota atomically
  const reservation = await reserveQuota(tenantId, size);
  if (!reservation.success) {
    throw new QuotaExceededError(reservation);
  }

  try {
    // 2. Generate pre-signed URL
    const uploadUrl = await generateUploadUrl(/* ... */);

    // 3. Return to client
    return { uploadUrl, fileId };
  } catch (error) {
    // IMPORTANT: Refund quota on any error
    await refundQuota(tenantId, size);
    throw error;
  }
}
```

## 3. Hệ quả

### Tích cực

- **Atomic operations**: Lua scripts execute atomically trong Redis, preventing race conditions
- **High performance**: Redis in-memory operations với sub-millisecond latency
- **Scalability**: Redis handles thousands of operations/second easily
- **Simple implementation**: Lua scripts straightforward, no complex distributed locking
- **Eventual consistency acceptable**: Short-term drift từ actual DB state okay, self-healing nightly

### Tiêu cực

- **Redis as critical dependency**: Quota system down nếu Redis down (mitigated: Redis Sentinel/Cluster cho HA)
- **Drift from source of truth**: Redis có thể out-of-sync với DB. Mitigated:
  - Periodic sync job
  - Manual sync on-demand khi phát hiện discrepancy
  - Quota refund luôn được enforce
- **Lua script maintenance**: Cần test và version Lua scripts carefully
- **Memory usage**: Mỗi tenant consume Redis memory cho quota counters (minimal, acceptable)

### Trade-offs

- **Redis vs Database transactions**: Trade strong consistency (DB transactions) cho performance (Redis atomic ops)
  - Acceptable vì: quota checks cần fast, eventual consistency đủ (sync hàng đêm)
  - Safety net: Quota reserve luôn conservative (reserve trước, refund khi fail)

## 4. Các lựa chọn đã xem xét

- **PostgreSQL với row-level locking:**
  - _Lý do từ chối:_ Quá chậm cho hotspot này (hundreds of concurrent checks). Lock contention cao.

- **Optimistic locking (version field) trong PostgreSQL:**
  - _Lý do từ chối:_ Dẫn đến retry storms với high concurrency. Poor UX khi upload fails due to version conflict.

- **Distributed lock (như Redlock):**
  - _Lý do từ chối:_ Thêm complexity, có thể slower than Lua script. Lua script trong Redis đã atomic by design.

- **Message queue cho quota operations:**
  - _Lý do từ chối:_ Asynchronous nature không phù hợp. Client cần biết ngay liệu có đủ quota hay không.

- **No quota reservation, check sau upload:**
  - _Lý do từ chối:_ Waste bandwidth và storage nếu quota exceeded. Bad UX (upload xong mới biết rejected).
