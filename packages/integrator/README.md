# @ecoma-io/integrator

Integration helpers for building containerized integration test environments — supports Toxiproxy-based proxied services, safe service creation helpers and consistent logging for tests.

This package is a lightweight, focused runtime that helps tests or internal tooling create reproducible service endpoints for other test helpers (Postgres, Redis, MinIO, RabbitMQ, Elasticsearch, etc.). It is intentionally small and meant to be extended by higher‑level environments such as `libs/core-product-integration-environment`.

---

## Why this package

- Encapsulates common patterns when building integration test environments backed by testcontainers
- Optional Toxiproxy support so tests can simulate flaky networks, latency and partial failures
- Small, test-friendly surface that is easy to mock in unit tests

## Main concepts and API

- IntegrationEnvironment (abstract class)
  - start(): Promise<void> — start optional proxy and application containers (subclass provides containers)
  - stop(): Promise<void> — stops started containers and performs cleanup
  - protected initAppContainers(): Promise<StartedTestContainer[]> — implement in subclass to start containers
  - protected createService(name, port): Promise<IService | IProxiedService> — create either a direct service endpoint or create and return a proxied service
  - protected createLogConsumer(containerName): (stream) => void — helper for wiring container logs into the configured ILogger
  - protected containerLog(containerName, message) — internal log routing logic (safe JSON parsing + level mapping)

- Interfaces
  - IService { host, port }
  - IProxiedService extends IService { addToxic(), setEnabled() }
  - ILogger — small logging surface used by the environment
  - IEnvironmentOptions — config options (internalHost, proxied, toxiProxyImage, logger, id)

## Install

This package is a workspace package in this repository and is published as `@ecoma-io/integrator`.

If you use the monorepo it is already available via the TypeScript path alias `@ecoma-io/integrator`.

## Quick usage

The package is meant to be extended by a concrete environment that starts application containers. Example minimal subclass:

```ts
import { IntegrationEnvironment, IEnvironmentOptions } from '@ecoma-io/integrator';

class MyTestEnvironment extends IntegrationEnvironment {
  protected async initAppContainers() {
    // start containers using `testcontainers` here and return array of started containers
    return [];
  }
}

const env = new MyTestEnvironment({ internalHost: '127.0.0.1', proxied: false });
await env.start();
// ... run tests against env.createService(...) or services started in initAppContainers
await env.stop();
```

## Proxied vs Direct services

IntegrationEnvironment supports a proxied mode via Toxiproxy. When constructed with `proxied: true` the environment will start Toxiproxy and `createService()` will create a proxy for the requested upstream.

If `proxied` is enabled `createService()` resolves to an object that implements `IProxiedService` which includes runtime control methods:

- addToxic(name, type, attributes, stream?) — create a Toxiproxy toxic to simulate latency, bandwidth limits, slow close etc.
- setEnabled(enabled) — enable or disable the proxy (block/unblock traffic)

If `proxied` is false, `createService()` returns a plain `IService` with host and numeric port.

Example (proxied):

```ts
const env = new MyTestEnvironment({ internalHost: '127.0.0.1', proxied: true });
await env.start();

// create proxied service for POSTGRES_PORT env var (or pass number)
const svc = await (env as any).createService('postgres-1', process.env.POSTGRES_PORT);

if ('addToxic' in svc) {
  // proxied
  await svc.addToxic('lat', 'latency', { latency: 200 });
}

await env.stop();
```

## Example: implement a Postgres + Redis integration environment

Below is an independent, complete example that shows how to implement a concrete
IntegrationEnvironment which starts Postgres and Redis (using testcontainers) and
exposes those services to tests. The example is split into focused snippets — each
block demonstrates a single concept and why it matters.

### Class skeleton — extend IntegrationEnvironment and declare container fields

```ts
import { IntegrationEnvironment, IEnvironmentOptions } from '@ecoma-io/integrator';
import { StartedTestContainer, PostgreSqlContainer, GenericContainer } from 'testcontainers';

class PostgresRedisTestEnvironment extends IntegrationEnvironment {
  private postgres?: StartedTestContainer;
  private redis?: StartedTestContainer;

  constructor(options: IEnvironmentOptions) {
    super(options);
  }

  // start postgres and redis containers and return them so the base class can stop them
  protected async initAppContainers(): Promise<StartedTestContainer[]> {
    this.postgres = await new PostgreSqlContainer('postgres:15').withDatabase('test').withUsername('test').withPassword('test').start();

    this.redis = await new GenericContainer('redis:7').withExposedPorts(6379).start();

    return [this.postgres, this.redis];
  }
}
```

