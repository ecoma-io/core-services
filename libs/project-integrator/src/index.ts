// exports for project-integrator
export * from './lib/project-integrator';

// Export service result types for convenience
export type { IPostgresService } from './lib/services/postgres';
export type { IRedisService } from './lib/services/redis';
export type { IMinioService } from './lib/services/minio';
export type { IMongoService } from './lib/services/mongo';
export type { IElasticsearchService } from './lib/services/elasticsearch';
export type { IRabbitMQService } from './lib/services/rabbitmq';
export type { IEventStoreService } from './lib/services/eventstore';
export type { IMaildevService } from './lib/services/maildev';
export type { IClickhouseService } from './lib/services/clickhouse';
