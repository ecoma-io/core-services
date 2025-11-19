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
  private iamQueryService: StartedTestContainer;
  private iamProjectorWorker: StartedTestContainer;
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
   * Gets the command service exposed port.
   */
  public get commandServicePort(): number {
    return this.iamCommandService.getMappedPort(3000);
  }

  /**
   * Gets the query service exposed port.
   */
  public get queryServicePort(): number {
    return this.iamQueryService.getMappedPort(3001);
  }

  /**
   * Initializes and starts the required application containers for the test environment.
   * Sets up PostgreSQL, Redis, EventStore, RabbitMQ, and IAM command service containers.
   * @returns {Promise<Array<StartedTestContainer>>} A promise that resolves to an array of started test containers.
   * @remarks This method configures environment variables for each container, applies wait strategies for readiness,
   * and ensures the DataSource is available for database operations. All services are proxied via ToxiProxy for resilience testing.
   */
  protected async initAppContainers(): Promise<Array<StartedTestContainer>> {
    // Retrieve PostgreSQL configuration and DataSource
    const {
      host: dbHost,
      port: dbPort,
      databaseName,
      dataSource,
    } = await this.getPostgres();
    this.dataSource = dataSource;

    // ...existing code...

    // Retrieve service configurations sequentially to avoid ToxiProxy port conflicts
    const { host: cacheHost, port: cachePort, redis } = await this.getRedis();
    this.redis = redis;

    const {
      host: esdbHost,
      port: esdbPort,
      streamPrefix: esdbStreamPrefix,
    } = await this.getEventStoreDB();

    const {
      host: mqHost,
      port: mqPort,
      vhost: mqVhost,
    } = await this.getRabbitMQ();

    // ...existing code...

    const serviceEnv = {
      NODE_ENV: 'test',
      PORT: '3000',
      HOST: '0.0.0.0',
      // Connect via ToxiProxy (exposed host/port)
      DB_HOST: dbHost,
      DB_PORT: dbPort.toString(),
      DB_DATABASE: databaseName,
      DB_USERNAME: process.env['POSTGRES_USERNAME'] || '',
      DB_PASSWORD: process.env['POSTGRES_PASSWORD'] || '',
      CACHE_HOST: cacheHost,
      CACHE_PORT: cachePort.toString(),
      CACHE_PASSWORD: process.env['REDIS_PASSWORD'] || '',
      CACHE_DB: '0',
      ESDB_HOST: esdbHost,
      ESDB_PORT: esdbPort.toString(),
      ESDB_USERNAME: process.env['EVENTSTOREDB_USERNAME'] || '',
      ESDB_PASSWORD: process.env['EVENTSTOREDB_PASSWORD'] || '',
      EVENTSTORE_CONNECTION_STRING: `esdb://${esdbHost}:${esdbPort}?tls=false&streamPrefix=${encodeURIComponent(esdbStreamPrefix)}`,
      MQ_HOST: mqHost,
      MQ_PORT: mqPort.toString(),
      MQ_USERNAME: process.env['RABBITMQ_USERNAME'] || '',
      MQ_PASSWORD: process.env['RABBITMQ_PASSWORD'] || '',
      MQ_EXCHANGE: 'iam.events',
      MQ_URI: `amqp://${process.env['RABBITMQ_USERNAME']}:${process.env['RABBITMQ_PASSWORD']}@${mqHost}:${mqPort}/${encodeURIComponent(mqVhost)}`,
    };

    // ...existing code...

    const iamCommandService = await new GenericContainer('iam-command')
      .withEnvironment(serviceEnv)
      .withExposedPorts(3000)
      .withLogConsumer(this.createLogConsumer('iam-command'))
      .withWaitStrategy(Wait.forListeningPorts().withStartupTimeout(60000)) // 60 seconds for port listening
      .withStartupTimeout(180000) // 3 minutes total startup timeout
      .start();

    this.iamCommandService = iamCommandService;

    // Start IAM Query Service (read side)
    const queryServiceEnv = {
      ...serviceEnv,
      PORT: '3001', // Different port for query service
    };

    const iamQueryService = await new GenericContainer('iam-query')
      .withEnvironment(queryServiceEnv)
      .withExposedPorts(3001)
      .withLogConsumer(this.createLogConsumer('iam-query'))
      .withWaitStrategy(Wait.forListeningPorts().withStartupTimeout(60000))
      .withStartupTimeout(180000)
      .start();

    this.iamQueryService = iamQueryService;

    // Start IAM Projector Worker (event consumer)
    const iamProjectorWorker = await new GenericContainer(
      'iam-projector-worker'
    )
      .withEnvironment(serviceEnv) // Uses same env as command service
      .withLogConsumer(this.createLogConsumer('iam-projector-worker'))
      .withWaitStrategy(
        Wait.forLogMessage(
          /IAM Projector Worker initialized/i
        ).withStartupTimeout(60000)
      )
      .withStartupTimeout(180000)
      .start();

    this.iamProjectorWorker = iamProjectorWorker;

    return [iamCommandService, iamQueryService, iamProjectorWorker];
  }
}
