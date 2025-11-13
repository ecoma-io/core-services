# NestJS AWS S3 Module

A NestJS module for integrating AWS S3 clients with automatic connection validation, lifecycle management, and dependency injection support.

## Description

This library provides a comprehensive NestJS module for AWS S3 operations. It supports:

- Synchronous and asynchronous configuration
- Automatic S3 client lifecycle management
- Connection validation with retry logic
- Multiple S3 clients with custom names
- Dependency injection decorators
- TypeScript support

## Installation

This is an internal library. No installation required - simply import from `@libs/nestjs-aws-s3`.

## Usage

### Synchronous Configuration (forRoot)

```typescript
import { Module } from '@nestjs/common';
import { S3Module } from '@libs/nestjs-aws-s3';

@Module({
  imports: [
    S3Module.forRoot({
      name: 'default', // optional, defaults to 'default'
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'your-access-key',
        secretAccessKey: 'your-secret-key',
      },
      connectionValidationOptions: {
        retries: 3,
        retryDelay: 1000,
      },
      logger: customLogger, // optional
    }),
  ],
})
export class AppModule {}
```

### Asynchronous Configuration (forRootAsync)

#### Using useFactory

```typescript
import { Module } from '@nestjs/common';
import { S3Module } from '@libs/nestjs-aws-s3';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    S3Module.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        region: configService.get('AWS_REGION'),
        credentials: {
          accessKeyId: configService.get('AWS_ACCESS_KEY_ID'),
          secretAccessKey: configService.get('AWS_SECRET_ACCESS_KEY'),
        },
      }),
      inject: [ConfigService],
      name: 'async-client',
      connectionValidationOptions: {
        retries: 5,
        retryDelay: 2000,
      },
    }),
  ],
})
export class AppModule {}
```

#### Using useClass

```typescript
import { Module } from '@nestjs/common';
import { S3Module, S3OptionsFactory } from '@libs/nestjs-aws-s3';

class S3ConfigService implements S3OptionsFactory {
  createS3Options() {
    return {
      region: 'us-west-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    };
  }
}

@Module({
  imports: [
    S3Module.forRootAsync({
      useClass: S3ConfigService,
    }),
  ],
})
export class AppModule {}
```

#### Using useExisting

```typescript
import { Module } from '@nestjs/common';
import { S3Module, S3OptionsFactory } from '@libs/nestjs-aws-s3';

@Injectable()
class ExistingConfigService implements S3OptionsFactory {
  createS3Options() {
    return {
      region: 'eu-west-1',
      credentials: {
        accessKeyId: 'existing-key',
        secretAccessKey: 'existing-secret',
      },
    };
  }
}

@Module({
  imports: [
    S3Module.forRootAsync({
      useExisting: ExistingConfigService,
    }),
  ],
  providers: [ExistingConfigService],
})
export class AppModule {}
```

### Injecting S3 Clients

#### Inject Single Client

```typescript
import { Injectable } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { S3Client as S3ClientDecorator } from '@libs/nestjs-aws-s3';

@Injectable()
export class S3Service {
  constructor(
    @S3ClientDecorator() private readonly s3Client: S3Client, // default client
    @S3ClientDecorator('custom-client') private readonly customS3Client: S3Client
  ) {}

  async uploadFile(bucket: string, key: string, body: Buffer) {
    await this.s3Client.putObject({
      Bucket: bucket,
      Key: key,
      Body: body,
    });
  }
}
```

#### Inject All Clients

```typescript
import { Injectable } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { S3Clients } from '@libs/nestjs-aws-s3';

@Injectable()
export class MultiS3Service {
  constructor(@S3Clients() private readonly allClients: Map<string, S3Client>) {}

  getClient(name: string): S3Client | undefined {
    return this.allClients.get(name);
  }
}
```

### Decorators

- `@S3Client(name?: string)` - Inject a specific S3 client
- `@S3Clients()` - Inject the map of all registered S3 clients

## Configuration Options

### S3ModuleOptions

Extends `S3ClientConfig` from `@aws-sdk/client-s3` with additional options:

- `name?: string` - Client name (default: 'default')
- `connectionValidationOptions?: ConnectionValidationOptions` - Validation settings
- `logger?: LoggerService` - Custom logger

### ConnectionValidationOptions

- `retries?: number` - Number of retry attempts (default: 5)
- `retryDelay?: number` - Initial delay between retries in ms (default: 1000)

### S3ModuleAsyncOptions

For asynchronous configuration:

- `useFactory?: (...args) => S3ClientConfig | Promise<S3ClientConfig>`
- `useClass?: Type<S3OptionsFactory>`
- `useExisting?: any`
- `inject?: any[]`
- Plus all options from `S3ModuleOptions`

## Examples

### Multiple S3 Clients

```typescript
@Module({
  imports: [
    S3Module.forRoot({
      region: 'us-east-1',
      name: 'us-client',
    }),
    S3Module.forRoot({
      region: 'eu-west-1',
      name: 'eu-client',
    }),
  ],
})
export class AppModule {}

@Injectable()
export class S3Service {
  constructor(
    @InjectS3Client('us-client') private readonly usClient: S3Client,
    @InjectS3Client('eu-client') private readonly euClient: S3Client
  ) {}
}
```

### Custom Logger

```typescript
import { Logger } from '@nestjs/common';

const customLogger = new Logger('S3Module');

S3Module.forRoot({
  region: 'us-east-1',
  logger: customLogger,
});
```

## Global Module Behavior

**Important:** S3Module is registered as a **global module**. This means:

- Once you import `S3Module.forRoot()` or `S3Module.forRootAsync()` in your root module (e.g., `AppModule`), all S3 client providers become globally available.
- Other feature modules (e.g., `HealthModule`, `UserModule`) can inject S3 clients using the `@S3Client()` decorator **without explicitly importing S3Module**.

### Example: Using S3 Client in a Feature Module

```typescript
// app.module.ts
@Module({
  imports: [
    S3Module.forRootAsync({
      useFactory: (configService: ConfigService) => configService.get('s3'),
      inject: [ConfigService],
    }),
    HealthModule, // HealthModule can inject S3 client without importing S3Module
  ],
})
export class AppModule {}

// health/health.module.ts
@Module({
  controllers: [HealthController],
  providers: [HealthService],
  // No need to import S3Module here!
})
export class HealthModule {}

// health/health.service.ts
@Injectable()
export class HealthService {
  constructor(
    @S3Client() private readonly s3: S3Client // Works because S3Module is global
  ) {}

  async checkS3Health() {
    await this.s3.send(new ListBucketsCommand());
    return 'S3 is healthy';
  }
}
```

## API Reference

### S3Module

- `forRoot(options: S3ModuleOptions): DynamicModule`
- `forRootAsync(options: S3ModuleAsyncOptions): DynamicModule`

### Decorators

- `S3Client(name?: string)`
- `S3Clients()`

### Interfaces

- `S3ModuleOptions`
- `S3ModuleAsyncOptions`
- `S3OptionsFactory`
- `ConnectionValidationOptions`

## Building

Run `npx nx build nestjs-aws-s3` to build the library.

## Running unit tests

Run `npx nx test nestjs-aws-s3` to execute the unit tests via [Jest](https://jestjs.io).
