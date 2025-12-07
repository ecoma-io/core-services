import {
  ProductIntegratorEnvironment,
  ProductIntegratorEnvironmentOptions,
} from '@ecoma-io/project-integrator';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import axios, { Axios } from 'axios';

const VERSION = require('../../../../package.json').version;

/**
 * Test environment class for setting up integration tests with PostgreSQL, MinIO, and service containers.
 * Extends BaseIntegrationEnvironment to provide a configured DataSource and containerized services.
 */
export class TestEnvironment extends ProductIntegratorEnvironment {
  public idmQueryApiClient: Axios;

  /**
   * Constructor for TestEnvironment with proxy options.
   * @param proxyOptions - Proxy configuration options.
   */
  constructor(options?: ProductIntegratorEnvironmentOptions) {
    super({
      ...(options ?? {}),
      projectName: 'idm-query-e2e',
      projectVersion: VERSION,
    });
  }

  async stop(): Promise<void> {
    await super.stop();
  }

  protected async initAppContainers(): Promise<Array<StartedTestContainer>> {
    const idmQueryContainer = await new GenericContainer('idm-query')
      .withEnvironment({
        NODE_ENV: 'test',
        APP_PORT: '3000',
        OTEL_ENDPOINT: this.otelEndpoint,
        OTEL_HEADERS: this.otelHeaders,
        OTEL_BATCH_PROCESS_MAX_EXPORT_BATCH_SIZE: '1',
      })
      .withExposedPorts(3000)
      .withWaitStrategy(Wait.forListeningPorts())
      .withLogConsumer(this.createLogConsumer('idm-query'))
      .start();
    this.idmQueryApiClient = axios.create({
      baseURL: `http://${this.internalHost}:${idmQueryContainer.getMappedPort(3000)}`,
    });
    this.idmQueryApiClient.interceptors.request.use(
      this.axiosInterceptor('idm-query')
    );

    return [idmQueryContainer];
  }
}
