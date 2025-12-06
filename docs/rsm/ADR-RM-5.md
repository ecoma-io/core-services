# ADR-RM-5 — Stateless Authorization với JWT Claims và Redis Cache

## 1. Bối cảnh

File delivery (đặc biệt cho private files) là **latency-critical path** với requirements:

- **High throughput**: Millions of requests/day
- **Low latency**: Sub-100ms P99 response time target
- **Security**: Must enforce access control - user chỉ access được files họ có quyền
- **Scalability**: API servers cần stateless để scale horizontally

**Problem với traditional authorization approaches:**

### Option 1: Call IAM service cho mỗi request

```
Client → Resource API → IAM Service (check permission)
                     ← permission result
        → Storage
```

**Issues:**

- Extra network hop (+50-100ms latency)
- IAM becomes bottleneck và single point of failure
- Increased infrastructure cost (IAM phải scale cao)

### Option 2: Check database cho mỗi request

```
Client → Resource API → PostgreSQL (query ACL table)
                     ← ACL result
        → Storage
```

**Issues:**

- Database queries add latency (+10-50ms)
- High load trên database
- Không scale tốt với read-heavy workload

**Requirements:**

- Không gọi IAM service trong hot path
- Minimal database queries
- Có thể verify authorization trong <5ms
- Support tenant isolation
- Support service-to-service (S2S) calls

## 2. Quyết định

Implement **Stateless Authorization** pattern:

### 2.1. JWT Claims-Based Auth

Extract identity từ JWT token không cần call IAM:

```typescript
interface JWTPayload {
  sub: string; // User ID hoặc Service ID
  tid: string; // Tenant ID
  azp: string; // Authorized party (client_id for S2S)
  type: 'user' | 's2s'; // Token type
  exp: number; // Expiration
  iat: number; // Issued at
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    try {
      // Verify JWT signature (using IAM public key)
      const payload = jwt.verify(token, IAM_PUBLIC_KEY);

      // Attach to request context
      request.user = {
        id: payload.sub,
        tenantId: payload.tid,
        clientId: payload.azp,
        type: payload.type,
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
```

### 2.2. Redis ACL Cache

Cache file ACL rules để avoid database queries:

```typescript
interface FileACL {
  fileId: string;
  isPublic: boolean;
  ownerId: string; // User or Service that owns file
  tenantId: string; // Tenant isolation
  sharedWith: string[]; // User/Service IDs with access
  ttl: number; // Cache TTL
}

@Injectable()
export class AuthorizationService {
  async checkFileAccess(callerId: string, tenantId: string, fileId: string): Promise<boolean> {
    // 1. Try cache first
    const cachedACL = await this.redis.get(`acl:file:${fileId}`);

    let acl: FileACL;
    if (cachedACL) {
      acl = JSON.parse(cachedACL);
    } else {
      // 2. Cache miss → query database
      acl = await this.db.files.findOne({
        where: { id: fileId },
        select: ['isPublic', 'ownerId', 'tenantId'],
        include: [{ model: 'file_shares', attributes: ['userId', 'serviceId'] }],
      });

      // 3. Cache for 5 minutes
      await this.redis.setex(`acl:file:${fileId}`, 300, JSON.stringify(acl));
    }

    // 4. Check access rules
    return this.evaluateAccess(callerId, tenantId, acl);
  }

  private evaluateAccess(callerId: string, tenantId: string, acl: FileACL): boolean {
    // Rule 1: Public files accessible by anyone in same tenant
    if (acl.isPublic && acl.tenantId === tenantId) {
      return true;
    }

    // Rule 2: Owner always has access
    if (acl.ownerId === callerId) {
      return true;
    }

    // Rule 3: Explicitly shared with caller
    if (acl.sharedWith.includes(callerId)) {
      return true;
    }

    // Rule 4: Deny by default
    return false;
  }
}
```

### 2.3. Cache Invalidation Strategy

