import { Module, DynamicModule } from '@nestjs/common';
import { RabbitMQModule as GolevelupRabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { RabbitMQEventPublisher } from '../event-publisher/rabbitmq-event.publisher';

export interface RabbitMQModuleOptions {
  uri: string;
  exchange: string;
  exchangeType?: 'topic' | 'direct' | 'fanout' | 'headers';
  prefetchCount?: number;
  enableControllerDiscovery?: boolean;
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
    return {
      module: RabbitMQInfraModule,
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
      providers: [
        {
          provide: RabbitMQEventPublisher,
          useFactory: (amqpConnection: AmqpConnection) => {
            return new RabbitMQEventPublisher(amqpConnection, {
              exchange: options.exchange,
              exchangeType: options.exchangeType,
            });
          },
          inject: ['AMQP_CONNECTION'],
        },
      ],
      exports: [RabbitMQEventPublisher],
    };
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: unknown[]
    ) => Promise<RabbitMQModuleOptions> | RabbitMQModuleOptions;
    inject?: InjectionToken[];
  }): DynamicModule {
    return {
      module: RabbitMQInfraModule,
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
      providers: [
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
          inject: ['AMQP_CONNECTION', ...(options.inject || [])],
        },
      ],
      exports: [RabbitMQEventPublisher],
    };
  }
}
