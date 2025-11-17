import { BaseIntegrationEnvironment } from '@ecoma-io/integration-environment';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { ProxyOptions } from '@ecoma-io/integration-hybridize';
import Redis from 'ioredis';

/**
 * Test environment class for setting up integration tests with PostgreSQL, MinIO, and service containers.
 * Extends BaseIntegrationEnvironment to provide a configured DataSource and containerized services.
 */
export class TestEnvironment extends BaseIntegrationEnvironment {
  /**
   * The TypeORM DataSource instance for database interactions during tests.
   * @type {DataSource}
   */
  public dataSource: DataSource;

  /**
   * The started resource service container.
   */
  private iamCommandService: StartedTestContainer;
  public redis: Redis;

  /**
   * Constructor for TestEnvironment with proxy options.
   * @param proxyOptions - Proxy configuration options.
   */
  constructor(proxyOptions: ProxyOptions | boolean = true) {
    super({ internalHost: '172.168.186.168', proxy: proxyOptions });
  }

  /**
   * Gets the started resource service container.
   */
  public get resourceServiceContainer(): StartedTestContainer {
    return this.iamCommandService;
  }

  /**
   * Initializes and starts the required application containers for the test environment.
   * Sets up PostgreSQL, MinIO, resource migration, and resource service containers.
   * @returns {Promise<Array<StartedTestContainer>>} A promise that resolves to an array of started test containers.
   * @remarks This method configures environment variables for each container, applies wait strategies for readiness,
   * and ensures the DataSource is available for database operations. Containers include a migration runner and the main service.
   */
  protected async initAppContainers(): Promise<Array<StartedTestContainer>> {
    // Retrieve PostgreSQL configuration and DataSource
    const {
      host: postgresHost,
      port: postgresPort,
      databaseName,
      dataSource,
    } = await this.getPostgres();
    this.dataSource = dataSource;

    // Retrieve MinIO configuration
    const { host: redisHost, port: redistPort, redis } = await this.getRedis();
    this.redis = redis;

    const iamCommandService = await new GenericContainer('iam-command-service')
      .withEnvironment({
        NODE_ENV: 'test',
        PORT: '3000',
        // Connect via ToxiProxy (exposed host/port)
        DB_HOST: postgresHost,
        DB_PORT: postgresPort.toString(),
        DB_NAME: databaseName,
        DB_USERNAME: process.env['POSTGRES_USERNAME'],
        DB_PASSWORD: process.env['POSTGRES_PASSWORD'],
        REDIS_HOST: redisHost,
        REDIS_PORT: redistPort.toString(),
        REDIS_PASSWORD: process.env['REDIS_PASSWORD'],
      })
      .withExposedPorts(3000)
      .withLogConsumer(this.createLogConsumer('resource-service'))
      .withWaitStrategy(Wait.forListeningPorts().withStartupTimeout(30000)) // 30 seconds for port listening
      .withStartupTimeout(180000) // 3 minutes total startup timeout
      .start();

    this.iamCommandService = iamCommandService;

    return [iamCommandService];
  }
}
