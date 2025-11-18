import { Module } from '@nestjs/common';
import { HealthModule } from '@ecoma-io/iam-infrastructure';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from './app.config-service';
import {
  TenantEntity,
  UserEntity,
  RoleEntity,
  MembershipEntity,
  ServiceDefinitionEntity,
  TenantReadRepository,
  UserReadRepository,
  RoleReadRepository,
  MembershipReadRepository,
  ServiceDefinitionReadRepository,
} from '@ecoma-io/iam-infrastructure';
import {
  GetTenantHandler,
  GetUserHandler,
} from '@ecoma-io/iam-query-interactor';
import { TenantsController } from './controllers/tenants.controller';

/**
 * IAM Query Service - Read Side (CQRS)
 *
 * Handles queries that read state from read models:
 * - Reads from PostgreSQL read models
 * - Exposes REST API for querying
 *
 * @see docs/iam/architecture.md - Section 4.2 Read Side Flow
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
      entities: [
        TenantEntity,
        UserEntity,
        RoleEntity,
        MembershipEntity,
        ServiceDefinitionEntity,
      ],
      // In tests, enable synchronize to create read model tables
      synchronize: process.env['NODE_ENV'] === 'test',
      logging: process.env['NODE_ENV'] === 'development',
    }),
    TypeOrmModule.forFeature([
      TenantEntity,
      UserEntity,
      RoleEntity,
      MembershipEntity,
      ServiceDefinitionEntity,
    ]),
    HealthModule,
  ],
  controllers: [TenantsController],
  providers: [
    // Read model repositories
    TenantReadRepository,
    UserReadRepository,
    RoleReadRepository,
    MembershipReadRepository,
    ServiceDefinitionReadRepository,
    // Query handlers
    GetTenantHandler,
    GetUserHandler,
  ],
})
export class AppModule {}
