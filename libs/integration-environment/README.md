# Integration Environment

An internal library providing a base implementation for integration testing environments in the Ecoma microservices monorepo. This library extends the `@ecoma-io/integration-hybridize` framework to offer convenient access to common infrastructure services like PostgreSQL, Redis, MinIO, and Maildev, with automatic setup of test databases, buckets, and keys.

## Overview

The `BaseIntegrationEnvironment` class serves as a foundation for creating test environments that can optionally use ToxiProxy for chaos testing. It provides pre-configured methods for accessing services with automatic initialization of test resources (databases, buckets, and keys).

The class is configured to work with the `dev-infras` Docker network (defined in the project's `compose.yaml`), using a hardcoded gateway IP of `172.168.186.168` for network communication. This ensures consistent network configuration across different environments.

## Features

- **Automatic Setup**: Methods that not only access services but also initialize test resources (databases, Redis databases, MinIO buckets)
- **Service Caching**: Services are initialized once and cached for subsequent calls, improving performance in test suites
- **Convenience Methods**: Pre-built methods for common services (PostgreSQL, Redis, MinIO, Maildev)
- **Environment Variable Integration**: Automatically uses env vars like `POSTGRES_PORT`, `REDIS_PORT`, etc.
- **Hybrid Testing Support**: Compatible with both shared container and per-test isolation strategies
- **Type Safety**: Full TypeScript support with TSDoc documentation
- **Extensible**: Abstract base class that can be extended for project-specific needs

## Usage

### Basic Setup

```typescript
import { BaseIntegrationEnvironment } from '@ecoma-io/integration-environment';

class MyIntegrationEnvironment extends BaseIntegrationEnvironment {
  async initAppContainers(): Promise<StartedTestContainer[]> {
    // Initialize your application containers here
    return [];
  }
}

// In your E2E test setup
const env = new MyIntegrationEnvironment('localhost', true); // enable proxy
await env.start();

// Access services with automatic setup
const { dataSource } = await env.getPostgres(); // Creates test database
const { redis } = await env.getRedis(); // Selects DB and sets test key
const { bucketName, s3Client } = await env.getMinio(); // Creates bucket
const maildevService = await env.getMaildev(); // Simple service access

await env.stop();
```

**Note**: This library is designed to work with the `dev-infras` Docker network defined in the project's `compose.yaml`, using gateway IP `172.168.186.168`.

### Environment Variables

The library expects the following environment variables to be set:

- `POSTGRES_PORT`: Port for PostgreSQL service
- `POSTGRES_USERNAME`: Username for PostgreSQL
- `POSTGRES_PASSWORD`: Password for PostgreSQL
- `REDIS_PORT`: Port for Redis service
- `REDIS_PASSWORD`: Password for Redis service
- `MINIO_PORT`: Port for MinIO service
- `MINIO_KEY`: Access key for MinIO
- `MINIO_SECRET`: Secret key for MinIO
- `MAILDEV_WEB_PORT`: Port for Maildev web interface

**Note**: All environment variables are required. The constructor will throw an error if any required environment variable is not set.

### Advanced Usage

#### PostgreSQL with Custom Database

```typescript
const { dataSource } = await env.getPostgres();
// dataSource is already initialized and connected to the test database
// Use dataSource for your tests
```

#### Redis with Isolated Database

```typescript
const { redis } = await env.getRedis();
// Redis client is connected, database selected (1-15), and test key set
// Use redis client for your tests
```

#### MinIO with Public Bucket

```typescript
const { bucketName, s3Client } = await env.getMinio({ isPublicBucket: true });
// Bucket is created with public read policy
// Use s3Client and bucketName for your tests
```

### Extending for Custom Services

```typescript
import { BaseIntegrationEnvironment } from '@ecoma-io/integration-environment';

class CustomIntegrationEnvironment extends BaseIntegrationEnvironment {
  async initAppContainers(): Promise<StartedTestContainer[]> {
    // Your custom container setup
    return [];
  }

  async getCustomService(): Promise<ProxiedService | Service> {
    return await this.createService(`custom-${this.id}`, process.env['CUSTOM_PORT']);
  }
}
```

## API Reference

### BaseIntegrationEnvironment

#### Methods

- `getPostgres(): Promise<(ProxiedService | Service) & { dataSource: DataSource }>` - Gets PostgreSQL service with initialized DataSource and created test database
- `getRedis(): Promise<(ProxiedService | Service) & { redis: Redis }>` - Gets Redis service with initialized Redis client, selected database, and test key
- `getMinio(options?: { isPublicBucket?: boolean }): Promise<(ProxiedService | Service) & { bucketName: string; s3Client: S3Client }>` - Gets MinIO service with created bucket and optional public policy
- `getMaildev(): Promise<ProxiedService | Service>` - Gets Maildev service

All methods use the corresponding environment variables and create services with names prefixed by the environment ID.

## Testing Strategy

This library supports the hybrid testing approach combining:

- **Shared Containers**: Containers started once and reused across tests for performance
- **Automatic Resource Setup**: Each service access initializes necessary test resources
- **Service Caching**: Prevents redundant initialization across multiple test calls
- **Constructor Validation**: Ensures all required environment variables are set before initialization
- **Optional Chaos Testing**: ToxiProxy integration for simulating network issues
- **Per-Test Isolation**: When needed, individual test isolation

The test suite includes both unit tests (with mocks) and integration tests (with real Testcontainers):

- **Unit Tests**: Mock-based testing of service creation, caching, and error handling
- **Integration Tests**: Real container testing with Testcontainers, including caching verification
- **Constructor Tests**: Validation that required environment variables are properly checked

## Building

Run `npx nx build integration-environment` to build the library.

## Running Tests

Run `npx nx test integration-environment` to execute both unit and integration tests via [Jest](https://jestjs.io) and [Testcontainers](https://testcontainers.com).

The tests follow the Arrange-Act-Assert (AAA) pattern and include:

- **Unit Tests**: Mock-based testing of service creation, caching, error handling, and constructor validation
- **Integration Tests**: Real container testing with Testcontainers, including service connectivity and caching verification

**Note**: Integration tests require Docker to be running and may take longer to execute due to container startup time.

## Dependencies

- `@ecoma-io/integration-hybridize`: Core framework for hybrid integration testing
- `typeorm`: For PostgreSQL database operations
- `ioredis`: For Redis client operations
- `@aws-sdk/client-s3`: For MinIO/S3 operations
- `testcontainers`: For container management in tests

## Contributing

This is an internal library tailored for the Ecoma microservices project. When making changes:

1. Follow the existing patterns and conventions
2. Add unit tests for new functionality, including constructor validation
3. Update TSDoc documentation
4. Ensure compatibility with the hybrid testing strategy
5. Note: The network IP is hardcoded to `172.168.186.168` (gateway of the `dev-infras` network in `compose.yaml`)
6. All environment variables are required - update constructor validation if adding new env vars
7. Run `npx nx lint integration-environment` and `npx nx test integration-environment` before committing
