import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// Removed RabbitMQInfraModule in favor of direct Golevelup module import for AmqpConnection visibility
import { RabbitMQModule as GolevelupRabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { ReadModelModule } from '@ecoma-io/iam-infrastructure';
import {
  TenantProjector,
  RabbitMqAdapter,
  CheckpointRepositoryImpl,
  UpcasterRegistryImpl,
  ProjectionCheckpointEntity,
} from '@ecoma-io/iam-worker-infrastructure';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { EventConsumer } from './event.consumer';
import { AppConfigService } from './app.config-service';

@Module({
  imports: [
    // Synchronous config instantiation to avoid DI timing issues in worker bootstrap
    (() => {
      const cfg = new AppConfigService();
      const db = cfg.getDatabaseConfig();
      return TypeOrmModule.forRoot({
        type: 'postgres',
        host: db.host,
        port: db.port,
        username: db.username,
        password: db.password,
        database: db.database,
        autoLoadEntities: true,
        // In tests, enable synchronize to create tenants_read_model and checkpoint table
        synchronize: process.env['NODE_ENV'] === 'test',
        logging: process.env['NODE_ENV'] === 'development',
        // Register checkpoint entity for auto sync
        entities: [ProjectionCheckpointEntity],
      });
    })(),
    (() => {
      const cfg = new AppConfigService();
      const mq = cfg.getRabbitMQConfig();
      return GolevelupRabbitMQModule.forRoot({
        uri: mq.uri,
        exchanges: [
          {
            name: mq.exchange,
            type: mq.exchangeType || 'topic',
            options: { durable: true },
          },
        ],
        prefetchCount: 10,
        connectionInitOptions: { wait: true, timeout: 10000, reject: true },
      });
    })(),
    ReadModelModule.forRoot(),
  ],
  controllers: [],
  providers: [
    // Adapter + utilities for BaseProjector
    AppConfigService,
    {
      provide: RabbitMqAdapter,
      useFactory: (amqp: AmqpConnection) =>
        new RabbitMqAdapter(amqp, {
          queue: process.env.RABBITMQ_QUEUE || 'iam.projector.worker',
          exchange: process.env.RABBITMQ_EXCHANGE || 'iam.events',
          routingKey: 'iam.events.*',
        }),
      inject: [AmqpConnection],
    },
    CheckpointRepositoryImpl,
    UpcasterRegistryImpl,
    TenantProjector,
    EventConsumer,
    // Bootstrapper to start projector on init
    {
      provide: 'APP_BOOTSTRAP',
      useFactory: (projector: TenantProjector) => {
        return {
          async onModuleInit() {
            await projector.start();
          },
        } as OnModuleInit;
      },
      inject: [TenantProjector],
    },
  ],
})
export class AppModule {}
