import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';
import {
  S3Client,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import {
  IntegrationEnvironment,
  ProxiedService,
  ProxyOptions,
  Service,
} from '@ecoma-io/integration-hybridize';
import { MaybeAsync } from '@ecoma-io/common';
import { Client } from 'pg';

export interface EnvironmentOptions {
  internalHost?: string;
  proxy?: boolean | ProxyOptions;
}

/**
 * Base implementation of IntegrationEnvironment for common services in the project.
 * Provides convenience methods for accessing proxied or direct services like Postgres, Redis, MinIO, and Maildev.
 * Also includes setup methods to initialize test databases and buckets.
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
   * @param options {object} - Configuration options for the MinIO service.
   * @param options.isPublicBucket {boolean} - Whether to make the bucket public. Defaults to false.
   * @returns {Promise<(ProxiedService | Service) & { bucketName: string; s3Client: S3Client }>} A promise resolving to the MinIO service with bucket name and S3 client.
   * @remarks Uses MINIO_PORT env var. Assumes proxy is configured if enabled. Creates a test bucket and optionally sets a public policy.
   */
  async getMinio(
    options: { isPublicBucket: boolean } = {
      isPublicBucket: false,
    }
  ): Promise<
    (ProxiedService | Service) & { bucketName: string; s3Client: S3Client }
  > {
    const cacheKey = `minio-${options.isPublicBucket}`;
    if (this.serviceCache.has(cacheKey)) {
      return this.serviceCache.get(cacheKey) as Promise<
        (ProxiedService | Service) & { bucketName: string; s3Client: S3Client }
      >;
    }

    const promise = this.createMinioService(options);
    this.serviceCache.set(cacheKey, promise);
    return promise;
  }

  private async createMinioService(options: {
    isPublicBucket: boolean;
  }): Promise<
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

    const bucketName = `test-${options.isPublicBucket ? 'public' : 'private'}-${this.id}`;

    try {
      // Create bucket
      await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));

      // If public, set bucket policy
      if (options.isPublicBucket) {
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: '*',
              Action: 's3:GetObject',
              Resource: `arn:aws:s3:::${bucketName}/*`,
            },
          ],
        };
        await s3Client.send(
          new PutBucketPolicyCommand({
            Bucket: bucketName,
            Policy: JSON.stringify(policy),
          })
        );
      }
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
}
