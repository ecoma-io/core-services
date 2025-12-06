// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  StandardizedLogger,
  StandardizedTracer,
} from '@ecoma-io/node-observability';
import {
  IEnvironmentOptions,
  IntegrationEnvironment,
} from '@ecoma-io/integrator';
import { MaybeAsync } from '@ecoma-io/common';
import {
  initStandardizedLogger,
  initStandardizedTracer,
} from './utils/observability';
import { createAxiosInterceptor } from './utils/axios-interceptor';
import { formatLogMessageImpl } from './utils/format-log';
import { createPostgresService, IPostgresService } from './services/postgres';
import { createRedisService, IRedisService } from './services/redis';
import { createMinioService, IMinioService } from './services/minio';
import { createMongoService, IMongoService } from './services/mongo';
import {
  createElasticsearchService,
  IElasticsearchService,
} from './services/elasticsearch';
import { createRabbitMQService, IRabbitMQService } from './services/rabbitmq';
import {
  createEventStoreService,
  IEventStoreService,
} from './services/eventstore';
import { createMaildevService, IMaildevService } from './services/maildev';
import {
  createClickhouseService,
  IClickhouseService,
} from './services/clickhouse';
import { InternalAxiosRequestConfig } from 'axios';
import { trace } from '@opentelemetry/api';
import { uuidv7 } from 'uuidv7';
import { validateEnvVars } from './utils/required-env-vars';

/**
 * Options used to construct a `ProductIntegratorEnvironment`.
 *
 * @remarks
 * This type is based on `IEnvironmentOptions` but intentionally omits
 * `internalHost`, `logger`, and `id` because those are provided by the
 * environment implementation itself. Callers must provide `projectName`
 * and `projectVersion` which are attached to logs and traces for easier
 * correlation of test runs.
 */
export type ProductIntegratorEnvironmentOptions = Omit<
  IEnvironmentOptions,
  'internalHost' | 'logger' | 'id'
> & {
  /**
   * The human-readable project name (usually the package name).
   *
   * @remarks
   * Used when initializing the standardized logger and tracer so that
   * test output and traces can be attributed to this project.
   */
  projectName: string;

  /**
   * The semantic version of the project under test.
   *
   * @remarks
   * Included in trace and log metadata to correlate test results with a
   * particular release or build.
   */
  projectVersion: string;
};

/**
 * Base implementation of IntegrationEnvironment for common services in the project.
 * Provides convenience methods for accessing proxied or direct services like Postgres, Redis, MinIO, Maildev, MongoDB, Elasticsearch, RabbitMQ, and EventStoreDB.
 * Also includes setup methods to initialize test databases, buckets, and connections.
 *
 * @remarks
 * This is an internal library tailored for the project's dev infrastructure. It assumes specific env vars are set.
 */
export abstract class ProductIntegratorEnvironment extends IntegrationEnvironment {
  /**
   * Cache for lazily-created service promises.
   *
   * @remarks
   * Keys are service identifiers (e.g. 'postgres', 'redis'). Values are the
   * promises returned by the service factory so that concurrent callers share
   * the same initialization promise and duplicate initialization is avoided.
   */
  private serviceCache: Map<string, Promise<unknown>> = new Map();

  /**
   * Cleanup callbacks to run when the environment is stopped.
   *
   * @remarks
   * Each entry is a function that returns `void` or a `Promise<void>` (aliased
   * as `MaybeAsync<void>`). These are executed sequentially during
   * `stop()` to release resources created during tests (databases, clients,
   * buckets, etc.).
   */
  private waitToCloses: Array<() => MaybeAsync<void>> = [];

  /**
   * The name of the project under test.
   *
   * @remarks
   * Used in logs, tracer initialization and for human-readable diagnostics.
   */
  public readonly projectName: string;

  /**
   * The semantic version of the project under test.
   *
   * @remarks
   * Surface this in traces and logs so test runs can be correlated to a
   * particular package version.
   */
  public readonly projectVersion: string;

  /**
   * OpenTelemetry collector endpoint used by the environment tracer.
   *
   * @remarks
   * Constructed from the internal host and the `HYPERDX_OLTP_GRPC_PORT` env
   * var. Example: `grpc://<internalHost>:<port>`.
   */
  public readonly otelEndpoint: string;

  /**
   * Authorization headers (or other headers) used when exporting traces.
   *
   * @remarks
   * Typically contains an `Authorization` header value derived from
   * `HYPERDX_API_KEY` and is attached to outgoing trace export requests.
   */
  public readonly otelHeaders: string;

