import { DynamicModule, Module, OnModuleInit, Provider } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { UserSearchRepository, TenantSearchRepository } from './';

export interface ElasticsearchModuleOptions {
  node: string;
  auth?: {
    username: string;
    password: string;
  };
}

/**
 * Search Module for Elasticsearch integration.
 *
 * Provides full-text search for Users and Tenants.
 *
 * @see ADR-2: Elasticsearch for Search
 */
@Module({})
export class SearchModule implements OnModuleInit {
  constructor(
    private readonly userSearch: UserSearchRepository,
    private readonly tenantSearch: TenantSearchRepository
  ) {}

  async onModuleInit(): Promise<void> {
    await this.userSearch.ensureIndex();
    await this.tenantSearch.ensureIndex();
  }

  static forRoot(options: ElasticsearchModuleOptions): DynamicModule {
    const clientProvider: Provider = {
      provide: Client,
      useFactory: () => {
        return new Client({
          node: options.node,
          auth: options.auth,
        });
      },
    };

    return {
      module: SearchModule,
      providers: [clientProvider, UserSearchRepository, TenantSearchRepository],
      exports: [UserSearchRepository, TenantSearchRepository],
    };
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: unknown[]
    ) => ElasticsearchModuleOptions | Promise<ElasticsearchModuleOptions>;
    inject?: unknown[];
  }): DynamicModule {
    const clientProvider: Provider = {
      provide: Client,
      useFactory: async (...args: unknown[]) => {
        const config = await options.useFactory(...args);
        return new Client({
          node: config.node,
          auth: config.auth,
        });
      },
      inject: options.inject,
    };

    return {
      module: SearchModule,
      providers: [clientProvider, UserSearchRepository, TenantSearchRepository],
      exports: [UserSearchRepository, TenantSearchRepository],
    };
  }
}
