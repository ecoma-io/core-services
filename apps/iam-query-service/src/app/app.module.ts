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
  GetRoleHandler,
  GetMembershipHandler,
  GetServiceDefinitionHandler,
} from '@ecoma-io/iam-query-interactor';
import { TenantsController } from './controllers/tenants.controller';
import { UsersController } from './controllers/users.controller';
import { RolesController } from './controllers/roles.controller';
import { MembershipsController } from './controllers/memberships.controller';
import { ServiceDefinitionsController } from './controllers/service-definitions.controller';

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
  controllers: [
    TenantsController,
    UsersController,
    RolesController,
    MembershipsController,
    ServiceDefinitionsController,
  ],
  providers: [
    // Read model repositories
    TenantReadRepository,
    UserReadRepository,
    RoleReadRepository,
    MembershipReadRepository,
    ServiceDefinitionReadRepository,
    // Query handlers with proper DI
    {
      provide: GetTenantHandler,
      useFactory: (repo: TenantReadRepository) => new GetTenantHandler(repo),
      inject: [TenantReadRepository],
    },
    {
      provide: GetUserHandler,
      useFactory: (repo: UserReadRepository) => new GetUserHandler(repo as any),
      inject: [UserReadRepository],
    },
    {
      provide: GetRoleHandler,
      useFactory: (repo: RoleReadRepository) => new GetRoleHandler(repo),
      inject: [RoleReadRepository],
    },
    {
      provide: GetMembershipHandler,
      useFactory: (repo: MembershipReadRepository) =>
        new GetMembershipHandler(repo),
      inject: [MembershipReadRepository],
    },
    {
      provide: GetServiceDefinitionHandler,
      useFactory: (repo: ServiceDefinitionReadRepository) =>
        new GetServiceDefinitionHandler(repo),
      inject: [ServiceDefinitionReadRepository],
    },
  ],
})
export class AppModule {}
