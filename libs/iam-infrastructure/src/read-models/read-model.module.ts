import { DynamicModule, Module, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { EntityClassOrSchema } from '@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type';
import {
  UserEntity,
  TenantEntity,
  RoleEntity,
  MembershipEntity,
  ServiceDefinitionEntity,
} from './entities';
import {
  UserReadRepository,
  TenantReadRepository,
  RoleReadRepository,
  MembershipReadRepository,
  ServiceDefinitionReadRepository,
} from './repositories';

/**
 * Read Model Module for IAM domain.
 *
 * Provides TypeORM entities and repositories for querying read models.
 *
 * @see ADR-2: PostgreSQL for Read Model
 */
@Module({})
export class ReadModelModule {
  static forRoot(options?: {
    entities?: EntityClassOrSchema[];
    synchronize?: boolean;
  }): DynamicModule {
    const entities: EntityClassOrSchema[] = [
      UserEntity,
      TenantEntity,
      RoleEntity,
      MembershipEntity,
      ServiceDefinitionEntity,
      ...(options?.entities ?? []),
    ];

    const providers: Provider[] = [
      UserReadRepository,
      TenantReadRepository,
      RoleReadRepository,
      MembershipReadRepository,
      ServiceDefinitionReadRepository,
    ];

    return {
      module: ReadModelModule,
      imports: [TypeOrmModule.forFeature(entities)],
      providers,
      exports: providers,
    };
  }
}
