import { DynamicModule, Module, Provider } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PermissionCacheRepository } from './permission-cache.repository';

export interface RedisCacheModuleOptions {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

/**
 * Permission Cache Module for Redis integration.
 *
 * Provides:
 * - User permissions cache
 * - Combined permissions tree cache
 * - Projection checkpoints for RYOW
 *
 * @see ADR-3: Read-Your-Own-Writes Mechanism
 */
@Module({})
export class PermissionCacheModule {
  static forRoot(options: RedisCacheModuleOptions): DynamicModule {
    const redisProvider: Provider = {
      provide: Redis,
      useFactory: () => {
        return new Redis({
          host: options.host,
          port: options.port,
          password: options.password,
          db: options.db ?? 0,
        });
      },
    };

    return {
      module: PermissionCacheModule,
      providers: [redisProvider, PermissionCacheRepository],
      exports: [PermissionCacheRepository],
    };
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: unknown[]
    ) => RedisCacheModuleOptions | Promise<RedisCacheModuleOptions>;
    inject?: unknown[];
  }): DynamicModule {
    const redisProvider: Provider = {
      provide: Redis,
      useFactory: async (...args: unknown[]) => {
        const config = await options.useFactory(...args);
        return new Redis({
          host: config.host,
          port: config.port,
          password: config.password,
          db: config.db ?? 0,
        });
      },
      inject: options.inject,
    };

    return {
      module: PermissionCacheModule,
      providers: [redisProvider, PermissionCacheRepository],
      exports: [PermissionCacheRepository],
    };
  }
}
