import { Module } from '@nestjs/common';
import { CommandsController } from './controllers/commands.controller';
import {
  OutboxModule,
  OutboxRepository,
  SnapshotModule,
  SnapshotRepository,
} from '@ecoma-io/iam-infrastructure';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from './app.config-service';
import { EventStoreDBClient } from '@eventstore/db-client';
import { EventStoreDbRepository } from '@ecoma-io/iam-infrastructure';
import { RabbitMQInfraModule } from '@ecoma-io/iam-infrastructure';
import { RabbitMQEventPublisher } from '@ecoma-io/iam-infrastructure';
import { Provider } from '@nestjs/common';
import { AppUnitOfWork } from './application/unit-of-work';
import { UserAggregateRepository } from './application/user-aggregate.repository';
import { TenantAggregateRepository } from './application/tenant-aggregate.repository';
import { RoleAggregateRepository } from './application/role-aggregate.repository';
import { MembershipAggregateRepository } from './application/membership-aggregate.repository';
import { ServiceDefinitionAggregateRepository } from './application/service-definition-aggregate.repository';
import {
  RegisterUserHandler,
  CreateTenantHandler,
  CreateRoleHandler,
  CreateMembershipHandler,
  RegisterServiceVersionHandler,
  UpdateTenantHandler,
  UpdateRoleHandler,
  ChangeUserPasswordHandler,
  UpdateUserProfileHandler,
  ActivateUserHandler,
  SuspendUserHandler,
  LinkSocialAccountHandler,
  AssignRoleToMembershipHandler,
  RemoveRoleFromMembershipHandler,
  RegisterServiceHandler,
  PublishServiceVersionHandler,
  AssignPermissionsHandler,
} from '@ecoma-io/iam-command-interactor';
import { HealthCheckModule } from '@ecoma-io/nestjs-observability';
import { HealthService } from './health/health.service';