  /**
   * Factory for an Axios request interceptor that injects tracing and logging
   * context into outbound HTTP calls.
   *
   * @remarks
   * The function accepts a `hostServiceName` (the logical service name being
   * called) and returns an interceptor compatible with Axios' request
   * interceptors. The returned interceptor takes an
   * `InternalAxiosRequestConfig` and must return the modified config.
   */
  public readonly axiosInterceptor: (
    hostServiceName: string
  ) => (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig;

  /**
   * Construct a new ProductIntegratorEnvironment.
   *
   * @remarks
   * Initializes tracing, logging and axios interceptors and validates required environment variables.
   *
   * @param options - Options used to configure the environment. Must include projectName and projectVersion.
   */
  constructor(options: ProductIntegratorEnvironmentOptions) {
    const id = uuidv7();
    // referance internal host used by dev infrastructure
    // see network settings in infras/infras-core/compose.yaml
    const internalHost = '172.168.186.168';

    initStandardizedLogger({
      id,
      projectName: options.projectName,
      projectVersion: options.projectVersion,
    });
    const parrentLogger = new StandardizedLogger({
      context: IntegrationEnvironment.name,
      extra: { testEnvironmentId: id },
    });
    const parrentOptions = {
      id,
      internalHost,
      logger: parrentLogger,
      ...options,
    };
    super(parrentOptions);

    this.projectName = options.projectName;
    this.projectVersion = options.projectVersion;
    this.otelEndpoint = `grpc://${this.internalHost}:${process.env.HYPERDX_OLTP_GRPC_PORT}`;
    this.otelHeaders = `Authorization:${process.env.HYPERDX_API_KEY}`;

    this.logger?.debug(
      `Initializing Integration Environment for project: ${this.projectName}`
    );

    validateEnvVars();

    initStandardizedTracer({
      id,
      projectName: this.projectName,
      projectVersion: this.projectVersion,
    });

    const tracer = trace.getTracer('core-product-integration-environment');
    this.axiosInterceptor = createAxiosInterceptor(
      tracer,
      new StandardizedLogger({
        context: IntegrationEnvironment.name,
        extra: { testEnvironmentId: id },
      })
    );
  }

  /**
   * Stop the environment and clean up resources.
   *
   * @remarks
   * Shuts down the standardized logger and tracer, runs all registered cleanup functions, clears cached service promises, and calls the parent stop implementation.
   *
   * @returns A promise that resolves once cleanup is complete.
   */
  async stop(): Promise<void> {
    await StandardizedLogger.shutdown();
    await StandardizedTracer.shutdown();
    this.serviceCache.clear();
    for (const fn of this.waitToCloses) {
      try {
        await fn();
      } catch (err) {
        this.logger?.warn({
          msg: `Error during cleanup in waitToCloses: ${(err as Error).message}`,
          err,
        });
      }
    }
    await super.stop();
  }

  /**
   * Format an incoming container process log message into the standardized shape.
   *
   * @remarks
   * Delegates to formatLogMessageImpl which performs mapping between raw stdout/stderr JSON and a level/message object used by our logger.
   *
   * @param streamType - The log stream origin ('stdout' or 'stderr').
   * @param message - The raw message payload emitted by the running container.
   * @returns An object containing the mapped severity level and normalized message payload.
   */
  formatLogMessage(
    streamType: 'stdout' | 'stderr',
    message: Record<string, unknown>
  ): {
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    message: Record<string, unknown>;
  } {
    return formatLogMessageImpl(streamType, message);
  }

  private cachingService<T>(
    cacheKey: string,
    serviceFactory: () => Promise<T>
  ): Promise<T> {
    if (this.serviceCache.has(cacheKey)) {
      return this.serviceCache.get(cacheKey) as Promise<T>;
    }
    const promise = serviceFactory();
    this.serviceCache.set(cacheKey, promise);
    return promise;
  }

  /**
   * Get (and lazily create) a Postgres service instance for this environment.
   *
   * @remarks
   * Uses POSTGRES_PORT from process.env and caches the returned promise to avoid duplicate initialization.
   *
   * @returns A promise resolving to a proxied or direct Postgres service object containing:
   *  - dataSource: an initialized TypeORM DataSource pointed to a test database
   *  - databaseName: the created database name for isolation
   */
  getPostgres(): Promise<IPostgresService> {
    return this.cachingService<IPostgresService>('postgres', () => {
      return createPostgresService({
        id: this.id,
        createService: this.createService.bind(this),
        postgresPort: process.env['POSTGRES_PORT'],
        env: process.env,
        waitToCloses: this.waitToCloses,
      });
    });
  }

  /**
   * Get (and lazily create) a Redis service instance for this environment.
   *
   * @remarks
   * Uses REDIS_PORT from process.env and caches the returned promise to avoid duplicate initialization. The returned Redis client is ready for immediate use in tests.
   *
   * @returns A promise resolving to a proxied or direct Redis service object containing:
   *  - redis: an ioredis client instance connected to a test database
   */
  getRedis(): Promise<IRedisService> {
    return this.cachingService<IRedisService>('redis', () =>
      createRedisService({
        id: this.id,
        createService: this.createService.bind(this),
        redisPort: process.env['REDIS_PORT'],
        env: process.env,
        waitToCloses: this.waitToCloses,
      })
    );
  }

  /**
   * Get (and lazily create) a MinIO (S3-compatible) service instance for this environment.
   *
   * @remarks
   * Uses MINIO_PORT from process.env and creates a private bucket for the current test environment. Caches the promise to avoid repeated initialization.
   *
   * @returns A promise resolving to a proxied or direct MinIO service object containing:
   *  - bucketName: the created bucket name for the test environment
   *  - s3Client: an S3Client configured to talk to the MinIO endpoint
   */
  getMinio(): Promise<IMinioService> {
    return this.cachingService<IMinioService>('minio', () =>
      createMinioService({
        id: this.id,
        createService: this.createService.bind(this),
        minioPort: process.env['MINIO_PORT'],
        env: process.env,
        waitToCloses: this.waitToCloses,
      })
    );
  }

  /**
   * Get (and lazily create) a Maildev service instance for this environment.
   *
   * @remarks
   * Uses MAILDEV_PORT from process.env. The returned service can be used by tests to assert mail flows.
   *
   * @returns A promise resolving to the proxied or direct Maildev service instance.
   */
  getMaildev(): Promise<IMaildevService> {
    return this.cachingService<IMaildevService>('maildev', () =>
      createMaildevService({
        id: this.id,
        createService: this.createService.bind(this),
        maildevPort: process.env['MAILDEV_PORT'],
        env: process.env,
        waitToCloses: this.waitToCloses,
      })
    );
  }

  /**
   * Get (and lazily create) a MongoDB service instance for this environment.
   *
   * @remarks
   * Uses MONGO_PORT from process.env and returns a connected MongoClient and a Db instance for a per-test database.
   *
   * @returns A promise resolving to a proxied or direct Mongo service object containing:
   *  - mongoClient: a connected MongoClient
   *  - db: the Db instance for the created test database
   *  - databaseName: the created database name for isolation
   */
  getMongo(): Promise<IMongoService> {
    return this.cachingService<IMongoService>('mongo', () =>
      createMongoService({
        id: this.id,
        createService: this.createService.bind(this),
        mongoPort: process.env['MONGO_PORT'],
        env: process.env,
        waitToCloses: this.waitToCloses,
      })
    );
  }

  /**
   * Get (and lazily create) an Elasticsearch service instance for this environment.
   *
   * @remarks
   * Uses ELASTIC_PORT from process.env and returns a client configured to manipulate test indices. An index prefix or name is provided to isolate tests.
   *
   * @returns A promise resolving to a proxied or direct Elasticsearch service object containing:
   *  - elasticsearchClient: an ES client instance
   *  - indexName: the test index name or prefix
   */
  getElasticsearch(): Promise<IElasticsearchService> {
    return this.cachingService<IElasticsearchService>('elasticsearch', () =>
      createElasticsearchService({
        id: this.id,
        createService: this.createService.bind(this),
        elasticPort: process.env['ELASTIC_PORT'],
        env: process.env,
        waitToCloses: this.waitToCloses,
      })
    );
  }

  /**
   * Get (and lazily create) a RabbitMQ service instance for this environment.
   *
   * @remarks
   * Uses RABBITMQ_AMQP_PORT and RABBITMQ_MANAGEMENT_PORT from process.env. Returns a connection, a default channel, and the vhost used for testing.
   *
   * @returns A promise resolving to a proxied or direct RabbitMQ service object containing:
   *  - connection: the amqp connection model
   *  - channel: an active amqp Channel
   *  - vhost: the virtual host used
   */
  getRabbitMQ(): Promise<IRabbitMQService> {
    return this.cachingService<IRabbitMQService>('rabbitmq', () =>
      createRabbitMQService({
        id: this.id,
        createService: this.createService.bind(this),
        amqpPort: process.env['RABBITMQ_AMQP_PORT'],
        mgmtPort: process.env['RABBITMQ_MANAGEMENT_PORT'],
        env: process.env,
        waitToCloses: this.waitToCloses,
      })
    );
  }

  /**
   * Get (and lazily create) an EventStoreDB service instance for this environment.
   *
   * @remarks
   * Uses ESDB_HTTP_PORT from process.env and returns a client configured to work with a test event stream prefix.
   *
   * @returns A promise resolving to a proxied or direct EventStoreDB service object containing:
   *  - eventStoreClient: a connected EventStoreDBClient
   *  - streamPrefix: test stream prefix string for isolation
   */
  getEventStoreDB(): Promise<IEventStoreService> {
    return this.cachingService<IEventStoreService>('eventstoredb', () =>
      createEventStoreService({
        id: this.id,
        createService: this.createService.bind(this),
        esdbPort: process.env['ESDB_HTTP_PORT'],
        env: process.env,
        waitToCloses: this.waitToCloses,
      })
    );
  }

  /**
   * Get (and lazily create) a ClickHouse service instance for this environment.
   *
   * @remarks
   * Uses CLICK_HOUSE_HTTP_PORT from process.env and creates an isolated database per test id.
   *
   * @returns A promise resolving to a proxied or direct ClickHouse service object containing:
   *  - clickhouseClient: a ClickHouse client instance
   *  - databaseName: the created database name for isolation
   */
  getClickhouse(): Promise<IClickhouseService> {
    return this.cachingService<IClickhouseService>('clickhouse', () =>
      createClickhouseService({
        id: this.id,
        createService: this.createService.bind(this),
        clickhousePort: process.env['CLICK_HOUSE_HTTP_PORT'],
        env: process.env,
        waitToCloses: this.waitToCloses,
      })
    );
  }
}
