# NestJS Health Check

A shared library for implementing health checks in NestJS microservices within the Ecoma ecosystem.

## Overview

This library provides a standardized way to implement health checks in NestJS applications. It includes:

- **Liveness Probe**: Lightweight endpoint to check if the application is running
- **Readiness Probe**: Comprehensive endpoint that checks application dependencies (database, external services, etc.)
- **Dynamic Module**: Flexible registration system allowing custom health check implementations

## Features

- Standardized health check endpoints (`/health/liveness` and `/health/readiness`)
- Abstract service pattern for custom health check implementations
- Integration with Ecoma common types and exceptions
- Lightweight and dependency-free (relies on NestJS and common types)

## Installation

This is an internal library in the Ecoma monorepo. Import it using the path alias:

```typescript
import { HealthCheckModule } from '@ecoma-io/nestjs-health';
```

## Usage

### 1. Implement a Health Check Service

Create a concrete implementation of the `HealthCheckService`:

```typescript
import { Injectable } from '@nestjs/common';
import { HealthCheckService as BaseHealthCheckService } from '@ecoma-io/nestjs-health';
import { SuccessResponse, HealthDetails } from '@ecoma-io/ecoma-common';

@Injectable()
export class HealthCheckService extends BaseHealthCheckService {
  async check(): Promise<SuccessResponse<HealthDetails>> {
    // Perform your health checks here
    // Check database connection, external services, etc.

    const details: HealthDetails = {
      database: 'healthy',
      redis: 'healthy',
      // Add more checks as needed
    };

    return {
      message: 'Service is ready',
      data: details,
    };
  }
}
```

### 2. Register the Module

In your application module, register the health check module with your implementation:

```typescript
import { Module } from '@nestjs/common';
import { HealthCheckModule } from '@ecoma-io/nestjs-health';
import { HealthCheckService } from './health-check.service';

@Module({
  imports: [
    HealthCheckModule.register(HealthCheckService),
    // ... other modules
  ],
  providers: [HealthCheckService],
})
export class AppModule {}
```

### 3. Health Check Endpoints

Once registered, the following endpoints will be available:

#### Liveness Probe

```
GET /health/liveness
```

Returns a simple success response indicating the service is running.

**Response:**

```json
{
  "message": "Service still alive"
}
```

#### Readiness Probe

```
GET /health/readiness
```

Performs comprehensive health checks via your custom service implementation.

**Response:**

```json
{
  "message": "Service is ready",
  "data": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```

## API Reference

### HealthCheckModule

#### `register(implementation: Type<HealthCheckService>): DynamicModule`

Registers the health check module with a concrete service implementation.

**Parameters:**

- `implementation`: A class that extends `HealthCheckService`

**Returns:** A configured NestJS dynamic module

### HealthCheckService (Abstract)

#### `check(): Promise<SuccessResponse<HealthDetails>>`

Abstract method that must be implemented to perform readiness checks.

**Returns:** Promise resolving to health check results

### HealthCheckController

Provides the `/health/liveness` and `/health/readiness` endpoints.

## Dependencies

- `@nestjs/common`
- `@ecoma-io/ecoma-common` (for types)

## Building

Run `npx nx build nestjs-health` to build the library.

## Running unit tests

Run `npx nx test nestjs-health` to execute the unit tests via [Jest](https://jestjs.io).
