# Ecoma Core Services - AI Coding Instructions

## Architecture Overview

This is an **Nx monorepo** for NestJS microservices at Ecoma, featuring shared libraries, publishable packages, and a robust development workflow.

- `apps/` - NestJS microservices, migration apps, and E2E test projects
- `e2e/` - E2E test projects (e.g., `resource-e2e`)
- `libs/` - Shared libraries for internal projects
- `packages/` - Publishable shared packages for DTOs and common types (can be used on the frontend applications)
- `tools/` - The tools use for internal repo
- `docs/` - Documentation (architecture, getting started, overview)
- `infras/` - Development infrastructure services (Docker Compose for Postgres, MinIO, Redis, RabbitMQ, etc.)

## Code Generation Rules — MUST FOLLOW

When writing or modifying code, **strictly adhere** to the language and framework-specific conventions documented in `.github/instructions/`:

- **TypeScript**: `.github/instructions/ts.instructions.md` — TSDoc, types, imports, async/await patterns
- **Jest unit tests**: `.github/instructions/ts-jest.instructions.md` — AAA pattern, mocking, async testing
- **E2E tests**: `.github/instructions/ts-e2e.instructions.md` — Testcontainers, environment setup, idempotency
- **Shell scripts**: `.github/instructions/shell.instructions.md` — Safety flags, POSIX compliance, cleanup
- **Dockerfiles**: `.github/instructions/docker.instruction.md` — Multi-stage builds, security, layer optimization

These files define mandatory rules for code quality, safety, and maintainability. Violating these rules will result in CI failures or code review rejections.

## Path Aliases (tsconfig.base.json)

Always use these imports instead of relative paths:

```typescript
import { GlobalExceptionsFilter } from '@ecoma-io/nestjs-service';
import { ErrorResponse } from '@ecoma-io/common';
```

- All projects (libs and packages) must be imported via `@ecoma-io/<project-name>` alias.

## Ecoma Microservices — AI coding quick instructions

This repo is an Nx monorepo of NestJS microservices with shared libs and publishable packages for @ecoma-io.
Focus: follow workspace conventions (path aliases, custom exceptions, config patterns) and use Nx targets for build/test/docker.

Key quick facts (do these first):

- Projects: `apps/` (services), `e2e/` (E2E tests), `libs/` (internal libs), `packages/` (npm-publishable DTOs/types), `docs/` (documentation), `infras/` (dev infrastructure).
- Use TS path aliases from `tsconfig.base.json`: `@ecoma-io/*`. Avoid relative imports across projects.
- **Read and follow** the code generation rules in `.github/instructions/` before writing code.

Critical conventions (must follow):

- Exceptions: use project custom exceptions (exported from the shared lib) — do NOT import Nest built-ins directly. See `packages/nestjs-exceptions/`.
- Config: services call `ConfigModule.forRoot({ skipProcessEnv: true })` and validate with `validateConfig()` utilities (see `libs/*/src/lib/utils/validate-config.ts`).
- TypeORM: when used, services use `TypeOrmModule.forRootAsync({ autoLoadEntities: true })` and ship a `datasource.ts` for migrations.

Testing & CI

- Unit: `npx nx test <project>` (Jest).
- E2E: `npx nx e2e <project>-e2e` — tests use Testcontainers. See `apps/*-e2e/src/support/test.environment.ts` for the standard setup.
- CI runs: `nx affected -t lint,test,build,docker:build,e2e` (with smart base detection) and uses `release-it` to publish.
- Pre-commit: Runs `nx affected -t lint test build e2e --staged` on staged files.

Build / Docker / Publish

- Local dev: `npx nx serve <project>` (watch) or `npx nx build <project>` for production bundles.
- Docker: `npx nx docker:build <project>` and `npx nx docker:run <project>`.
- Publish: `npx nx publish <project>` (invokes scripts/publish-docker-image.mjs).

Developer rules and style

- No `console.log` — use NestJS `Logger` consistently.
- ESLint enforces path aliases and other rules; follow existing patterns in `libs/*` and `apps/*`.
- Commits follow Conventional Commits (commitlint + Nx scopes).

Common tasks for an AI code agent

- When adding imports, prefer aliases (example: `import { Something } from '@ecoma-io/nestjs-exceptions'`).
- When editing app bootstrap, ensure `GlobalExceptionsFilter` remains registered (see `apps/resource-service/src/main.ts`).
- When adding config keys: update `apps/<service>/app.config.ts` and `README.md` or `.env` at repo/project root.

Quick pointers to inspect when working on a change

- App bootstrap: `apps/*/src/main.ts`
- Exception helpers: `packages/nestjs-exceptions/` and `packages/nestjs-service/`
- TypeORM / migrations: `libs/nestjs-typeorm/` and `apps/*/datasource.ts`
- E2E patterns: `apps/*-e2e/src/support/test.environment.ts`
- Webpack / bundling: `apps/<service>/webpack.config.js`

If something is unclear, paste the files you plan to modify (or the `git diff`) and I will:

1. point to the exact files to update,
2. propose a minimal patch following repo conventions,
3. run tests/build locally and report results.
