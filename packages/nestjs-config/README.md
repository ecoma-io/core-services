# nestjs-config

A lightweight, pre-bootstrapping configuration library for NestJS applications that provides environment variable validation and expansion without requiring NestJS modules.

## Purpose

This library was created to replace `@nestjs/config` for scenarios requiring early configuration loading (pre-bootstrapping). Since `@nestjs/config` is a NestJS module, it cannot be used before the NestJS application bootstraps, which can cause issues with logging configuration or other critical setup that needs to happen early.

## Features

- **Pre-bootstrapping**: Load and validate configuration before NestJS application starts
- **Environment Expansion**: Support for `${VAR}` and `${VAR:-default}` syntax with cross-references
- **Type Safety**: Full TypeScript support with class-validator decorators
- **Singleton Pattern**: Configuration is loaded once per application lifecycle
- **Case-insensitive**: Flexible environment variable name matching

## Installation

This is an internal library in the Nx monorepo. No separate installation required.

## Usage

### Basic Configuration Class

```typescript
import { IsString, IsNumber, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class AppConfig {
  @IsString()
  NODE_ENV!: string;

  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  PORT!: number;

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  DEBUG!: boolean;

  @IsString()
  DATABASE_URL!: string;
}
```

### Creating a Configuration Service

```typescript
import { BaseConfigService } from '@ecoma-io/nestjs-config';

export class ConfigService extends BaseConfigService<AppConfig> {
  constructor() {
    super(AppConfig);
  }

  get nodeEnv(): string {
    return this.environments.NODE_ENV;
  }

  get port(): number {
    return this.environments.PORT;
  }

  get isDebug(): boolean {
    return this.environments.DEBUG;
  }

  get databaseUrl(): string {
    return this.environments.DATABASE_URL;
  }
}
```

### Using in Application

```typescript
// main.ts - Pre-bootstrapping usage
import { ConfigService } from './config/config.service';

const config = new ConfigService();

// Use config before NestJS bootstrap
console.log(`Starting ${config.nodeEnv} server on port ${config.port}`);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(config.port);
}
bootstrap();
```

### Environment Variables

Create a `.env` file:

```env
NODE_ENV=development
PORT=3000
DEBUG=true
DATABASE_URL=postgresql://user:pass@localhost:5432/db
```

## API Reference

### BaseConfigService<T>

Abstract base class for configuration services.

#### Constructor

- `constructor(processEnvironmentValidator: ClassConstructor<T>)`: Initializes and validates configuration

**Throws:** `IntrinsicException` if validation fails

#### Properties

- `protected environments: T`: Access to validated configuration object

## Validation helpers (quick reference)

This package provides a `validateConfig` helper and `BaseConfigService` used across the monorepo.

validateConfig (implemented in `src/lib/validate-config.ts`)

```ts
import { IntrinsicException } from '@ecoma-io/nestjs-exceptions';
import { ClassConstructor, plainToClass } from 'class-transformer';
import { validateSync } from 'class-validator';

export function validateConfig<T extends object>(env: Record<string, string>, envVariablesClass: ClassConstructor<T>): T {
  if (!env || typeof env !== 'object') {
    throw new IntrinsicException('Invalid environment variables: must be a non-null object');
  }

  const validatedConfig = plainToClass(envVariablesClass, env, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new IntrinsicException(`Process environment validation failed: \n ${errors.toString()}`);
  }

  return validatedConfig;
}
```

BaseConfigService (implemented in `src/lib/base-config.service.ts`)

```ts
import { ClassConstructor } from 'class-transformer';
import { expandEnv } from '@ecoma-io/expand-env';
import { validateConfig } from './validate-config';

export abstract class BaseConfigService<T extends object> {
  private static environments: unknown;

  constructor(processEnvironmentValidator: ClassConstructor<T>) {
    if (!BaseConfigService.environments) {
      const env = expandEnv(process.env as Record<string, string>);
      BaseConfigService.environments = validateConfig<T>(env, processEnvironmentValidator);
    }
  }

  protected get environments(): T {
    return BaseConfigService.environments as T;
  }
}
```

## Building

Run `npx nx build nestjs-config` to build the library.

## Running unit tests

Run `npx nx test nestjs-config` to execute the unit tests via [Jest](https://jestjs.io).

## Dependencies

- `class-transformer`
- `class-validator`
- `@ecoma-io/nestjs-exceptions`
- `@ecoma-io/expand-env`
