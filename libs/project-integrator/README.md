# project-integrator

A lightweight integration library used across services in this monorepo to create and manage clients for common infrastructure (Postgres, MongoDB, Redis, RabbitMQ, MinIO, Elasticsearch, EventStoreDB, Maildev, Clickhouse) and provide shared utilities (observability, axios interceptors, env validation and logging helpers).

**Location:** `libs/project-integrator`

## Purpose

- **What:** Exposes service clients and helpers to simplify connecting to core infra from apps and libs.
- **Why:** Centralises connection configuration, environment validation, and common helpers so service projects don't duplicate bootstrap code.

## Main exports

- **`ProjectIntegrator`**: high-level helper to create and manage service clients.
- **Service clients**: factory functions / classes for `postgres`, `mongo`, `redis`, `rabbitmq`, `minio`, `elasticsearch`, `eventstore`, `maildev`, `clickhouse`.
- **Utilities**: `observability`, `axiosInterceptor`, `formatLog`, and `requiredEnvVars` helpers.

Files to look at:

- `src/lib/project-integrator.ts` — integrator entry point.
- `src/lib/services/*` — per-service client implementations and tests.
- `src/lib/utils/*` — helpers (observability, axios interceptor, logging, env validation).

## Installation & Build

This library is part of the Nx monorepo. From the repository root run:

```bash
pnpm install
npx nx build project-integrator
```

Notes:

- Use `npx nx build <project>` or the workspace-specific build command for other projects that consume this library.

## Usage Example

Simple example showing how to create an integrator instance and access a client:

```ts
import { ProjectIntegrator } from '@ecoma-io/project-integrator';

async function start() {
  // Create integrator (reads required env vars via helper)
  const integrator = new ProjectIntegrator({
    /* optional overrides */
  });

  // Initialize any clients you need
  const pg = await integrator.postgres();
  const redis = await integrator.redis();

  // Use clients
  await pg.query('SELECT 1');
  await redis.ping();

  // When shutting down
  await integrator.close();
}

start().catch((err) => console.error(err));
```

Check specific service clients in `src/lib/services` for more detailed APIs and configuration options.

## Required Environment Variables

This library validates required environment variables at runtime. Common variables include (names in repo may vary; search `required-env-vars` helper to see the exact list):

- **Postgres**: `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE`
- **MongoDB**: `MONGO_URI` or `MONGO_HOST`, `MONGO_PORT`, `MONGO_USER`, `MONGO_PASSWORD`, `MONGO_DB`
- **Redis**: `REDIS_URL` or `REDIS_HOST`, `REDIS_PORT`
- **RabbitMQ**: `RABBITMQ_URL` or `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`
- **MinIO**: `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`
- **Elasticsearch**: `ELASTICSEARCH_NODE` (URL) and optional auth vars
- **EventStoreDB**: `ESDB_CONNECTION_STRING` or similar
- **Maildev**: `MAILDEV_URL` (for test/dev tooling)
- **Clickhouse**: `CLICK_HOUSE_HOST`, `CLICK_HOUSE_PORT`, `CLICK_HOUSE_USER`, `CLICK_HOUSE_PASSWORD`, `CLICK_HOUSE_DATABASE`

If you need the precise variable names used by the library, open `src/lib/utils/required-env-vars.ts`.

## Tests & Coverage

Run unit tests for this library with Nx/Jest:

```bash
npx nx test project-integrator --coverage
```

Coverage HTML will be written under `libs/project-integrator/coverage`.

## Contributing

- Follow the repo contribution rules and run lint/tests before pushing.
- When changing public interfaces (export shapes), update consumers and run `npx nx affected:test` or run tests for dependent projects.

## Troubleshooting

- If a client fails to connect, enable debug/observability by configuring the observability helpers or checking logs produced by `formatLog`.
- For environment variable failures, the `required-env-vars` helper throws with a readable message listing missing keys.

## Where to look next

- Service implementations: `src/lib/services/*`
- Utilities: `src/lib/utils/*`
- Unit tests: `src/lib/*.test.ts` and `src/lib/services/*.test.ts`
