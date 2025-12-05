# Ecoma Core Services

A monorepo Ecoma core services, built with Nx/NestJS. This repository contains shared libraries, publishable packages, and microservices with robust development workflows.

## Features

- **Nx Monorepo**: Efficient workspace management with shared libraries and packages
- **NestJS Microservices**: Scalable backend services with TypeScript
- **Shared Libraries**: Internal utilities and domain logic
- **Publishable Packages**: Reusable DTOs and types for frontend integration
- **Docker Support**: Containerized deployment with custom build targets
- **Testing**: Support unit with Jest
- **Comprehensive**: Comprehensive E2E testing with Jest and Testcontainers (Include chaos e2e testing)
- **CI/CD**: Automated linting, testing, and publishing workflows
- **Observability**: Structured logging (Pino), distributed tracing (OpenTelemetry), and metrics (Prometheus)

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
- **Observability**: Pino (structured logging), OpenTelemetry (tracing), Prometheus (metrics)

## Project Structure

```
├── apps/                 # NestJS microservices
├── docs/                 # Documentation
├── e2e/                  # The e2e projects
├── infras/               # Development infrastructure
├── libs/                 # Internal shared libraries
├── packages/             # Publishable npm packages for share other Ecoma's project
└── tools/                # Custom scripts, local eslint rules ...
```

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Architecture](./docs/architecture.md)
