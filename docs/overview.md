# Overview — Project summary

This repository is an Nx monorepo that hosts a set of NestJS microservices, shared libraries, and publishable packages used by Ecoma's core services. The goal is to provide a well-structured workspace for building, testing, and publishing backend services with strong reuse of DTOs and shared utilities.

This document gives a short, practical overview. For deeper guides see the other docs in this folder

## Workspace layout

- `apps/`: NestJS applications and microservices.
- `apps/`: E2E testing applications.
- `libs/`: Internal libraries used by apps (utilities, integration helpers, TypeORM helpers, etc.).
- `packages/`: Publishable packages (DTOs, shared config, exceptions, pipes, filters) consumed across repos or by frontend.
- `tools/`: Internal development tools.
- `infras/`: Internal development infrastructure applications (e.g., MongoDB, Postgres, Redis, RabbitMQ, Maildev, MinIO).

Path aliases are configured in `tsconfig.base.json` and used throughout. Prefer imports like `@ecoma-io/<package>` instead of long relative paths.

## Conventions you must follow

- Use path aliases from `tsconfig.base.json` for cross-project imports (`@ecoma-io/*`).
- Use the shared exception helpers exported by the repository (see `packages/nestjs-exceptions/`) rather than Nest built-ins directly.
- Avoid `console.log` in code.

## Developer quick-start

Run these from the repository root. The workspace uses `pnpm` in CI, but `npm`/`yarn` can be used if preferred and configured.

```bash
pnpm install

# Run unit tests for a project
npx nx test <project>

# Serve a project locally (watch mode)
npx nx serve <project>

# Build a project for production
npx nx build <project>

# Run e2e tests (many e2e projects use Testcontainers)
npx nx e2e <project>-e2e

# Build Docker image for a project
npx nx docker:build <project>
```

## CI/CD

The repository uses a three-stage GitHub Actions workflow strategy:

### Integration Workflow (`integration.yaml`)

Runs on pushes and PRs to `main` and `dev` branches:

- **Compute affected projects**: Uses Nx to identify changed projects (compares against `origin/main` for branches, latest tag for `main`)
- **Integration checks**: Runs lint, test, build, and e2e in parallel via matrix for all affected projects
- **Release**: Automatically creates releases on `main` using `release-please-action` (generates changelog and version bumps)
- **Report**: Reports CI status back to GitHub for PR checks

### Delivery Workflow (`delivery.yaml`)

Triggers on semver tags (e.g., `v1.2.3`):

- Authenticates with GitHub Container Registry (GHCR)
- Publishes npm packages and Docker images via `npx nx run-many -t publish`
- Uses `GITHUB_TOKEN` for GHCR and `NPM_TOKEN` for npm registry

### Analysis Workflow (`analysis.yaml`)

Runs CodeQL security analysis on `main` branch (PRs, pushes, and daily schedule) to detect vulnerabilities in JavaScript code.

**Key features**:

- Smart affected project detection with Nx
- Parallel execution via GitHub matrix strategy
- Automated releases with conventional commits
- Reusable `setup-project` action (pnpm, Node.js 22, Docker Buildx)

## Testing & E2E

- Unit tests: Jest. Run `npx nx test <project>`.
- E2E tests commonly use Testcontainers.

## Developer rules & style

- Follow ESLint rules and path alias constraints.
- Commits should use Conventional Commits and Nx scopes.
