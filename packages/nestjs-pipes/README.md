# NestJS Pipes

A shared library providing custom pipes for NestJS microservices within the Ecoma ecosystem.

## Overview

This library provides standardized validation pipes for NestJS applications, including:

- **Global Validation Pipe**: Extends NestJS's ValidationPipe with predefined options for consistent validation behavior across services
- **Custom Error Handling**: Transforms validation errors into structured, frontend-friendly responses
- **Security Features**: Whitelisting, type transformation, and implicit conversion enabled by default

## Features

- Standardized validation error responses (422 Unprocessable Entity)
- Automatic type conversion and whitelisting
- Flattened error messages for better frontend consumption
- Integration with Ecoma custom exceptions
- Lightweight and dependency-free (relies on NestJS, class-validator, and common exceptions)

## Installation

This is an internal library in the Ecoma monorepo. Import it using the path alias:

```typescript
import { GlobalValidationPipe } from '@ecoma-io/nestjs-pipes';
```

## Usage

### Basic Setup

In your main application file (e.g., `main.ts`), register the global validation pipe:

```typescript
import { NestFactory } from '@nestjs/core';
import { GlobalValidationPipe } from '@ecoma-io/nestjs-pipes';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Register the global validation pipe
  app.useGlobalPipes(new GlobalValidationPipe());

  await app.listen(3000);
}
bootstrap();
```

### Custom Options

You can override default options by passing additional `ValidationPipeOptions`:

```typescript
app.useGlobalPipes(
  new GlobalValidationPipe({
    transform: false, // Disable transformation if needed
    whitelist: false, // Disable whitelisting if needed
  })
);
```

### Validation DTO Example

Create a DTO with class-validator decorators:

```typescript
import { IsString, IsNumber, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsNumber()
  @Min(18)
  age: number;
}
```

Use it in your controller:

```typescript
@Post('users')
createUser(@Body() createUserDto: CreateUserDto) {
  // DTO is automatically validated and transformed
  return this.userService.create(createUserDto);
}
```

## Error Response Format

Validation failures return a 422 Unprocessable Entity response with flattened errors:

```json
{
  "message": "Validation Failed",
  "validationPayload": {
    "username": "username must be longer than 3 characters",
    "age": "age must not be less than 18"
  }
}
```

## API Reference

### GlobalValidationPipe

Extends NestJS's `ValidationPipe` with predefined options.

#### Constructor

```typescript
constructor(options?: ValidationPipeOptions)
```

**Parameters:**

- `options` (optional): Additional `ValidationPipeOptions` to merge with defaults

### Default Configuration

The pipe is configured with:

- `transform: true` - Enables automatic type conversion
- `whitelist: true` - Strips unknown properties
- `errorHttpStatusCode: 422` - Uses 422 for validation errors
- Custom `exceptionFactory` - Generates structured error responses

## Dependencies

- `@nestjs/common`
- `class-validator`
- `@ecoma-io/nestjs-exceptions` (for custom exceptions)

## Building

Run `npx nx build nestjs-pipes` to build the library.

## Running unit tests

Run `npx nx test nestjs-pipes` to execute the unit tests via [Jest](https://jestjs.io).
