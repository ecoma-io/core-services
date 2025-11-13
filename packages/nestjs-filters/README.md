# @ecoma-io/nestjs-filters

A NestJS package providing a global exception filter for consistent error handling and response formatting across your application.

## Description

This package includes the `GlobalExceptionsFilter`, a catch-all filter that intercepts all exceptions thrown in your NestJS application. It standardizes error responses, logs exceptions for debugging, and ensures a uniform API error format using the `ErrorResponse` interface from `@ecoma-io/common`.

Key features:

- Catches all types of exceptions (NestJS built-in, custom, and unhandled errors).
- Formats responses consistently.
- Logs errors for monitoring.
- Integrates seamlessly with NestJS applications.

## Installation

Install the package via npm or yarn:

```bash
npm install @ecoma-io/nestjs-filters
```

Or using yarn:

```bash
yarn add @ecoma-io/nestjs-filters
```

Ensure you have the required peer dependencies:

- `@nestjs/common` (^11.0.0)
- `@nestjs/core` (^11.0.0)
- `@ecoma-io/common` (0.0.0)
- `@ecoma-io/nestjs-exceptions` (0.0.0)

## Usage

### Importing and Registering the Filter

In your `main.ts` or app module:

```typescript
import { NestFactory } from '@nestjs/core';
import { HttpAdapterHost } from '@nestjs/core';
import { GlobalExceptionsFilter } from '@ecoma-io/nestjs-filters';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get the HttpAdapterHost instance
  const httpAdapterHost = app.get(HttpAdapterHost);

  // Register the global exception filter
  app.useGlobalFilters(new GlobalExceptionsFilter(httpAdapterHost));

  await app.listen(3000);
}
bootstrap();
```

### How It Works

- **NestJS Exceptions**: For standard NestJS exceptions (e.g., `BadRequestException`), it returns the exception's status and message.
- **Custom Exceptions**: For exceptions extending `HttpException` from `@ecoma-io/nestjs-exceptions`, it uses the custom response if provided.
- **Unhandled Errors**: For any other errors, it defaults to a 500 Internal Server Error with a generic message.

Example response format:

```json
{
  "message": "Error description"
}
```

Or for custom exceptions:

```json
{
  "productId": 123,
  "message": "Product out of stock"
}
```

## API

### GlobalExceptionsFilter

A class implementing `ExceptionFilter` from `@nestjs/common`.

#### Constructor

```typescript
constructor(private readonly httpAdapterHost: HttpAdapterHost)
```

- `httpAdapterHost`: Instance of `HttpAdapterHost` to access the underlying HTTP adapter.

#### Methods

- `catch(exception: unknown, host: ArgumentsHost): void`
  - Handles the caught exception.
  - Logs the exception.
  - Sends a formatted response to the client.

## Building

Run `npx nx build nestjs-filters` to build the library.

## Running unit tests

Run `npx nx test nestjs-filters` to execute the unit tests via [Jest](https://jestjs.io).

## Troubleshooting

- **Dependency Issues**: Ensure all peer dependencies are installed and compatible versions are used.
- **Filter Not Working**: Verify that the filter is registered in `main.ts` and `HttpAdapterHost` is injected correctly.
- **Custom Exceptions Not Formatting**: Check that your custom exceptions extend `HttpException` from `@ecoma-io/nestjs-exceptions` and implement `getStatus()` and `getResponse()`.
- **Logs Not Appearing**: Ensure your NestJS logger is configured properly (e.g., not set to silent mode).

For more help, refer to the [NestJS documentation](https://docs.nestjs.com/exception-filters) on exception filters.