```typescript
@Injectable()
export class FileService {
  async updateFileACL(fileId: string, updates: Partial<FileACL>) {
    // 1. Update database
    await this.db.files.update(fileId, updates);

    // 2. Invalidate cache immediately
    await this.redis.del(`acl:file:${fileId}`);

    // 3. Optional: Proactively refresh cache
    const freshACL = await this.fetchFileACL(fileId);
    await this.redis.setex(`acl:file:${fileId}`, 300, JSON.stringify(freshACL));
  }

  async deleteFile(fileId: string) {
    // Always delete cache khi delete file
    await this.redis.del(`acl:file:${fileId}`);
    await this.db.files.delete(fileId);
  }
}
```

### 2.4. Service-to-Service (S2S) Auth

```typescript
async serveFileForService(
  @Param('fileId') fileId: string,
  @CurrentUser() caller: JWTPayload
) {
  // S2S tokens có type='s2s' và azp=service_client_id
  if (caller.type === 's2s') {
    // Services có thể access files trong tenant của họ
    // với additional permission checks nếu cần
    const file = await this.fileRepository.findById(fileId);

    if (file.tenantId !== caller.tid) {
      throw new ForbiddenException('Cross-tenant access denied');
    }

    // Services trusted, skip detailed ACL check
    return this.serveFile(file);
  }

  // Regular user flow
  const hasAccess = await this.authzService.checkFileAccess(
    caller.id,
    caller.tid,
    fileId
  );

  if (!hasAccess) {
    throw new ForbiddenException('Access denied');
  }

  return this.serveFile(file);
}
```

## 3. Hệ quả

### Tích cực

- **Low latency**: JWT verification + Redis lookup <5ms (vs 50-100ms cho IAM call)
- **High throughput**: Redis handles 100K+ requests/second easily
- **Stateless API**: Không cần session storage, scale horizontally dễ dàng
- **Reduced IAM load**: IAM chỉ issue tokens, không handle authorization queries
- **Simple implementation**: Standard JWT libraries, minimal custom code
- **Tenant isolation**: Built-in qua `tid` claim trong JWT

### Tiêu cực

- **Cache staleness**: ACL changes có delay lên tới 5 phút (cache TTL)
  - Mitigated: Invalidate cache explicitly khi update ACL
  - Acceptable: 5 phút delay cho ACL propagation reasonable cho most use cases
- **Redis dependency**: Authorization fails nếu Redis down
  - Mitigated: Redis Cluster cho HA, fallback to database nếu Redis unavailable
- **Token revocation complexity**: JWT tokens không thể revoke trước expiration
  - Mitigated: Short token lifetime (15 mins), refresh token flow
  - Advanced: Token blacklist trong Redis nếu cần immediate revocation
- **Memory usage**: Cache mọi file ACLs consume Redis memory
  - Mitigated: TTL (auto expiry), LRU eviction policy

### Trade-offs

- **Eventual consistency**: Trade immediate consistency (always query DB) cho performance (cached ACLs)
  - Acceptable vì: File ACLs thay đổi không thường xuyên, 5 phút lag acceptable
  - Safety: Revoke access luôn invalidate cache explicitly

## 4. Các lựa chọn đã xem xét

- **Always call IAM for authorization:**
  - _Lý do từ chối:_ Thêm latency, IAM bottleneck, không scale.

- **Embed full permissions trong JWT:**
  - _Lý do từ chối:_ JWT token quá lớn (thousands of files → thousands of permissions), không practical.

- **Session-based auth với server-side session store:**
  - _Lý do từ chối:_ Không stateless, phức tạp scale, session management overhead.

- **Database query mỗi request:**
  - _Lý do từ chối:_ Database bottleneck, high latency, không scale cho read-heavy workload.

- **No caching, always verify:**
  - _Lý do từ chối:_ Latency không acceptable cho millions of requests. Caching critical cho performance.
