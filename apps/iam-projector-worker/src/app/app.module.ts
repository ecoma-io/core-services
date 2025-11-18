import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateConfig } from '@ecoma-io/nestjs-config';
import { RabbitMQInfraModule } from '@ecoma-io/iam-infrastructure';
import { ReadModelModule } from '@ecoma-io/iam-infrastructure';
import { TenantProjector } from '@ecoma-io/iam-worker-infrastructure';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateConfig }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: false,
      logging: process.env['NODE_ENV'] === 'development',
    }),
    RabbitMQInfraModule.forRoot({
      uri: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
      exchange: 'iam.events',
      exchangeType: 'topic',
      prefetchCount: 10,
    }),
    ReadModelModule.forRoot(),
  ],
  controllers: [],
  providers: [TenantProjector],
})
export class AppModule {}
