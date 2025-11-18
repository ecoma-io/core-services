import { BaseIntegrationEnvironment } from '@ecoma-io/integration-environment';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { ProxyOptions } from '@ecoma-io/integration-hybridize';

export class ProjectorTestEnvironment extends BaseIntegrationEnvironment {
  public dataSource!: DataSource;
  public redis!: Redis;
  private iamCommandService!: StartedTestContainer;
  private iamProjectorWorker!: StartedTestContainer;

  constructor(proxyOptions: ProxyOptions | boolean = true) {
    super({ internalHost: '172.168.186.168', proxy: proxyOptions });
  }

  get commandServiceContainer(): StartedTestContainer {
    return this.iamCommandService;
  }

  get projectorWorkerContainer(): StartedTestContainer {
    return this.iamProjectorWorker;
  }

  protected async initAppContainers(): Promise<Array<StartedTestContainer>> {
    const {
      host: dbHost,
      port: dbPort,
      databaseName,
      dataSource,
    } = await this.getPostgres();
    this.dataSource = dataSource;
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

    // Shared base env for both services
    const baseEnv = {
      NODE_ENV: 'test',
      HOST: '0.0.0.0',
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

    const iamCommandService = await new GenericContainer('iam-command-service')
      .withEnvironment({
        ...baseEnv,
        PORT: '3000',
      })
      .withExposedPorts(3000)
      .withLogConsumer(this.createLogConsumer('iam-command-service'))
      .withWaitStrategy(Wait.forListeningPorts().withStartupTimeout(60000))
      .withStartupTimeout(180000)
      .start();

    const iamProjectorWorker = await new GenericContainer(
      'iam-projector-worker'
    )
      .withEnvironment({
        ...baseEnv,
        PORT: '3001',
      })
      .withLogConsumer(this.createLogConsumer('iam-projector-worker'))
      // Match the actual log emitted in apps/iam-projector-worker/src/main.ts
      .withWaitStrategy(
        Wait.forLogMessage(
          /IAM Projector Worker initialized/i
        ).withStartupTimeout(60000)
      )
      .withStartupTimeout(180000)
      .start();

    this.iamCommandService = iamCommandService;
    this.iamProjectorWorker = iamProjectorWorker;
    return [iamCommandService, iamProjectorWorker];
  }

  async pollTenantRow(
    tenantId: string,
    timeoutMs = 5000,
    intervalMs = 250
  ): Promise<{
    tenant_id: string;
    namespace: string;
    metadata: unknown;
  } | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const rows = (await this.dataSource.query(
        'SELECT tenant_id, namespace, metadata FROM tenants_read_model WHERE tenant_id = $1',
        [tenantId]
      )) as Array<{ tenant_id: string; namespace: string; metadata: unknown }>;
      if (rows.length > 0) return rows[0];
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return null;
  }
}
