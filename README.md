# Ecoma Core Services

A monorepo of NestJS microservices for Ecoma, built with Nx. This repository contains shared libraries, publishable packages, and microservices with robust development workflows.

## Features

- **Nx Monorepo**: Efficient workspace management with shared libraries and packages
- **NestJS Microservices**: Scalable backend services with TypeScript
- **Shared Libraries**: Internal utilities and domain logic
- **Publishable Packages**: Reusable DTOs and types for frontend integration
- **Docker Support**: Containerized deployment with custom build targets
- **Testing**: Comprehensive unit and E2E testing with Jest and Testcontainers
- **CI/CD**: Automated linting, testing, and publishing workflows

## Tech Stack

- **Framework**: NestJS with Node.js
- **Language**: TypeScript
- **Build Tool**: Nx
- **Database**: TypeORM with PostgreSQL
- **Cache & Session**: Redis
- **Document Store**: MongoDB
- **Search Engine**: Elasticsearch
- **Message Broker**: RabbitMQ
- **Event Store**: Event Store DB
- **Testing**: Jest, Testcontainers
- **Linting**: ESLint with custom monorepo rules
- **Containerization**: Docker
- **Package Manager**: pnpm

## Project Structure

```
├── apps/                 # NestJS microservices (resource-service, etc.)
├── libs/                 # Internal shared libraries
├── packages/             # Publishable npm packages (DTOs, common types)
├── tools/                # Custom scripts and executors
├── infras/               # Development infrastructure (Docker Compose)
├── docs/                 # Documentation
└── scripts/              # Utility scripts
```

## Quick Start

### Prerequisites

- Node.js (v18+)
- pnpm
- Docker & Docker Compose
- VS Code with Dev Containers extension (recommended)

### Development Setup

1. **Clone and open in devcontainer**:
   - Install [Dev Containers](vscode:extension/ms-vscode-remote.remote-containers) extension
   - Use `Dev Containers: Clone Repository in Container Volume...` in VS Code
   - Select branch (usually `dev`)

2. **Install dependencies** (if not using devcontainer):

   ```bash
   pnpm install
   ```

3. **Start development infrastructure**:

   ```bash
   docker-compose -f infras/infras-core/compose.yaml up -d
   ```

4. **Run a service**:
   ```bash
   npx nx serve resource-service
   ```

## Common Commands

```bash
# Development
npx nx serve <service-name>          # Start service in watch mode
npx nx build <service-name>          # Build service
npx nx test <service-name>           # Run unit tests
npx nx e2e <service-name>-e2e        # Run E2E tests

# Multi-project
npx nx run-many --target=test --all  # Test all projects
npx nx affected:test                 # Test only affected projects
npx nx dep-graph                     # Visualize dependencies

# Docker
npx nx docker:build <service-name>   # Build Docker image
npx nx docker:run <service-name>     # Run service in container

# Publishing
npx nx publish <package-name>        # Publish package to npm
```

## Development Guidelines

### Path Aliases

Use `@ecoma-io/*` imports instead of relative paths:

```typescript
import { GlobalExceptionsFilter } from '@ecoma-io/nestjs-service';
import { ErrorResponse } from '@ecoma-io/common';
```

### Exceptions

Use custom exceptions from shared libraries, not NestJS built-ins:

```typescript
import { BadRequestException } from '@ecoma-io/nestjs-exceptions';
```

### Configuration

Services use `ConfigModule.forRoot({ skipProcessEnv: true })` and validate with `validateConfig()` utilities.

### TypeORM

Services use `TypeOrmModule.forRootAsync({ autoLoadEntities: true })` and include a `datasource.ts` for migrations.

## Contributing

1. Follow Conventional Commits for commit messages
2. Use Nx targets for build/test operations
3. Run `npx nx affected -t lint test build e2e --staged` before pushing
4. Ensure all tests pass and code is linted

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Architecture](./docs/architecture.md)
- [API Documentation](./docs/overview.md)

## License

[Add license information here]

## Support

For questions or issues, please create an issue in this repository or contact the development team.