Why: Returning the StartedTestContainer array allows the IntegrationEnvironment base class to include those containers in its cleanup steps; putting container start logic in one place keeps tests simple and predictable.

---

### 2 Expose small helpers to get service endpoints

```ts
public async postgresService() {
  return this.createService('postgres', String(this.postgres?.getMappedPort(5432)));
}

public async redisService() {
  return this.createService('redis', String(this.redis?.getMappedPort(6379)));
}
```

Why: Tests should use small, intention-revealing helpers. `createService()` will return either a direct `IService` (host/port) or an `IProxiedService` if you enabled `proxied: true`.

---

### 3 Use per-suite environment in tests (beforeAll/afterAll + test cases)

```ts
// shared across tests in this suite
let env: PostgresRedisTestEnvironment;

beforeAll(async () => {
  env = new PostgresRedisTestEnvironment({ internalHost: '127.0.0.1', proxied: false });
  await env.start();
});

afterAll(async () => {
  await env.stop();
});

test('connects to Postgres and runs a basic query', async () => {
  const pgSvc = await env.postgresService();
  // (example: connect with node-postgres, run a query and assert results)
  expect(pgSvc).toBeDefined();
});

test('connects to Redis and performs basic ops', async () => {
  const redisSvc = await env.redisService();
  // (example: connect with ioredis and run basic commands)
  expect(redisSvc).toBeDefined();
});
```

Why: Keeping tests as small `test(...)` blocks that reference a shared environment helps reduce container startup overhead while keeping each case focused and readable.

---

### 4 Proxied chaos-testing example (disconnect / add toxic)

```ts
test('chaos: proxied scenario — add latency toxic and disable connectivity', async () => {
  // start separate environment in proxied mode for this test
  const penv = new PostgresRedisTestEnvironment({ internalHost: '127.0.0.1', proxied: true });
  await penv.start();

  const proxiedRedis = (await penv.redisService()) as unknown as {
    addToxic?: (name: string, type: string, attributes: Record<string, unknown>, stream?: 'upstream' | 'downstream') => Promise<unknown>;
    setEnabled?: (enabled: boolean) => Promise<unknown>;
  };

  // inject 1000ms latency to simulate slow network
  if (proxiedRedis.addToxic) {
    await proxiedRedis.addToxic('latency-1000', 'latency', { latency: 1000 });
  }

  // then disable traffic (simulates a network partition)
  if (proxiedRedis.setEnabled) {
    await proxiedRedis.setEnabled(false);
  }

  // (real tests should now attempt operations and assert client failures/timeouts)

  await penv.stop();
});
```

Why: Running chaos scenarios under a proxied environment helps validate that your application handles partial failures and network problems gracefully — useful for resilience tests and chaos experiments.

```

This example is independent (it doesn't rely on other repo-specific helpers) and shows how to:

- start multiple containers inside `initAppContainers()`
- return started containers so the base class can include them in cleanup
- call `createService()` to obtain typed host/port results (or proxied service if `proxied: true`)

## Unit testing guidance

- Unit tests should not start real containers. Instead:
  - Mock the Toxiproxy container (StartedToxiProxyContainer) to return a fake proxy object with `createProxy()` that returns a `port` and `instance` whose `addToxic()` is a jest.fn() etc.
  - Use a small concrete subclass in tests to access protected methods (examples in the repository demonstrate this pattern).
  - Reset mocks between tests.

See `packages/integrator/src/lib/integration-environment.test.ts` for focused unit tests that cover:

- non-proxied service creation
- proxied service creation and control methods
- invalid port handling
- container log routing to ILogger methods

## Troubleshooting

- If you see parse errors coming from container logs ensure the logger can accept objects (this package forwards parsed JSON logs to the configured ILogger with a `container` property attached).
- When running with `proxied: true` ensure testcontainers can start the Toxiproxy image; customize the image with `toxiProxyImage` option if necessary.

## Contributing

If you add new convenience helpers in other libs (for example `getMyService()`), prefer keeping core behaviors in this package small and rely on higher-level packages to provide specialized, opinionated helpers.

---

If you'd like, I can now:

- add this README into the repository (I can commit it), or
- polish the README with more example snippets from `core-product-integration-environment` for common services (Postgres/Redis/MinIO), or
- add a short HOWTO showing how to unit-test code that uses a proxied service.

Which would you like me to do next?
```
