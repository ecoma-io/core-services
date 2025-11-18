import { Module, DynamicModule } from '@nestjs/common';
import { RabbitMQModule as GolevelupRabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { RabbitMQEventPublisher } from '../event-publisher/rabbitmq-event.publisher';
import { DLXSetupService } from './dlx-setup.service';
import { DLXConfig } from './dlx.config';

export interface RabbitMQModuleOptions {
  uri: string;
  exchange: string;
  exchangeType?: 'topic' | 'direct' | 'fanout' | 'headers';
  prefetchCount?: number;
  enableControllerDiscovery?: boolean;
  dlx?: Partial<DLXConfig>; // DLX configuration (Phase 4.4)
}

type InjectionToken =
  | string
  | symbol
  | (new (...args: unknown[]) => unknown)
  | Type<unknown>;
type Type<T = unknown> = new (...args: unknown[]) => T;

/**
 * NestJS module for RabbitMQ integration using @golevelup/nestjs-rabbitmq.
 * Provides EventPublisher implementation and configures the RabbitMQ connection.
 *
 * @example
 * ```typescript
 * RabbitMQInfraModule.forRoot({
 *   uri: 'amqp://localhost:5672',
 *   exchange: 'iam.events',
 *   exchangeType: 'topic',
 * })
 * ```
 */
@Module({})
export class RabbitMQInfraModule {
  static forRoot(options: RabbitMQModuleOptions): DynamicModule {
    const providers = [
      {
        provide: RabbitMQEventPublisher,
        useFactory: (amqpConnection: AmqpConnection) => {
          return new RabbitMQEventPublisher(amqpConnection, {
            exchange: options.exchange,
            exchangeType: options.exchangeType,
          });
        },
        inject: [AmqpConnection],
      },
    ];

    // Add DLX setup if configured
    if (options.dlx) {
      providers.push({
        provide: DLXSetupService,
        useFactory: (amqpConnection: AmqpConnection) => {
          return new DLXSetupService(amqpConnection, {
            mainExchange: options.exchange,
            dlxExchange: options.dlx?.dlxExchange || `${options.exchange}.dlx`,
            mainQueue: options.dlx?.mainQueue || `${options.exchange}.queue`,
            retryQueue: options.dlx?.retryQueue || `${options.exchange}.retry`,
            dlq: options.dlx?.dlq || `${options.exchange}.dlq`,
            ...options.dlx,
          });
        },
        inject: [AmqpConnection],
      } as never);
    }

    return {
      module: RabbitMQInfraModule,
      global: true,
      imports: [
        GolevelupRabbitMQModule.forRoot({
          uri: options.uri,
          exchanges: [
            {
              name: options.exchange,
              type: options.exchangeType || 'topic',
              options: {
                durable: true,
              },
            },
          ],
          prefetchCount: options.prefetchCount || 10,
          enableControllerDiscovery: options.enableControllerDiscovery ?? false,
          connectionInitOptions: {
            wait: true,
            timeout: 10000,
            reject: true,
          },
        }),
      ],
      providers,
      exports: [
        RabbitMQEventPublisher,
        ...(options.dlx ? [DLXSetupService] : []),
      ],
    };
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: unknown[]
    ) => Promise<RabbitMQModuleOptions> | RabbitMQModuleOptions;
    inject?: InjectionToken[];
  }): DynamicModule {
    const providers = [
      {
        provide: RabbitMQEventPublisher,
        useFactory: async (
          amqpConnection: AmqpConnection,
          ...args: unknown[]
        ) => {
          const config = await options.useFactory(...args);
          return new RabbitMQEventPublisher(amqpConnection, {
            exchange: config.exchange,
            exchangeType: config.exchangeType,
          });
        },
        inject: [AmqpConnection, ...(options.inject || [])],
      },
      {
        provide: DLXSetupService,
        useFactory: async (
          amqpConnection: AmqpConnection,
          ...args: unknown[]
        ) => {
          const config = await options.useFactory(...args);
          if (!config.dlx) {
            return null; // No DLX configured
          }
          return new DLXSetupService(amqpConnection, {
            mainExchange: config.exchange,
            dlxExchange: config.dlx?.dlxExchange || `${config.exchange}.dlx`,
            mainQueue: config.dlx?.mainQueue || `${config.exchange}.queue`,
            retryQueue: config.dlx?.retryQueue || `${config.exchange}.retry`,
            dlq: config.dlx?.dlq || `${config.exchange}.dlq`,
            ...config.dlx,
          });
        },
        inject: [AmqpConnection, ...(options.inject || [])],
      },
    ];

    return {
      module: RabbitMQInfraModule,
      global: true,
      imports: [
        GolevelupRabbitMQModule.forRootAsync({
          useFactory: async (...args: unknown[]) => {
            const config = await options.useFactory(...args);
            return {
              uri: config.uri,
              exchanges: [
                {
                  name: config.exchange,
                  type: config.exchangeType || 'topic',
                  options: {
                    durable: true,
                  },
                },
              ],
              prefetchCount: config.prefetchCount || 10,
              enableControllerDiscovery:
                config.enableControllerDiscovery ?? false,
              connectionInitOptions: {
                wait: true,
                timeout: 10000,
                reject: true,
              },
            };
          },
          inject: options.inject || [],
        }),
      ],
      providers,
      exports: [RabbitMQEventPublisher, DLXSetupService],
    };
  }
}
