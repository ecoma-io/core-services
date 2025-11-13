# @ecoma-io/integration-hybridize

A TypeScript library for managing hybrid integration test environments using Testcontainers. It supports both proxied (chaos testing) and direct service connections, enabling flexible E2E and integration testing for microservices.

## Approach: Hybrid Testing Strategy

This library implements a **hybrid testing strategy** that combines the best of shared containers with per-test isolation through optional proxying. Unlike traditional strategies, it allows containers to run continuously while providing test-level control over service connections.

### Key Features

- **Shared Containers**: Containers (e.g., databases, caches) are started once and reused across tests for performance.
- **Optional Proxying**: Use ToxiProxy for chaos testing (inject failures like latency or disconnections) on a per-test basis, or connect directly without proxies.
- **Abstract Base Class**: Extend `IntegrationEnvironment` to define your specific containers and services.
- **Flexible Connections**: Create services that are either proxied (for chaos) or direct (for standard integration tests).

### How It Works

1. **Setup**: Start shared containers and optionally a ToxiProxy container.
2. **Per-Test Isolation**: For each test, create service connections via proxies (if enabled) to simulate network conditions, or direct connections.
3. **Chaos Testing**: Inject toxics (e.g., latency, bandwidth limits) into proxies without affecting the underlying containers.
4. **Cleanup**: Stop all containers after the test suite.

## Comparison with Traditional Strategies

Testcontainers supports two main strategies for container lifecycle. Here's how the hybrid approach compares:

### 1. Container per Test Suite (Shared/Singleton Containers)

- **Description**: Start containers once at the beginning of the test suite and stop at the end. All tests share the same containers.
- **Pros**:
  - Fast startup (containers start only once).
  - Low resource usage.
  - Suitable for stateless or read-only tests.
- **Cons**:
  - Risk of state leakage between tests (e.g., database data persists).
  - No isolation; one test's changes can affect others.
  - Difficult to test failure scenarios without external tools.
- **Hybrid vs. Suite-Level**: Hybrid builds on suite-level by adding proxies for per-test isolation and chaos simulation, reducing state leakage while keeping performance benefits.

### 2. Container per Test (Ephemeral/Fresh Containers)

- **Description**: Start fresh containers for each individual test and stop them afterward.
- **Pros**:
  - Complete isolation; no state leakage.
  - Easy to test with clean state.
  - Supports complex failure scenarios by manipulating containers directly.
- **Cons**:
  - Slow (10-30s per test for startup/teardown).
  - High resource usage (CPU, memory, disk).
  - Not scalable for large test suites.
- **Hybrid vs. Per-Test**: Hybrid offers better performance than per-test by reusing containers, while providing similar isolation through proxies. It's ideal when you need chaos testing without the overhead of restarting containers every time.

### Hybrid Strategy: Pros and Cons

- **Pros**:
  - **Performance**: Faster than per-test (shared containers), slower than pure suite-level but with added isolation.
  - **Isolation with Chaos**: Proxies enable per-test network simulation (e.g., simulate DB downtime) without container restarts.
  - **Flexibility**: Toggle proxying on/off; supports both chaos and standard integration tests.
  - **Scalability**: Suitable for medium-to-large test suites with mixed requirements.
  - **Resource Efficiency**: Lower overhead than per-test, higher than suite-level but with better reliability.
- **Cons**:
  - **Complexity**: Requires understanding of proxies; setup is more involved than simple suite-level.
  - **State Management**: Still possible state leakage if not handled (e.g., need manual DB resets between tests).
  - **Dependency on ToxiProxy**: If proxying is enabled, adds a container dependency.
  - **Not for All Cases**: Overkill for simple tests without chaos needs; pure suite-level is simpler for basic scenarios.

**When to Use Hybrid**:

- E2E tests for microservices needing chaos engineering.
- Integration tests requiring network failure simulation.
- Scenarios with mixed test types (some need isolation, others don't).
- Teams prioritizing speed over simplicity, with moderate test suite size.

## Installation

```bash
npm install @ecoma-io/integration-hybridize
# or
pnpm add @ecoma-io/integration-hybridize
```

## Usage

### Basic Example (Direct Connections, No Proxy)

```typescript
import { IntegrationEnvironment, Service } from '@ecoma-io/integration-hybridize';

class MyEnvironment extends IntegrationEnvironment {
  async initAppContainers() {
    // Define your containers here (e.g., Postgres, Redis)
    return [
      /* started containers */
    ];
  }

  // Expose createService for public use
  public async getService(name: string, portEnvVar: string): Promise<Service> {
    return this.createService(name, portEnvVar);
  }
}

const env = new MyEnvironment('localhost', false); // Disable proxy
await env.start();

// Create direct service
const dbService: Service = await env.getService('postgres', '5432');
// Use dbService.host and dbService.port for connections

await env.stop();
```

### Chaos Testing Example (With Proxy)

```typescript
import { IntegrationEnvironment, ProxiedService } from '@ecoma-io/integration-hybridize';

class MyEnvironment extends IntegrationEnvironment {
  async initAppContainers() {
    // Define your containers here
    return [
      /* started containers */
    ];
  }

  // Expose createService for public use
  public async getProxiedService(name: string, portEnvVar: string): Promise<ProxiedService> {
    return this.createService(name, portEnvVar) as Promise<ProxiedService>;
  }
}

const env = new MyEnvironment('localhost', true); // Enable proxy
await env.start();

const dbService = await env.getProxiedService('postgres', '5432');
// dbService is ProxiedService with addToxic and setEnabled

// Simulate latency
await dbService.addToxic('latency', 'latency', { latency: 1000 });

// Disable connection
await dbService.setEnabled(false);

await env.stop();
```

### Advanced: Custom Proxy Config

```typescript
const env = new MyEnvironment('localhost', { enabled: true, image: 'custom/toxiproxy:latest' });
```

## API Reference

### `IntegrationEnvironment`

- `constructor(internalHost: string, proxyOptions?: ProxyOptions | boolean)` - Create instance with proxy config.
- `start(): Promise<void>` - Start containers and proxy (if enabled).
- `stop(): Promise<void>` - Stop all containers.
- `createService(name: string, portEnvVar: string): Promise<Service | ProxiedService>` - Create a service connection (protected, expose in subclass).
- `log(level: 'error' | 'info' | 'warn' | 'debug', message: string)` - Log messages.

### Interfaces

- `ProxyOptions`: `{ enabled?: boolean; image?: string }`
- `Service`: `{ host: string; port: number }`
- `ProxiedService extends Service`: Adds `addToxic` and `setEnabled` for chaos testing.

## Building

Run `npx nx build integration-hybridize` to build the library.

## Running Unit Tests

Run `npx nx test integration-hybridize` to execute the unit tests via [Jest](https://jestjs.io). The tests achieve 100% code coverage for statements, branches, functions, and lines.

## Contributing

Extend `IntegrationEnvironment` for your specific needs. Expose protected methods like `createService` via public wrappers if needed for external use. Ensure tests cover both proxied and direct modes, achieving comprehensive coverage.
