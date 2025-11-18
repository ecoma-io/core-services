# IAM Query Service

REST API service for querying IAM read models in a CQRS architecture.

## Overview

The IAM Query Service is the **read side** of the IAM CQRS system, providing REST endpoints to query denormalized read models that are populated by the projector worker. It handles:

- Tenant queries
- User queries (planned)
- Role queries (planned)
- Membership queries (planned)
- Permission lookup (planned)

## Architecture

```
┌─────────────────┐
│  Client/App     │
└────────┬────────┘
         │ HTTP GET
         ▼
┌─────────────────────┐
│ iam-query-service   │
│ (NestJS REST API)   │
└────────┬────────────┘
         │ TypeORM
         ▼
┌─────────────────────┐
│  PostgreSQL         │
│  (Read Models)      │
└─────────────────────┘
         ▲
         │ Updates
┌────────┴────────────┐
│ iam-projector-worker│
│ (Event Consumer)    │
└─────────────────────┘
```

**Key principles:**

- **Read-only**: Never writes to event store or command side
- **Eventually consistent**: Data updated asynchronously by projector worker
- **Denormalized**: Optimized for query performance (no joins needed)
- **TypeORM sync in test mode**: `synchronize: true` when `NODE_ENV=test` for auto table creation

## API Endpoints

### Tenants

#### `GET /tenants/:id`

Get tenant by ID.

**Parameters:**

- `id` (path, UUID): Tenant ID

**Response (200 OK):**

```json
{
  "id": "b17a5f2a-5812-4f98-8142-446cb07bf568",
  "namespace": "acme-corp",
  "metadata": {
    "displayName": "Acme Corporation",
    "region": "us-west-2"
  },
  "createdAt": "2025-11-18T06:34:07.123Z",
  "updatedAt": "2025-11-18T06:34:07.123Z"
}
```

**Error Responses:**

- `404 Not Found`: Tenant does not exist
  ```json
  {
    "message": "Tenant {id} not found",
    "details": null,
    "metadata": null
  }
  ```

**Example:**

**Example:**

```bash
curl http://localhost:3001/tenants/b17a5f2a-5812-4f98-8142-446cb07bf568
```

### Users

#### `GET /users/:id`

Get user by ID.

**Parameters:**

- `id` (path, UUID): User ID

**Response (200 OK):**

```json
{
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "createdAt": "2025-11-18T07:08:30.123Z",
  "updatedAt": "2025-11-18T07:08:30.123Z"
}
```

**Note:** Password fields are never exposed in query responses for security.

**Error Responses:**

- `404 Not Found`: User does not exist
  ```json
  {
    "message": "User {id} not found",
    "details": null,
    "metadata": null
  }
  ```

**Example:**

```bash
curl http://localhost:3001/users/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Health

### Health

#### `GET /health/liveness`

Liveness probe - indicates service is running.

**Response (200 OK):**

```json
{
  "message": "Service still alive"
}
```

#### `GET /health/readiness`

Readiness probe - checks database connectivity.

**Response (200 OK):**

```json
{
  "message": "Service is ready",
  "data": {
    "status": "ok",
    "details": {
      "database": { "status": "up" }
    }
  }
}
```

## Configuration

### Environment Variables

```bash
# Application
NODE_ENV=development|test|production
PORT=3001

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=iam_db

# Logging
LOG_LEVEL=debug|info|warn|error
```

### TypeORM Synchronize Mode

**Development:** `synchronize: false` (use migrations)  
**Test:** `synchronize: true` (auto table creation for Testcontainers)  
**Production:** `synchronize: false` (NEVER use auto-sync in production)

The service automatically detects `NODE_ENV=test` and enables synchronize for integration tests.

## Development

### Local Development

```bash
# Start query service with watch mode
npx nx serve iam-query-service

# Build for production
npx nx build iam-query-service

# Run unit tests
npx nx test iam-query-service

# Run E2E tests (requires command + projector + query services)
npx nx e2e iam-command-e2e --testFile=tenant-complete-flow.spec.ts
```

### Docker

```bash
# Build Docker image
npx nx docker:build iam-query-service

# Run container (requires PostgreSQL)
docker run -p 3001:3001 \
  -e DB_HOST=host.docker.internal \
  -e DB_PORT=5432 \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  -e DB_NAME=iam_db \
  -e NODE_ENV=production \
  -e PORT=3001 \
  iam-query-service