export const EVENT_STORE_CLIENT = Symbol('EVENT_STORE_CLIENT');
export const USER_AGG_REPO = Symbol('USER_AGG_REPO');
export const TENANT_AGG_REPO = Symbol('TENANT_AGG_REPO');
export const ROLE_AGG_REPO = Symbol('ROLE_AGG_REPO');
export const MEMBERSHIP_AGG_REPO = Symbol('MEMBERSHIP_AGG_REPO');
export const SERVICE_DEFINITION_AGG_REPO = Symbol(
  'SERVICE_DEFINITION_AGG_REPO'
);
export const APP_UOW = Symbol('APP_UOW');

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
      autoLoadEntities: true, // Auto-load entities from OutboxModule
    }),
    // RabbitMQ infrastructure for event publishing
    RabbitMQInfraModule.forRootAsync({
      useFactory: async () => new AppConfigService().getRabbitMQConfig(),
    }),
    OutboxModule,
    SnapshotModule,
    // Health checks: register concrete implementation for this app
    HealthCheckModule.register(HealthService),
  ],
  controllers: [CommandsController],
  providers: [
    // health provider
    HealthService,
    // EventStoreDB Client
    {
      provide: EVENT_STORE_CLIENT,
      useFactory: () => {
        const es = new AppConfigService().getEventStoreConfig();
        // Connection string may include tls=false & other params from e2e
        return EventStoreDBClient.connectionString(es.connectionString);
      },
    } as Provider,
    // EventStore Repository (low-level) with Outbox + Snapshot integration
    {
      provide: EventStoreDbRepository,
      useFactory: (
        client: EventStoreDBClient,
        outboxRepository: OutboxRepository,
        snapshotRepository: SnapshotRepository
      ) =>
        new EventStoreDbRepository(
          client,
          outboxRepository,
          snapshotRepository
        ),
      inject: [EVENT_STORE_CLIENT, OutboxRepository, SnapshotRepository],
    },
    // Aggregate Repository for User
    {
      provide: USER_AGG_REPO,
      useFactory: (esRepo: EventStoreDbRepository) =>
        new UserAggregateRepository(esRepo),
      inject: [EventStoreDbRepository],
    },
    // Aggregate Repository for Tenant
    {
      provide: TENANT_AGG_REPO,
      useFactory: (esRepo: EventStoreDbRepository) =>
        new TenantAggregateRepository(esRepo),
      inject: [EventStoreDbRepository],
    },
    // Aggregate Repository for Role
    {
      provide: ROLE_AGG_REPO,
      useFactory: (esRepo: EventStoreDbRepository) =>
        new RoleAggregateRepository(esRepo),
      inject: [EventStoreDbRepository],
    },
    // Aggregate Repository for Membership
    {
      provide: MEMBERSHIP_AGG_REPO,
      useFactory: (esRepo: EventStoreDbRepository) =>
        new MembershipAggregateRepository(esRepo),
      inject: [EventStoreDbRepository],
    },
    // Aggregate Repository for ServiceDefinition
    {
      provide: SERVICE_DEFINITION_AGG_REPO,
      useFactory: (esRepo: EventStoreDbRepository) =>
        new ServiceDefinitionAggregateRepository(esRepo),
      inject: [EventStoreDbRepository],
    },
    // Application Unit of Work (persist + publish)
    {
      provide: APP_UOW,
      useFactory: (
        esRepo: EventStoreDbRepository,
        publisher: RabbitMQEventPublisher
      ) => new AppUnitOfWork(esRepo, publisher),
      inject: [EventStoreDbRepository, RabbitMQEventPublisher],
    },
    // Command handler providers (example: RegisterUserHandler)
    {
      provide: RegisterUserHandler,
      useFactory: (repo: UserAggregateRepository, uow: AppUnitOfWork) =>
        new RegisterUserHandler(repo, uow),
      inject: [USER_AGG_REPO, APP_UOW],
    },
    {
      provide: CreateTenantHandler,
      useFactory: (repo: TenantAggregateRepository, uow: AppUnitOfWork) =>
        new CreateTenantHandler(repo, uow),
      inject: [TENANT_AGG_REPO, APP_UOW],
    },
    {
      provide: CreateRoleHandler,
      useFactory: (repo: RoleAggregateRepository, uow: AppUnitOfWork) =>
        new CreateRoleHandler(repo, uow),
      inject: [ROLE_AGG_REPO, APP_UOW],
    },
    {
      provide: CreateMembershipHandler,
      useFactory: (repo: MembershipAggregateRepository, uow: AppUnitOfWork) =>
        new CreateMembershipHandler(repo as any, uow as any),
      inject: [MEMBERSHIP_AGG_REPO, APP_UOW],
    },
    {
      provide: RegisterServiceVersionHandler,
      useFactory: (
        repo: ServiceDefinitionAggregateRepository,
        uow: AppUnitOfWork
      ) => new RegisterServiceVersionHandler(repo as any, uow as any),
      inject: [SERVICE_DEFINITION_AGG_REPO, APP_UOW],
    },
    // Phase 3: Additional command handlers
    {
      provide: UpdateTenantHandler,
      useFactory: (repo: TenantAggregateRepository, uow: AppUnitOfWork) =>
        new UpdateTenantHandler(repo as any, uow as any),
      inject: [TENANT_AGG_REPO, APP_UOW],
    },
    {
      provide: UpdateRoleHandler,
      useFactory: (repo: RoleAggregateRepository, uow: AppUnitOfWork) =>
        new UpdateRoleHandler(repo as any, uow as any),
      inject: [ROLE_AGG_REPO, APP_UOW],
    },
    {
      provide: ChangeUserPasswordHandler,
      useFactory: (repo: UserAggregateRepository, uow: AppUnitOfWork) =>
        new ChangeUserPasswordHandler(repo as any, uow as any),
      inject: [USER_AGG_REPO, APP_UOW],
    },
    {
      provide: UpdateUserProfileHandler,
      useFactory: (repo: UserAggregateRepository, uow: AppUnitOfWork) =>
        new UpdateUserProfileHandler(repo as any, uow as any),
      inject: [USER_AGG_REPO, APP_UOW],
    },
    {
      provide: ActivateUserHandler,
      useFactory: (repo: UserAggregateRepository, uow: AppUnitOfWork) =>
        new ActivateUserHandler(repo as any, uow as any),
      inject: [USER_AGG_REPO, APP_UOW],
    },
    {
      provide: SuspendUserHandler,
      useFactory: (repo: UserAggregateRepository, uow: AppUnitOfWork) =>
        new SuspendUserHandler(repo as any, uow as any),
      inject: [USER_AGG_REPO, APP_UOW],
    },
    {
      provide: LinkSocialAccountHandler,
      useFactory: (repo: UserAggregateRepository, uow: AppUnitOfWork) =>
        new LinkSocialAccountHandler(repo as any, uow as any),
      inject: [USER_AGG_REPO, APP_UOW],
    },
    {
      provide: AssignRoleToMembershipHandler,
      useFactory: (repo: MembershipAggregateRepository, uow: AppUnitOfWork) =>
        new AssignRoleToMembershipHandler(repo as any, uow as any),
      inject: [MEMBERSHIP_AGG_REPO, APP_UOW],
    },
    {
      provide: RemoveRoleFromMembershipHandler,
      useFactory: (repo: MembershipAggregateRepository, uow: AppUnitOfWork) =>
        new RemoveRoleFromMembershipHandler(repo as any, uow as any),
      inject: [MEMBERSHIP_AGG_REPO, APP_UOW],
    },
    {
      provide: RegisterServiceHandler,
      useFactory: (
        repo: ServiceDefinitionAggregateRepository,
        uow: AppUnitOfWork
      ) => new RegisterServiceHandler(repo as any, uow as any),
      inject: [SERVICE_DEFINITION_AGG_REPO, APP_UOW],
    },
    {
      provide: PublishServiceVersionHandler,
      useFactory: (
        repo: ServiceDefinitionAggregateRepository,
        uow: AppUnitOfWork
      ) => new PublishServiceVersionHandler(repo as any, uow as any),
      inject: [SERVICE_DEFINITION_AGG_REPO, APP_UOW],
    },
    {
      provide: AssignPermissionsHandler,
      useFactory: (repo: RoleAggregateRepository, uow: AppUnitOfWork) =>
        new AssignPermissionsHandler(repo as any, uow as any),
      inject: [ROLE_AGG_REPO, APP_UOW],
    },
  ],
})
export class AppModule {}
