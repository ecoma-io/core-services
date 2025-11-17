# @ecoma-io/iam-infrastructure

Infrastructure layer implementation for IAM Service following CQRS/Event Sourcing architecture.

## Overview

This library provides the infrastructure implementations for the IAM Service, including:

- **Event Store**: EventStoreDB integration for event sourcing
- **Event Publisher**: RabbitMQ integration using `@golevelup/nestjs-rabbitmq`
- **Snapshot Management**: PostgreSQL-based snapshot repository for aggregate optimization
- **Read Models**: TypeORM entities and repositories for read-side projections (PostgreSQL)
- **Cache Layer**: Redis-based permission caching with RYOW support
- **Search Layer**: Elasticsearch integration for full-text search

## Architecture

This library implements the Infrastructure layer in Clean Architecture / Hexagonal Architecture pattern:

```
iam-domain (ports/interfaces)
      ↑
      |
iam-infrastructure (adapters/implementations)
```

Following **ADR-2** (Technology Stack):

- **EventStoreDB**: Event sourcing write model
- **RabbitMQ**: Message bus with `@golevelup/nestjs-rabbitmq`
- **PostgreSQL**: Read models and snapshot storage
- **TypeORM**: ORM for read model persistence
- **Redis**: Permission caching and RYOW checkpoints
- **Elasticsearch**: Full-text search for Users and Tenants

## Components

### Event Store

#### EventStoreDbRepository

Implementation of `IEventStoreRepository` using EventStoreDB client.

**Features:**

- Optimistic concurrency control
- Stream-based event storage
- Event loading with position support

**Usage:**

```typescript
import { EventStoreDbRepository } from '@ecoma-io/iam-infrastructure';
import { EventStoreDBClient } from '@eventstore/db-client';

const client = EventStoreDBClient.connectionString('esdb://localhost:2113');
const repository = new EventStoreDbRepository(client);

// Save events
await repository.saveEvents('user-123', events, expectedVersion);

// Load events
const events = await repository.loadEvents('user-123');
```

### Event Publisher

#### RabbitMQEventPublisher

Implementation of `IEventPublisher` using `@golevelup/nestjs-rabbitmq`.

**Features:**

- Publish domain events to RabbitMQ exchange
- Automatic routing by event type
- Persistent messages with metadata

**Routing Convention:**

- Event `UserRegistered` → Routing key `iam.events.UserRegistered`
- Event `TenantCreated` → Routing key `iam.events.TenantCreated`

**Usage:**

```typescript
import { RabbitMQEventPublisher } from '@ecoma-io/iam-infrastructure';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

const publisher = new RabbitMQEventPublisher(amqpConnection, {
  exchange: 'iam.events',
  exchangeType: 'topic',
});

await publisher.publish(domainEvents);
```

### RabbitMQ Module

#### RabbitMQInfraModule

NestJS module for easy RabbitMQ integration.

**Usage:**

```typescript
import { RabbitMQInfraModule } from '@ecoma-io/iam-infrastructure';

@Module({
  imports: [
    RabbitMQInfraModule.forRoot({
      uri: 'amqp://localhost:5672',
      exchange: 'iam.events',
      exchangeType: 'topic',
      prefetchCount: 10,
    }),
  ],
})
export class AppModule {}
```

**Async Configuration:**

```typescript
RabbitMQInfraModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    uri: configService.get('RABBITMQ_URI'),
    exchange: 'iam.events',
    exchangeType: 'topic',
  }),
  inject: [ConfigService],
});
```

### Snapshot Management

#### SnapshotService

Service for managing aggregate snapshots following **ADR-6** (Snapshot Policy).

**Features:**

- Hybrid snapshot policy (N events OR T time)
- Automatic cleanup of old snapshots (keeps K=3 latest)
- Support for custom snapshot policies

**Usage:**

```typescript
import { SnapshotService, HybridSnapshotPolicy, PostgresSnapshotRepository } from '@ecoma-io/iam-infrastructure';

const policy = new HybridSnapshotPolicy(100, 24 * 60 * 60 * 1000); // 100 events or 24h
const repository = new PostgresSnapshotRepository(dataSource);
const service = new SnapshotService(repository, policy);

// Create snapshot if needed
const created = await service.createSnapshotIfNeeded(aggregate, 'UserAggregate', lastSnapshotTime);

// Force create snapshot
await service.createSnapshot(aggregate, 'UserAggregate');

// Load snapshot
const snapshot = await service.loadSnapshot('user-123');
```

