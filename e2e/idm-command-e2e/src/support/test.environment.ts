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
  public idmCommandApiClient: Axios;

  /**
   * Constructor for TestEnvironment with proxy options.
   * @param proxyOptions - Proxy configuration options.
   */
  constructor(options?: ProductIntegratorEnvironmentOptions) {
    super({
      ...(options ?? {}),
      projectName: 'idm-command-e2e',
      projectVersion: VERSION,
    });
  }

  async stop(): Promise<void> {
    await super.stop();
  }

  protected async initAppContainers(): Promise<Array<StartedTestContainer>> {
    const idmCommandContainer = await new GenericContainer('idm-command')
      .withEnvironment({
        NODE_ENV: 'test',
        APP_PORT: '3000',
        OTEL_ENDPOINT: this.otelEndpoint,
        OTEL_HEADERS: this.otelHeaders,
        OTEL_BATCH_PROCESS_MAX_EXPORT_BATCH_SIZE: '1',
      })
      .withExposedPorts(3000)
      .withWaitStrategy(Wait.forListeningPorts())
      .withLogConsumer(this.createLogConsumer('idm-command'))
      .start();
    this.idmCommandApiClient = axios.create({
      baseURL: `http://${this.internalHost}:${idmCommandContainer.getMappedPort(3000)}`,
    });
    this.idmCommandApiClient.interceptors.request.use(
      this.axiosInterceptor('idm-command')
    );

    return [idmCommandContainer];
  }
}
