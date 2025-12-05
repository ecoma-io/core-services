**NestJS Helpers**

Lightweight utility helpers and building blocks for NestJS services used across the monorepo.

This package provides common configuration helpers, standardized exceptions, an application-level exceptions filter, health-check utilities, and observability helpers (logger/tracer) intended for re-use across services.

**Contents**

- **Config:** `BaseConfigService`, `expandEnv`, `validateConfig` — helpers for reading, expanding and validating process environment into typed config classes.
- **Exceptions:** typed application exceptions (`HttpException`, `IntrinsicException`, `ConflictException`, `NotFoundException`, `UnauthorizedException`, `UnprocessableEntityException`).
- **Filters:** `GlobalExceptionsFilter` — catches and normalizes exceptions at the HTTP layer.
- **Health:** `HealthCheckController`, `HealthCheckModule` — small health-check helpers and registration utilities.
- **Observability:** `NestStandardizedLogger`, `NestStandardizedTracer` — integrations for standardized logging and tracing.
- **Pipes:** global validation pipe helpers (used by Nest apps to validate incoming DTOs).

**Why this package**

- Provides a single place for small, well-tested NestJS primitives used by many services in the monorepo.
- Standardizes error shapes and health-check behaviour to make service responses consistent.

# nestjs-common

Helpers for all NestJS microservices at ecoma. This package provides shared, lightweight utilities and building blocks used across the monorepo.

## Overview

Includes configuration helpers, standardized exceptions, a global exceptions filter, health-check utilities, and basic observability helpers (logger/tracer).

## Contents

- **Config:** `BaseConfigService`, `expandEnv`, `validateConfig` — helpers for reading, expanding and validating process environment into typed config classes.
- **Exceptions:** typed application exceptions (`HttpException`, `IntrinsicException`, `ConflictException`, `NotFoundException`, `UnauthorizedException`, `UnprocessableEntityException`).
- **Filters:** `GlobalExceptionsFilter` — catches and normalizes exceptions at the HTTP layer.
- **Health:** `HealthCheckController`, `HealthCheckModule` — small health-check helpers and registration utilities.
- **Observability:** `NestStandardizedLogger`, `NestStandardizedTracer` — integrations for standardized logging and tracing.
- **Pipes:** global validation pipe helpers (used by Nest apps to validate incoming DTOs).

## Install / Use

This package is part of the workspace. To use it from another project in this repository import the module or helper from the package export path. Example:

```ts
import { GlobalExceptionsFilter } from '@ecoma-io/nestjs-common';
// or, for direct imports inside the monorepo
import { BaseConfigService } from 'packages/nestjs-common/src/config/base-config.service';
```

Prefer using the path alias configured in the workspace if present (check the root `tsconfig.base.json`).

## Examples

### Base configuration service pattern

```ts
class AppEnv extends BaseProcessEnvironment {
  @IsString()
  APP_NAME!: string;
}

class AppConfigService extends BaseConfigService<AppEnv> {
  constructor() {
    super(AppEnv);
  }
}

const cfg = new AppConfigService();
const env = cfg.getEnvironments();
```

### Register `GlobalExceptionsFilter` in your Nest app

```ts
import { GlobalExceptionsFilter } from '@ecoma-io/nestjs-common';

app.useGlobalFilters(new GlobalExceptionsFilter(httpAdapterHost, logger));
```

### Health check module registration

```ts
import { HealthCheckModule } from '@ecoma-io/nestjs-common';

const mod = HealthCheckModule.register([SomeChecker], { imports: [], extras: [] });
```

## Testing

- Tests in this package use Jest and follow repository test conventions (Arrange/Act/Assert comments, typed mocks, and Jest configuration).
- Run tests for this package via Nx (from workspace root):

```bash
npx nx test nestjs-common
```

Or run Jest directly for quicker iteration:

```bash
pnpm --filter=@ecoma-io/nestjs-common test
# or
npx jest packages/nestjs-common/src --runInBand
```

## Linting & Conventions

- Follow the repository TypeScript and test conventions. Tests should use the AAA pattern (`// Arrange` / `// Act` / `// Assert`) and prefer `async/await` for async assertions.
- When adding new exports, keep them typed and add unit tests under `src/**.test.ts`.

## Contributing

- Keep changes minimal and focused.
- Add unit tests for new behaviour and update this README when public APIs change.
- Run `pnpm install` once if you haven't synced the workspace dependencies.

## Troubleshooting

- If imports fail due to path aliases, check `tsconfig.json` / `tsconfig.base.json` and the project's `jest.config.*` for `moduleNameMapper`.
- If tests behave differently locally, try clearing Jest caches and Nx caches:

```bash
npx jest --clearCache
npx nx reset
```

## License & Maintainers

- This package follows the repository-level license and contributing guidelines. For questions about design or integration, contact the core-services maintainers.

---

_This README is a lightweight companion for `packages/nestjs-common`. For deeper details, review the source files under `packages/nestjs-common/src/`._