#### PostgresSnapshotRepository

PostgreSQL implementation of `ISnapshotRepository` using TypeORM.

**Schema:**

```sql
CREATE TABLE aggregate_snapshots (
    aggregate_id VARCHAR(255) NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    version INT NOT NULL,
    state JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (aggregate_id, version)
);
```

## Database Migrations

### PostgreSQL Migrations

Located in `src/migrations/`:

- `V1__create_aggregate_snapshots.sql`: Snapshot table schema
- `V2__create_read_models.sql`: Read model tables for Users, Tenants, Roles, Memberships, ServiceDefinitions

Run migrations using your preferred migration tool (TypeORM, Flyway, etc.)

## Read Models

### TypeORM Entities

Read model entities are denormalized projections optimized for queries:

- **UserEntity**: User profile information
- **TenantEntity**: Organization/namespace data
- **RoleEntity**: Role definitions with permission keys
- **MembershipEntity**: User-Tenant relationships with role assignments
- **ServiceDefinitionEntity**: Permission registry with versioned permission trees

### Repositories

**UserReadRepository:**

```typescript
import { UserReadRepository } from '@ecoma-io/iam-infrastructure';

// Find by ID
const user = await userRepo.findById('user-123');

// Find by email
const user = await userRepo.findByEmail('user@example.com');

// Find by social provider
const user = await userRepo.findBySocialProvider('google', 'google-123');

// Pagination
const { users, total } = await userRepo.findAll({ skip: 0, take: 10 });
```

**RoleReadRepository:**

```typescript
import { RoleReadRepository } from '@ecoma-io/iam-infrastructure';

// Find all roles in a tenant
const roles = await roleRepo.findByTenantId('tenant-123');

// Find role by name
const role = await roleRepo.findByTenantAndName('tenant-123', 'Admin');

// Bulk query
const roles = await roleRepo.findByIds(['role-1', 'role-2']);
```

**MembershipReadRepository:**

```typescript
import { MembershipReadRepository } from '@ecoma-io/iam-infrastructure';

// Find user's memberships
const memberships = await membershipRepo.findByUserId('user-123');

// Find tenant's members
const memberships = await membershipRepo.findByTenantId('tenant-123');

// Find specific membership
const membership = await membershipRepo.findByUserAndTenant('user-123', 'tenant-123');
```

### ReadModelModule

NestJS module for TypeORM read models:

```typescript
import { ReadModelModule } from '@ecoma-io/iam-infrastructure';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'iam_read',
      autoLoadEntities: true,
    }),
    ReadModelModule.forRoot(),
  ],
})
export class AppModule {}
```

## Cache Layer (Redis)

### PermissionCacheRepository

Redis-based caching for permissions with RYOW support following **ADR-3**.

**Features:**

- User permissions cache: `user_perms:{userId}:{tenantId}`
- Combined permissions tree: `permissions:combined-tree`
- Projection checkpoints: `projection:{projectorName}:checkpoint`
- RYOW polling mechanism

**Usage:**

```typescript
import { PermissionCacheRepository } from '@ecoma-io/iam-infrastructure';

// Cache user permissions
await cache.setUserPermissions('user-123', 'tenant-456', ['read:users', 'write:users']);

// Get cached permissions
const perms = await cache.getUserPermissions('user-123', 'tenant-456');

// Invalidate cache
await cache.invalidateUserPermissions('user-123', 'tenant-456');

// RYOW: Wait for projection
const reached = await cache.waitForProjection('UserProjector', BigInt(100), 5000);
if (reached) {
  // Projection caught up, read model is consistent
}

// Get projection checkpoint
const checkpoint = await cache.getProjectionCheckpoint('UserProjector');

// Set projection checkpoint (called by projector)
await cache.setProjectionCheckpoint('UserProjector', BigInt(150));
```

### PermissionCacheModule

NestJS module for Redis integration:

```typescript
import { PermissionCacheModule } from '@ecoma-io/iam-infrastructure';

@Module({
  imports: [
    PermissionCacheModule.forRoot({
      host: 'localhost',
      port: 6379,
      password: 'secret',
      db: 0,
    }),
  ],
})
export class AppModule {}

// Async configuration
PermissionCacheModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    host: config.get('REDIS_HOST'),
    port: config.get('REDIS_PORT'),
  }),
  inject: [ConfigService],
});
```

