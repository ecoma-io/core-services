import {
  StartedToxiProxyContainer,
  ToxiProxyContainer,
} from '@testcontainers/toxiproxy';
import { StartedTestContainer } from 'testcontainers';
import { Readable } from 'stream';
import { uuidv7 } from 'uuidv7';
import { ILogger } from './logger.interface';
import { IProxiedService, IService } from './service.interface';
import { IEnvironmentOptions } from './environment-options.interface';
import LogHandler from './log-handler';
import ServiceFactory from './service-factory';

/**
 * Abstract base class for managing integration test environments with containerized services and optional proxying capabilities.
 * Provides utilities for starting and stopping containers, logging, and creating services (proxied or direct) for testing.
 */
export abstract class IntegrationEnvironment {
  /** Unique identifier for this integration environment instance. */
  public readonly id: string;

  /** The internal host address used for container networking. */
  public readonly internalHost: string;

  /** Containers started for this environment which must be stopped during cleanup. */
  protected readonly containersToStop: StartedTestContainer[] = [];

  /** The started ToxiProxy container used for proxying services, if enabled. */
  protected proxy?: StartedToxiProxyContainer;

  /** Whether proxying is enabled. Defaults to false. */
  protected readonly enableProxy: boolean = false;

  /** The Docker image for ToxiProxy (defaulted for headless testing). */
  protected readonly toxyProxyImage: string =
    'ghcr.io/shopify/toxiproxy:2.12.0';
  protected readonly logger?: ILogger;
  protected readonly logHandler: LogHandler;

  /**
   * Create a new IntegrationEnvironment.
   * @param options - Configuration options for the environment instance.
   * @remarks If `options.id` is omitted a new UUID is generated. `proxied` toggles Toxiproxy integration.
   */
  constructor(options: IEnvironmentOptions) {
    // allow a client-provided id or generate a UUID
    this.id = options.id ?? uuidv7();
    this.internalHost = options.internalHost;

    // configure proxy support and override default image if provided
    if (options.proxied === true) {
      // assign to the protected field defined with a default of false
      // ts allows assignment to readonly in constructor
      (this as unknown as { enableProxy: boolean }).enableProxy = true;
    }

    if (options.toxiProxyImage) {
      (this as unknown as { toxyProxyImage: string }).toxyProxyImage =
        options.toxiProxyImage;
    }

    this.logger = options.logger;

    // initialize the log handler (uses abstract formatLogMessage)
    (this as unknown as { logHandler: LogHandler }).logHandler = new LogHandler(
      this.logger,
      this.formatLogMessage.bind(this),
      this.id
    );
  }

  /**
   * Starts the integration environment by initializing the ToxiProxy container (if enabled) and application containers.
   * @returns {Promise<void>} A promise that resolves when all containers are started.
   * @remarks This method sets up the proxy (if enabled) and collects all app containers for later cleanup.
   */
  async start(): Promise<void> {
    this.logger?.info(
      `Starting Integration Environment #${this.id}. Proxy Enabled: ${this.enableProxy ?? false}`
    );
    if (this.enableProxy) {
      // createToxiProxy() is a protected factory so tests can inject a fake instance
      this.proxy = await new ToxiProxyContainer(this.toxyProxyImage)
        .withLogConsumer(this.logHandler.createLogConsumer('toxiproxy'))
        .start();
    }
    const appContainers = await this.initAppContainers();
    this.containersToStop.push(...appContainers);
    this.logger?.debug(`Integration Environment #${this.id} started`);
  }

  /**
   * Abstract method to initialize and start application-specific containers.
   * @returns {Promise<StartedTestContainer[]>} A promise that resolves to an array of started containers.
   * @remarks Subclasses must implement this to define their specific containers.
   */
  protected abstract initAppContainers(): Promise<Array<StartedTestContainer>>;

  /**
   * Stops all started containers and performs cleanup.
   * @returns {Promise<void>} A promise that resolves when all containers are stopped.
   * @remarks Attempts to stop all containers with volume and image removal. Logs errors if stopping fails.
   */
  async stop(): Promise<void> {
    this.logger?.debug(`Stopping Integration Environment #${this.id}`);
    const options = { removeVolumes: true, remove: true };
    try {
      await Promise.all(
        this.containersToStop.map((container) => container.stop(options))
      );
    } catch (error) {
      this.logger?.error(`Error stopping containers: ${error}`);
      throw error;
    }
    this.logger?.verbose(`Integration Environment #${this.id} stopped`);
  }

  /**
   * Creates a log consumer function to uniformly handle and log output from containers.
   * @param {string} containerName - The name of the container for logging purposes.
   * @returns {(stream: Readable) => void} A function that consumes log streams and logs messages.
   * @remarks The returned function listens for 'data' and 'err' events on the stream, converting buffers to strings.
   */
  protected createLogConsumer(
    containerName: string
  ): (stream: Readable) => void {
    return this.logHandler.createLogConsumer(containerName);
  }

  protected abstract formatLogMessage(
    streamType: 'stdout' | 'stderr',
    message: object
  ): {
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    message: object;
  };

  /**
   * Creates a proxied or direct service by delegating to `ServiceFactory`.
   */
  protected async createService(
    name: string,
    port: string | number
  ): Promise<IService | IProxiedService> {
    const factory = new ServiceFactory(
      this.internalHost,
      this.enableProxy,
      this.proxy
    );
    return factory.createService(name, port);
  }
}
