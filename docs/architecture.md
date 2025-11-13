# Architecture — System architecture overview

This document describes the high-level architecture and the dependency rules that projects in this monorepo must follow. It focuses on package/library/app grouping and allowed dependencies so teams can maintain clear boundaries and safe, publishable packages.

## High-level groups

- `packages/` — publishable npm packages. These are intended to be standalone contracts (DTOs, types, shared config helpers, small utilities) that other repos (including frontend) can consume.
- `libs/` — internal shared libraries used only by apps within this monorepo. They contain implementation helpers, integration utilities, TypeORM helpers, and testing helpers.
- `apps/` — runnable applications and projects (microservices, migration apps, e2e projects, CLI tools). Examples: `resource-service`, `resource-migration`, `resource-e2e`.

## Dependency rules (must-follow)

These rules are deliberately strict to keep publishable packages independent and to avoid circular or deployment-unsafe dependencies.

1. packages must be self-contained

- Anything in `packages/` MUST NOT depend on code in `libs/` or `apps/`.
- `packages/` should only use external, well-versioned npm dependencies or internal code that is also under `packages/`.
- Rationale: `packages/` are intended for publishing and reuse outside the monorepo. They must remain independent of internal implementation details.

2. libs are internal-only and cannot depend on apps

- Code in `libs/` MUST NOT import or depend on any project under `apps/`.
- Apps may depend on `libs/`, but `libs/` must remain app-agnostic so they are reusable across multiple services.

3. apps may depend on libs and packages

- Projects in `apps/` are allowed to depend on `libs/` and `packages/`.
- Keep app-level dependencies explicit and minimal to preserve service isolation and to make testing/mocking easier.

4. No cycles across groups

- Avoid circular dependencies between `apps/`, `libs/`, and `packages/` (e.g., an app -> lib -> app cycle). Use clear layering: packages <- libs <- apps (where arrows point at allowed dependency direction: something may depend on the item to the left).

## Migration and E2E app conventions

- Migration apps
  - A migration app (for example, `resource-migration`) is a first-class app inside `apps/` that contains database migration code and migration runner scripts.
  - The migration app SHOULD depend on its corresponding service app, so migration code can reuse the service's entity definitions and datasource configuration where appropriate.
  - Some services might not require migrations; however, a migration app should still be created as a template in new services to make onboarding and deployment consistent across teams.

- E2E apps
  - An e2e app (for example, `resource-e2e`) belongs under `apps/` and is responsible for end-to-end tests and test harness wiring.
  - The e2e app MUST depend on the service app it tests. It is also allowed (and typically required) to depend on the migration app to prepare database state before tests run.
  - Dependency summary: e2e app -> service app and e2e app -> migration app.

## Enforcement and recommendations

- Enforce rules with Nx project tags + ESLint rules. Use Nx's dependency constraints (enforceModuleBoundaries) and custom ESLint rules to prevent invalid imports.
- During code reviews, check that packages remain free of internal-only imports and that libs do not reference apps.
- When publishing packages, make sure build artifacts do not accidentally bundle internal libs or app code.

## Example mermaid diagram (illustrative)

```mermaid
graph LR
  subgraph packages
    P1[@ecoma-io/common]
    P2[@ecoma-io/dtos]
  end

  subgraph libs
    L1[nestjs-helpers]
    L2[typeorm-utils]
  end

  subgraph apps
    S[resource-service]
    M[resource-migration]
    E[resource-e2e]
  end

  P1 -->|can be used by| S
  P2 --> S
  L1 --> S
  L2 --> S
  M --> S
  E --> S
  E --> M
```
