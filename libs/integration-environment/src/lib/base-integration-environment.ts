import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';
import { S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';
import {
  IntegrationEnvironment,
  ProxiedService,
  ProxyOptions,
  Service,
} from '@ecoma-io/integration-hybridize';
import { MaybeAsync } from '@ecoma-io/common';
import { Client } from 'pg';
import { MongoClient, Db } from 'mongodb';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import * as http from 'http';
import * as amqp from 'amqplib';
import { EventStoreDBClient } from '@eventstore/db-client';

export interface EnvironmentOptions {
  internalHost?: string;
  proxy?: boolean | ProxyOptions;
}

/**
 * Base implementation of IntegrationEnvironment for common services in the project.
 * Provides convenience methods for accessing proxied or direct services like Postgres, Redis, MinIO, Maildev, MongoDB, Elasticsearch, RabbitMQ, and EventStoreDB.
 * Also includes setup methods to initialize test databases, buckets, and connections.
 * @remarks This is an internal library tailored for the project's dev infrastructure. It assumes specific env vars are set.
 */
export abstract class BaseIntegrationEnvironment extends IntegrationEnvironment {
  private serviceCache: Map<string, Promise<unknown>> = new Map();
  private waitToCloses: Array<() => MaybeAsync<void>> = [];

  constructor({ internalHost, proxy }: EnvironmentOptions = {}) {
    super(internalHost ?? '172.168.186.168', proxy);

    // Validate required environment variables
    const requiredEnvVars = [
      'POSTGRES_PORT',
      'POSTGRES_USERNAME',
      'POSTGRES_PASSWORD',
      'REDIS_PORT',
      'REDIS_PASSWORD',
      'MINIO_PORT',
      'MINIO_KEY',
      'MINIO_SECRET',
      'MAILDEV_WEB_PORT',
      'MONGO_PORT',
      'MONGO_USERNAME',
      'MONGO_PASSWORD',
      'RABBITMQ_AMQP_PORT',
      'RABBITMQ_USERNAME',
      'RABBITMQ_PASSWORD',
      'RABBITMQ_MANAGEMENT_PORT',
      'ESDB_HTTP_PORT',
      'ELASTIC_PORT',
      'ELASTIC_PASSWORD',
    ];

    for (const envVar of requiredEnvVars) {
      if (process.env[envVar] === undefined) {
        throw new Error(
          `Environment variable ${envVar} is required but not set`
        );
      }
    }
  }

  async stop(): Promise<void> {
    await super.stop();
    this.serviceCache.clear();
    for (const fn of this.waitToCloses) {
      try {
        await fn();
      } catch {
        // Ignore errors during cleanup
      }
    }
  }

  /**
   * Gets a proxied or direct service for Postgres.
   * @param - No parameters.
   * @returns {Promise<(ProxiedService | Service) & { dataSource: DataSource; databaseName: string }>} A promise resolving to the Postgres service with an initialized DataSource for the test database.
   * @remarks Uses POSTGRES_PORT env var. Assumes proxy is configured if enabled. Initializes a test database and returns a new DataSource connected to it.
   */
  async getPostgres(): Promise<
    (ProxiedService | Service) & {
      dataSource: DataSource;
      databaseName: string;
    }
  > {
    const cacheKey = 'postgres';
    if (this.serviceCache.has(cacheKey)) {
      return this.serviceCache.get(cacheKey) as Promise<
        (ProxiedService | Service) & {
          dataSource: DataSource;
          databaseName: string;
        }
      >;
    }

    const promise = this.createPostgresService();
    this.serviceCache.set(cacheKey, promise);
    return promise;
  }

  private async createPostgresService(): Promise<
    (ProxiedService | Service) & {
      dataSource: DataSource;
      databaseName: string;
    }
  > {
    const service = await this.createService(
      `postgres-${this.id}`,
      process.env['POSTGRES_PORT']
    );
    const databaseName = `test_${this.id}`;

    // Use pg client to create the test database
    const client = new Client({
      host: service.host,
      port: service.port,
      user: process.env['POSTGRES_USERNAME'],
      password: process.env['POSTGRES_PASSWORD'],
    });

    try {
      await client.connect();
      await client.query(`CREATE DATABASE "${databaseName}";`);
    } catch (error) {
      throw new Error(`Failed to initialize Postgres database: ${error}`);
    } finally {
      await client.end();
    }

    // Create and initialize a new DataSource for the test database
    const dataSource = new DataSource({
      type: 'postgres',
      host: service.host,
      port: service.port,
      username: process.env['POSTGRES_USERNAME'],
      password: process.env['POSTGRES_PASSWORD'],
      database: databaseName,
    });

    try {
      await dataSource.initialize();
    } catch (error) {
      throw new Error(`Failed to connect to test database: ${error}`);
    }

    this.waitToCloses.push(async () => {
      await dataSource.destroy();
    });

    return { dataSource, databaseName, ...service };
  }

  /**
   * Gets a proxied or direct service for Redis.
   * @param - No parameters.
   * @returns {Promise<(ProxiedService | Service) & { redis: Redis }>} A promise resolving to the Redis service with an initialized Redis client.
   * @remarks Uses REDIS_PORT env var. Assumes proxy is configured if enabled. Selects a database and sets a test key.
   */
  async getRedis(): Promise<(ProxiedService | Service) & { redis: Redis }> {
    const cacheKey = 'redis';
    if (this.serviceCache.has(cacheKey)) {
      return this.serviceCache.get(cacheKey) as Promise<
        (ProxiedService | Service) & { redis: Redis }
      >;
    }

    const promise = this.createRedisService();
    this.serviceCache.set(cacheKey, promise);

    return promise;
  }

  private async createRedisService(): Promise<
    (ProxiedService | Service) & { redis: Redis }
  > {
    const service = await this.createService(
      `redis-${this.id}`,
      process.env['REDIS_PORT']
    );
    const redis = new Redis({
      host: service.host,
      port: service.port,
      password: process.env['REDIS_PASSWORD'],
      keyPrefix: `test_${this.id}_`,
    });

    try {
      // Select a database based on environment id (Redis has 16 databases by default, using 1-15 to reserve 0 for other uses)
      const dbIndex =
        (this.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) %
          15) +
        1;
      await redis.select(dbIndex);
      // Set a test key to verify connection
      await redis.set(`test_${this.id}`, 'initialized');
    } catch (error) {
      throw new Error(`Failed to initialize Redis: ${error}`);
    }

    this.waitToCloses.push(async () => {
      await redis.quit();
    });

    return { redis, ...service };
  }

  /**
   * Gets a proxied or direct service for MinIO.
   * Always creates a private bucket for the current test environment.
   * @returns {Promise<(ProxiedService | Service) & { bucketName: string; s3Client: S3Client }>} A promise resolving to the MinIO service with bucket name and S3 client.
   * @remarks Uses MINIO_PORT env var. Assumes proxy is configured if enabled. Creates a private test bucket.
   */
  async getMinio(): Promise<
    (ProxiedService | Service) & { bucketName: string; s3Client: S3Client }
  > {
    const cacheKey = 'minio';
    if (this.serviceCache.has(cacheKey)) {
      return this.serviceCache.get(cacheKey) as Promise<
        (ProxiedService | Service) & { bucketName: string; s3Client: S3Client }
      >;
    }

    const promise = this.createMinioService();
    this.serviceCache.set(cacheKey, promise);
    return promise;
  }

  private async createMinioService(): Promise<
    (ProxiedService | Service) & { bucketName: string; s3Client: S3Client }
  > {
    const service = await this.createService(
      `minio-${this.id}`,
      process.env['MINIO_PORT']
    );
    const s3Client = new S3Client({
      endpoint: `http://${service.host}:${service.port}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env['MINIO_KEY'],
        secretAccessKey: process.env['MINIO_SECRET'],
      },
      forcePathStyle: true,
    });

    const bucketName = `test-private-${this.id}`;

    try {
      // Create private bucket (no public policy applied)
      await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
    } catch (error) {
      throw new Error(`Failed to setup MinIO bucket: ${error}`);
    }

    this.waitToCloses.push(() => {
      s3Client.destroy();
    });

    return { bucketName, s3Client, ...service };
  }

  /**
   * Gets a proxied or direct service for Maildev.
   * @param - No parameters.
   * @returns {Promise<ProxiedService | Service>} A promise resolving to the Maildev service.
   * @remarks Uses MAILDEV_PORT env var. Assumes proxy is configured if enabled.
   */
  async getMaildev(): Promise<ProxiedService | Service> {
    const cacheKey = 'maildev';
    if (this.serviceCache.has(cacheKey)) {
      return this.serviceCache.get(cacheKey) as Promise<
        ProxiedService | Service
      >;
    }

    const promise = this.createService(
      `maildev-${this.id}`,
      process.env['MAILDEV_WEB_PORT']
    );
    this.serviceCache.set(cacheKey, promise);
    return promise;
  }

  /**
   * Gets a proxied or direct service for MongoDB.
   * @returns {Promise<(ProxiedService | Service) & { mongoClient: MongoClient; db: Db; databaseName: string }>} A promise resolving to the MongoDB service with initialized client and database.
   * @remarks Uses MONGO_PORT env var. Assumes proxy is configured if enabled. Creates a test database and returns a connected MongoClient.
   */
  async getMongo(): Promise<
    (ProxiedService | Service) & {
      mongoClient: MongoClient;
      db: Db;
      databaseName: string;
    }
  > {
    const cacheKey = 'mongo';
    if (this.serviceCache.has(cacheKey)) {
      return this.serviceCache.get(cacheKey) as Promise<
        (ProxiedService | Service) & {
          mongoClient: MongoClient;
          db: Db;
          databaseName: string;
        }
      >;
    }

    const promise = this.createMongoService();
    this.serviceCache.set(cacheKey, promise);
    return promise;
  }

  private async createMongoService(): Promise<
    (ProxiedService | Service) & {
      mongoClient: MongoClient;
      db: Db;
      databaseName: string;
    }
  > {
    const service = await this.createService(
      `mongo-${this.id}`,
      process.env['MONGO_PORT']
    );
    const databaseName = `test_${this.id}`;

    const connectionString = `mongodb://${process.env['MONGO_USERNAME']}:${process.env['MONGO_PASSWORD']}@${service.host}:${service.port}`;

    let mongoClient: MongoClient;
    try {
      mongoClient = new MongoClient(connectionString);
      await mongoClient.connect();
    } catch (error) {
      throw new Error(`Failed to connect to MongoDB: ${error}`);
    }

    const db = mongoClient.db(databaseName);

    this.waitToCloses.push(async (): Promise<void> => {
      await mongoClient.close();
    });

    return { mongoClient, db, databaseName, ...service };
  }

  /**
   * Gets a proxied or direct service for Elasticsearch.
   * @returns {Promise<(ProxiedService | Service) & { elasticsearchClient: ElasticsearchClient; indexPrefix: string }>} A promise resolving to the Elasticsearch service with initialized client.
   * @remarks Uses ELASTIC_PORT env var. Assumes proxy is configured if enabled. Returns a connected Elasticsearch client with a test index prefix.
   */
  async getElasticsearch(): Promise<
    (ProxiedService | Service) & {
      elasticsearchClient: ElasticsearchClient;
      indexName: string;
    }
  > {
    const cacheKey = 'elasticsearch';
    if (this.serviceCache.has(cacheKey)) {
      return this.serviceCache.get(cacheKey) as Promise<
        (ProxiedService | Service) & {
          elasticsearchClient: ElasticsearchClient;
          indexName: string;
        }
      >;
    }

    const promise = this.createElasticsearchService();
    this.serviceCache.set(cacheKey, promise);
    return promise;
  }

  private async createElasticsearchService(): Promise<
    (ProxiedService | Service) & {
      elasticsearchClient: ElasticsearchClient;
      indexName: string;
    }
  > {
    const service = await this.createService(
      `elasticsearch-${this.id}`,
      process.env['ELASTIC_PORT']
    );
    const indexName = `test_${this.id}`;

    const elasticsearchClient = new ElasticsearchClient({
      node: `http://${service.host}:${service.port}`,
      auth: {
        username: 'elastic',
        password: process.env['ELASTIC_PASSWORD'],
      },
    });

    try {
      // Verify connection
      await elasticsearchClient.ping();
      // Create a dedicated index for this test environment
      // Ignore errors if index already exists in rare reuse scenarios
      try {
        // indices API is available on the client; cast narrowly to avoid any
        const indicesApi = (
          elasticsearchClient as unknown as {
            indices?: { create: (args: { index: string }) => Promise<unknown> };
          }
        ).indices;
        if (indicesApi?.create) {
          await indicesApi.create({ index: indexName });
        }
      } catch {
        // no-op
      }
    } catch (error) {
      throw new Error(`Failed to connect to Elasticsearch: ${error}`);
    }

    this.waitToCloses.push(async (): Promise<void> => {
      await elasticsearchClient.close();
    });

    return { elasticsearchClient, indexName, ...service };
  }

  /**
   * Gets a proxied or direct service for RabbitMQ.
   * @returns {Promise<(ProxiedService | Service) & { connection: amqp.ChannelModel; channel: amqp.Channel }>} A promise resolving to the RabbitMQ service with connection and channel.
   * @remarks Uses RABBITMQ_AMQP_PORT env var. Assumes proxy is configured if enabled. Returns a connected RabbitMQ connection and default channel.
   */
  async getRabbitMQ(): Promise<
    (ProxiedService | Service) & {
      connection: amqp.ChannelModel;
      channel: amqp.Channel;
    }
  > {
    const cacheKey = 'rabbitmq';
    if (this.serviceCache.has(cacheKey)) {
      return this.serviceCache.get(cacheKey) as Promise<
        (ProxiedService | Service) & {
          connection: amqp.ChannelModel;
          channel: amqp.Channel;
        }
      >;
    }

    const promise = this.createRabbitMQService();
    this.serviceCache.set(cacheKey, promise);
    return promise;
  }

  private async createRabbitMQService(): Promise<
    (ProxiedService | Service) & {
      connection: amqp.ChannelModel;
      channel: amqp.Channel;
      vhost: string;
    }
  > {
    const service = await this.createService(
      `rabbitmq-${this.id}`,
      process.env['RABBITMQ_AMQP_PORT']
    );
    const mgmtService = await this.createService(
      `rabbitmq-management-${this.id}`,
      process.env['RABBITMQ_MANAGEMENT_PORT']
    );

    const vhost = `test_${this.id}`;

    await this.ensureRabbitMqVhost(
      mgmtService.host,
      Number(process.env['RABBITMQ_MANAGEMENT_PORT']),
      vhost,
      process.env['RABBITMQ_USERNAME'] as string,
      process.env['RABBITMQ_PASSWORD'] as string
    );

    const connectionString = `amqp://${process.env['RABBITMQ_USERNAME']}:${process.env['RABBITMQ_PASSWORD']}@${service.host}:${service.port}/${encodeURIComponent(
      vhost
    )}`;

    let connection: amqp.ChannelModel;
    let channel: amqp.Channel;
    try {
      connection = await amqp.connect(connectionString);
      channel = await connection.createChannel();
    } catch (error) {
      throw new Error(`Failed to connect to RabbitMQ: ${error}`);
    }

    this.waitToCloses.push(async (): Promise<void> => {
      await channel.close();
      await connection.close();
    });

    return { connection, channel, vhost, ...service };
  }

  private async ensureRabbitMqVhost(
    host: string,
    port: number,
    vhost: string,
    username: string,
    password: string
  ): Promise<void> {
    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    // Create vhost
    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        {
          host,
          port,
          method: 'PUT',
          path: `/api/vhosts/${encodeURIComponent(vhost)}`,
          headers: {
            Authorization: `Basic ${auth}`,
          },
        },
        (res) => {
          const ok =
            (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300;
          if (ok) resolve();
          else
            reject(new Error(`Failed to create vhost: HTTP ${res.statusCode}`));
        }
      );
      req.on('error', reject);
      req.end();
    });

    // Set permissions for the user on that vhost
    await new Promise<void>((resolve, reject) => {
      const body = JSON.stringify({ configure: '.*', write: '.*', read: '.*' });
      const req = http.request(
        {
          host,
          port,
          method: 'PUT',
          path: `/api/permissions/${encodeURIComponent(vhost)}/${encodeURIComponent(
            username
          )}`,
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          const ok =
            (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300;
          if (ok) resolve();
          else
            reject(
              new Error(`Failed to set permissions: HTTP ${res.statusCode}`)
            );
        }
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  /**
   * Gets a proxied or direct service for EventStoreDB.
   * @returns {Promise<(ProxiedService | Service) & { eventStoreClient: EventStoreDBClient; streamPrefix: string }>} A promise resolving to the EventStoreDB service with initialized client.
   * @remarks Uses ESDB_HTTP_PORT env var. Assumes proxy is configured if enabled. Returns a connected EventStoreDB client with a test stream prefix.
   */
  async getEventStoreDB(): Promise<
    (ProxiedService | Service) & {
      eventStoreClient: EventStoreDBClient;
      streamPrefix: string;
    }
  > {
    const cacheKey = 'eventstoredb';
    if (this.serviceCache.has(cacheKey)) {
      return this.serviceCache.get(cacheKey) as Promise<
        (ProxiedService | Service) & {
          eventStoreClient: EventStoreDBClient;
          streamPrefix: string;
        }
      >;
    }

    const promise = this.createEventStoreDBService();
    this.serviceCache.set(cacheKey, promise);
    return promise;
  }

  private async createEventStoreDBService(): Promise<
    (ProxiedService | Service) & {
      eventStoreClient: EventStoreDBClient;
      streamPrefix: string;
    }
  > {
    const service = await this.createService(
      `eventstoredb-${this.id}`,
      process.env['ESDB_HTTP_PORT']
    );
    const streamPrefix = `test_${this.id}`;

    const eventStoreClient = EventStoreDBClient.connectionString(
      `esdb://${service.host}:${service.port}?tls=false`
    );

    this.waitToCloses.push((): void => {
      eventStoreClient.dispose();
    });

    return { eventStoreClient, streamPrefix, ...service };
  }
}
