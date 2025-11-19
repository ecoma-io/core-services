import {
  StartedToxiProxyContainer,
  ToxiProxyContainer,
} from '@testcontainers/toxiproxy';
import { StartedTestContainer } from 'testcontainers';
import { Readable } from 'stream';
import { uuidv7 } from 'uuidv7';
import { ProxiedService, Service } from './proxied-service.integration';

/**
 * Configuration options for the proxy.
 */
export interface ProxyOptions {
  /** Whether to enable proxying. Defaults to true if ProxyOptions is provided. */
  enabled?: boolean;
  /** The Docker image for ToxiProxy. */
  image?: string;
}

/**
 * Abstract base class for managing integration test environments with containerized services and optional proxying capabilities.
 * Provides utilities for starting and stopping containers, logging, and creating services (proxied or direct) for testing.
 */
export abstract class IntegrationEnvironment {
  /** Unique identifier for this integration environment instance. */
  public readonly id: string;

  /** List of started containers that need to be stopped during cleanup. */
  private containersToStop: StartedTestContainer[] = [];

  /** The started ToxiProxy container used for proxying services, if enabled. */
  private proxy?: StartedToxiProxyContainer;

  /** Whether proxying is enabled. */
  private readonly enableProxy: boolean;

  /** The Docker image for ToxiProxy. */
  private readonly toxyProxyImage: string;

  /**
   * Constructs a new IntegrationEnvironment instance.
   * @param {string} internalHost - The internal host address for upstream services.
   * @param {ProxyOptions | boolean | undefined} proxyOptions - Proxy configuration. Can be a boolean to enable/disable, an object for custom settings, or undefined for defaults.
   */
  constructor(
    protected readonly internalHost: string,
    proxyOptions?: ProxyOptions | boolean
  ) {
    this.id = uuidv7();

    // Determine enableProxy and image based on proxyOptions
    if (proxyOptions === undefined) {
      this.enableProxy = true;
      this.toxyProxyImage = 'ghcr.io/shopify/toxiproxy:2.12.0';
    } else if (typeof proxyOptions === 'boolean') {
      this.enableProxy = proxyOptions;
      this.toxyProxyImage = 'ghcr.io/shopify/toxiproxy:2.12.0';
    } else {
      this.enableProxy = proxyOptions.enabled ?? true;
      this.toxyProxyImage =
        proxyOptions.image ?? 'ghcr.io/shopify/toxiproxy:2.12.0';
    }
  }

  /**
   * Starts the integration environment by initializing the ToxiProxy container (if enabled) and application containers.
   * @returns {Promise<void>} A promise that resolves when all containers are started.
   * @remarks This method sets up the proxy (if enabled) and collects all app containers for later cleanup.
   */
  async start(): Promise<void> {
    this.log('info', `Starting Integration Environment [${this.id}]`);
    if (this.enableProxy) {
      this.proxy = await new ToxiProxyContainer(this.toxyProxyImage)
        .withLogConsumer(this.createLogConsumer('toxiproxy'))
        .start();
    }
    const appContainers = await this.initAppContainers();
    this.containersToStop.push(...appContainers);
    this.log('info', `Integration Environment [${this.id}] started`);
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
    this.log('info', `Stopping Integration Environment [${this.id}]`);
    const options = { removeVolumes: true, remove: true };
    try {
      await Promise.all(
        this.containersToStop.map((container) => container.stop(options))
      );
    } catch (error) {
      this.log('error', `Error stopping containers: ${error}`);
    }
    this.log('info', `Integration Environment [${this.id}] stopped`);
  }

  /**
   * Creates a log consumer function to uniformly handle and log output from containers.
   * @param {string} containerName - The name of the container for logging purposes.
   * @returns {(stream: Readable) => void} A function that consumes log streams and logs messages.
   * @remarks The returned function listens for 'data' and 'err' events on the stream, converting buffers to strings.
   */
  protected createLogConsumer(containerName: string) {
    return (stream: Readable) => {
      stream.on('data', (line: Buffer) =>
        this.containerLog('info', containerName, line.toString())
      );
      stream.on('err', (line: Buffer) =>
        this.containerLog('error', containerName, line.toString())
      );
    };
  }

  /**
   * Logs a message prefixed with the environment ID and container name.
   * @param {'error' | 'info'} level - The log level.
   * @param {string} containerName - The name of the container.
   * @param {string} message - The log message content.
   * @remarks Delegates to the public log method with formatted message.
   */
  protected containerLog(
    level: 'error' | 'info',
    containerName: string,
    message: string
  ) {
    this.log(level, `[${this.id}] [${containerName}] ${message}`);
  }

  /**
   * Logs a message to stdout using the specified level.
   * @param {'error' | 'info' | 'warn' | 'debug'} level - The log level.
   * @param {string} message - The log message content.
   * @remarks Uses console methods directly for logging.
   */
  public log(level: 'error' | 'info' | 'warn' | 'debug', message: string) {
    // eslint-disable-next-line no-console
    console[level](`${message}`);
  }

  /**
   * Creates a proxied service using the ToxiProxy container.
   * @param {string} name - The name of the proxy.
   * @param {string} portEnvVar - The environment variable or value for the upstream port.
   * @returns {Promise<Service | ProxiedService>} A promise that resolves to a Service or ProxiedService object.
   * @remarks Configures the proxy with the internal host and port, returning an object with host, port, and control methods.
   */
  protected async createService(
    name: string,
    portEnvVar: string
  ): Promise<Service | ProxiedService> {
    if (this.enableProxy && this.proxy) {
      const proxy = await this.proxy.createProxy({
        name,
        upstream: `${this.internalHost}:${portEnvVar}`,
      });
      return {
        host: this.internalHost,
        port: proxy.port,
        addToxic: proxy.instance.addToxic.bind(proxy.instance),
        setEnabled: proxy.setEnabled,
      } as ProxiedService;
    } else {
      // Direct connection without proxy
      return {
        host: this.internalHost,
        port: parseInt(portEnvVar, 10), // Assume portEnvVar is a port number string
      };
    }
  }
}
