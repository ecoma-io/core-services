# @ecoma-io/nestjs-exceptions

A NestJS package providing custom exceptions classes with enhanced type safety and structured error responses.

## Features

- **Type-Safe Exceptions**: Generic support for `TDetails` and `TMetaData` to ensure type safety.
- **Structured Responses**: Consistent error response format with message, details, and metadata.
- **NestJS Integration**: Extends `HttpException` for seamless integration with NestJS error handling.
- **Comprehensive Coverage**: Includes common HTTP status exceptions (409 Conflict, 403 Forbidden, 404 Not Found, etc.).

## Installation

```bash
npm install @ecoma-io/nestjs-exceptions
```

or

```bash
pnpm add @ecoma-io/nestjs-exceptions
```

## Usage

Import the exceptions you need:

```typescript
import { ConflictException, ForbiddenException, NotFoundException, UnauthorizedException, UnprocessableEntityException } from '@ecoma-io/nestjs-exceptions';
```

### Basic Usage

Throw an exception with a message:

```typescript
throw new ConflictException('Resource already exists');
```

### With Details and Metadata

```typescript
throw new ForbiddenException('Access denied', { reason: 'Insufficient permissions' }, { userId: 123, timestamp: new Date().toISOString() });
```

### In a Controller

```typescript
import { Controller, Get } from '@nestjs/common';
import { ConflictException } from '@ecoma-io/nestjs-exceptions';

@Controller('resources')
export class ResourceController {
  @Get()
  async getResource() {
    // Some logic
    if (conflictCondition) {
      throw new ConflictException('Resource conflict');
    }
    return { data: 'resource' };
  }
}
```

## API Reference

### Base Classes

- **`HttpException<TDetails, TMetaData>`**: Base class for HTTP exceptions.
- **`IntrinsicException`**: Base class extending `Error` with consistent naming.

### Exception Classes

All exceptions extend `HttpException` and accept:

- `message: string` (required)
- `details?: TDetails`
- `metadata?: TMetaData`
- `cause?: unknown`

| Exception                      | HTTP Status | Description             |
| ------------------------------ | ----------- | ----------------------- |
| `ConflictException`            | 409         | Resource conflict       |
| `ForbiddenException`           | 403         | Access forbidden        |
| `NotFoundException`            | 404         | Resource not found      |
| `UnauthorizedException`        | 401         | Authentication required |
| `UnprocessableEntityException` | 422         | Validation failed       |

### Response Structure

Exceptions return a structured response:

```typescript
{
  message: string;
  details?: TDetails;
  metadata?: TMetaData;
}
```

### Package exports

The exceptions package re-exports concrete exception classes from `src/lib/exceptions/index.ts`. The exact barrel file contents:

```ts
export * from './conflict.exception';
export * from './forbidden.exception';
export * from './http.exception';
export * from './intrinsic.exception';
export * from './not-found.exception';
export * from './unauthorized.exception';
export * from './unprocessable-entity.exception';
```

Import directly from the package root to access these classes:

```ts
import { NotFoundException, ConflictException } from '@ecoma-io/nestjs-exceptions';
```

## Error Handling

Use NestJS global exception filters or handle in interceptors:

```typescript
// Example (aligns with repository convention)
import { HttpAdapterHost } from '@nestjs/core';
import { GlobalExceptionsFilter } from '@ecoma-io/nestjs-filters';

// In main.ts
// const app = await NestFactory.create(AppModule);
// const httpAdapterHost = app.get(HttpAdapterHost);
// app.useGlobalFilters(new GlobalExceptionsFilter(httpAdapterHost));
```

## Contributing

This package is part of the Ecoma Microservices monorepo. Follow the workspace conventions for contributions.

## License

MIT