```

## Testing

### Unit Tests

Query handler and controller unit tests use mocked repositories.

**Example (GetTenantHandler):**

```typescript
describe('GetTenantHandler', () => {
  it('should return tenant when found', async () => {
    const mockRepo = { findById: jest.fn().mockResolvedValue(mockTenant) };
    const handler = new GetTenantHandler(mockRepo);
    const result = await handler.execute({ tenantId: 'uuid' });
    expect(result).toEqual(mockTenant);
  });
});
```

**Run:**

```bash
npx nx test iam-query-service
```

### E2E Tests

Vertical slice E2E tests orchestrate 3 services using Testcontainers:

1. **iam-command-service** (port 3000) - writes commands/events
2. **iam-projector-worker** (background) - projects events to read models
3. **iam-query-service** (port 3001) - serves read models

**RYOW Pattern:**  
E2E tests implement Read-Your-Own-Writes using polling:

- After creating an entity via command, poll GET endpoint with timeout (5s)
- Interval: 250ms
- Validates eventual consistency

**Example (tenant-complete-flow.spec.ts):**

```typescript
// 1. Create tenant via command
const createRes = await axios.post(`${commandUrl}/commands/create-tenant`, dto);
const { tenantId } = createRes.data.data;

// 2. Poll for projection (RYOW)
let tenantFound = false;
const timeout = Date.now() + 5000;
while (Date.now() < timeout && !tenantFound) {
  try {
    const getRes = await axios.get(`${queryUrl}/tenants/${tenantId}`);
    tenantFound = !!getRes.data;
    break;
  } catch (err) {
    await sleep(250);
  }
}

// 3. Assert
expect(tenantFound).toBe(true);
```

**Run:**

```bash
npx nx e2e iam-command-e2e --testFile=tenant-complete-flow.spec.ts
```

## Architecture Decisions

### Why Separate Query Service?

**CQRS separation benefits:**

1. **Scalability**: Scale read/write independently (query-heavy workloads common)
2. **Optimization**: Denormalized read models = no joins, faster queries
3. **Resilience**: Query service downtime doesn't block writes
4. **Security**: Isolate read-only access (different auth rules possible)
5. **Evolution**: Change read models without affecting command side

### Read Model Design

**Denormalized for performance:**

- No foreign key joins at query time
- JSONB for flexible metadata storage
- Indexes on common query patterns (id, namespace, email, etc.)

**Updated asynchronously:**

- Projector worker consumes events
- Atomic updates with checkpoint tracking
- Idempotent event handlers (replay-safe)

## Dependencies

**Internal packages:**

- `@ecoma-io/iam-query-interactor` - Query handlers and interfaces
- `@ecoma-io/iam-infrastructure` - Read model entities and repositories
- `@ecoma-io/nestjs-exceptions` - Custom exception classes
- `@ecoma-io/nestjs-health` - Health check module
- `@ecoma-io/common` - Shared types and response wrappers

**External:**

- `@nestjs/core` ^11.1.9
- `@nestjs/typeorm` ^11.0.5
- `typeorm` ^0.3.27
- `pg` ^8.14.0

## Related Documentation

- [IAM Architecture](../../docs/iam/architecture.md) - Overall CQRS design
- [IAM Implementation Status](../../docs/iam/implementation-status.md) - Progress tracking
- [Command Service](../iam-command-service/README.md) - Write side
- [Projector Worker](../iam-projector-worker/README.md) - Event projection

## Future Enhancements

**Implemented endpoints:**

- ✅ `GET /tenants/:id` - Tenant queries (Phase 1)
- ✅ `GET /users/:id` - User queries (Phase 2.1)

**Planned endpoints:**

- `GET /roles/:id` - Role queries (Phase 2.2)
- `GET /tenants/:tenantId/users` - List tenant members
- `GET /users/:userId/permissions?tenantId=...` - Permission lookup
- `GET /search/users?q=...` - Full-text search (Phase 2+)

**Performance optimizations:**

- Redis caching layer for hot queries
- GraphQL endpoint for flexible querying
- Read replicas for high query volume

## Support

For issues or questions:

- Check E2E tests for usage examples
- Review [architecture.md](../../docs/iam/architecture.md) for design rationale
- Consult [implementation-status.md](../../docs/iam/implementation-status.md) for feature status