## Search Layer (Elasticsearch)

### Search Repositories

Elasticsearch repositories for full-text search following **ADR-2**.

**UserSearchRepository:**

```typescript
import { UserSearchRepository } from '@ecoma-io/iam-infrastructure';

// Index user
await userSearch.index({
  userId: 'user-123',
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  status: 'Active',
  createdAt: new Date().toISOString(),
});

// Search users
const { users, total } = await userSearch.search('john', { skip: 0, take: 10 });

// Delete user from index
await userSearch.delete('user-123');
```

**TenantSearchRepository:**

```typescript
import { TenantSearchRepository } from '@ecoma-io/iam-infrastructure';

// Index tenant
await tenantSearch.index({
  tenantId: 'tenant-123',
  name: 'Acme Corp',
  namespace: 'acme',
  createdAt: new Date().toISOString(),
});

// Search tenants
const { tenants, total } = await tenantSearch.search('acme', { skip: 0, take: 10 });
```

### SearchModule

NestJS module for Elasticsearch integration:

```typescript
import { SearchModule } from '@ecoma-io/iam-infrastructure';

@Module({
  imports: [
    SearchModule.forRoot({
      node: 'http://localhost:9200',
      auth: {
        username: 'elastic',
        password: 'changeme',
      },
    }),
  ],
})
export class AppModule {}

// Async configuration
SearchModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    node: config.get('ELASTICSEARCH_NODE'),
    auth: {
      username: config.get('ELASTICSEARCH_USER'),
      password: config.get('ELASTICSEARCH_PASSWORD'),
    },
  }),
  inject: [ConfigService],
});
```

The module automatically creates indices with proper mappings on initialization.

## Testing

All infrastructure components include unit tests (33 tests passing):

```bash
# Run tests
npx nx test iam-infrastructure

# Run with coverage
npx nx test iam-infrastructure --coverage
```

**Test Coverage:**

- EventStoreDbRepository: 2 tests
- RabbitMQEventPublisher: 3 tests
- SnapshotService: 5 tests
- RabbitMQInfraModule: 3 tests
- UserReadRepository: 8 tests
- PermissionCacheRepository: 12 tests

## Architecture Decision Records (ADRs)

This implementation follows these ADRs from `docs/iam/architecture.md`:

- **ADR-2**: Technology Stack Selection (EventStoreDB, RabbitMQ, PostgreSQL, Redis, Elasticsearch)
- **ADR-3**: Read-Your-Own-Writes Mechanism (projection checkpoints in Redis)
- **ADR-4**: Event Handling & Replay with DLQ
- **ADR-6**: Snapshot Policy for Aggregates (Hybrid: N=100 events OR T=24h)

## Integration with Other Libraries

```typescript
// Command side (write)
import { EventStoreDbRepository, RabbitMQEventPublisher } from '@ecoma-io/iam-infrastructure';
import { UserAggregate } from '@ecoma-io/iam-domain';
import { RegisterUserHandler } from '@ecoma-io/iam-command-interactor';

// Query side (read)
import { UserProjector } from '@ecoma-io/iam-worker-projector';
```

## Dependencies

Required peer dependencies:

- `@eventstore/db-client`: ^6.2.1
- `@golevelup/nestjs-rabbitmq`: ^6.0.2
- `@nestjs/common`: ^11.0.0
- `@nestjs/core`: ^11.0.0
- `@nestjs/typeorm`: ^11.x
- `typeorm`: ^0.3.27
- `pg`: ^8.16.3
- `ioredis`: ^5.8.2
- `@elastic/elasticsearch`: ^9.2.0

## Next Steps

- [x] Event Store (EventStoreDB)
- [x] Event Publisher (RabbitMQ with @golevelup/nestjs-rabbitmq)
- [x] Snapshot Management (PostgreSQL)
- [x] Read Model Layer (TypeORM entities, repositories)
- [x] Cache Layer (Redis with RYOW checkpoints)
- [x] Search Layer (Elasticsearch for Users/Tenants)
- [ ] Implement upcasters for event schema evolution
- [ ] Add monitoring and metrics
- [ ] Add connection resilience and retry logic

## License

Proprietary - @ecoma-io
