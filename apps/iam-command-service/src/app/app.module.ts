import { Module } from '@nestjs/common';
import { CommandsController } from './controllers/commands.controller';
import { HealthModule } from '@ecoma-io/iam-infrastructure';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from './app.config-service';

/**
 * IAM Command Service - Write Side (CQRS)
 *
 * Handles commands that mutate state:
 * - Saves events to EventStoreDB
 * - Publishes events to RabbitMQ
 *
 * @see docs/iam/architecture.md - Section 4.1 Write Side Flow
 *
 * Config pattern: Use @ecoma-io/nestjs-config (BaseConfigService)
 * - Create app.config.ts with class extending BaseConfigService<AppEnv>
 * - Define AppEnv class with class-validator decorators
 * - Instantiate ConfigService in main.ts pre-bootstrap
 * - Inject into modules via providers
 */
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      ...new AppConfigService().getDatabaseConfig(),
      entities: [], // Read models will be added later
      synchronize: false, // Use migrations for schema management
      logging: process.env['NODE_ENV'] === 'development',
    }),
    // TODO: Wire infrastructure modules when ready
    // EventStoreModule.forRootAsync({ ... }),
    // RabbitMQInfraModule.forRootAsync({ ... }),
    HealthModule,
  ],
  controllers: [CommandsController],
  providers: [
    // TODO: Add ConfigService provider
  ],
})
export class AppModule {}
