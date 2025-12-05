/**
 * Configuration options for the integration environment and proxy.
 */
import { ILogger } from './logger.interface';

/**
 * Configuration options for creating and managing an environment used by the integration/hybridize utilities.
 *
 * This interface centralizes settings that affect how containerized upstreams are created, whether
 * network fault-injection (Toxiproxy) is enabled, and which logger instance the environment should use.
 *
 * Properties
 * - id: Optional client-provided identifier for the environment. If omitted, an implementation-generated UUID will be used.
 * - internalHost: The host address used when creating container upstreams (for example, "host.docker.internal").
 * - proxied: When true, the environment will enable and route upstreams through Toxiproxy. Defaults to false.
 * - toxiProxyImage: Optional Docker image (including tag) to run the Toxiproxy service. If omitted, a sensible default image will be selected by the implementation.
 * - logger: Optional ILogger instance used by the environment for structured logging.
 *
 * @remarks
 * Use these options to control environment identity, networking/resolution within container contexts, and whether network fault-injection capabilities
 * (via Toxiproxy) are available for integration tests or local simulations of degraded network conditions.
 *
 * @example
 * // Typical usage
 * const opts: IEnvironmentOptions = {
 *   id: 'integration-env-1',
 *   internalHost: 'host.docker.internal',
 *   proxied: true,
 *   toxiProxyImage: 'shopify/toxiproxy:2.1.4',
 *   logger: myLoggerInstance,
 * };
 *
 * @public
 */
export interface IEnvironmentOptions {
  /** Optional client-provided id for an environment (if omitted a UUID is generated). */
  id?: string;

  /** The internal host address used when creating container upstreams (e.g. 'host.docker.internal'). */
  internalHost: string;

  /** Whether to enable Toxiproxy in the environment. Defaults to `false`. */
  proxied?: boolean;

  /** Optional Docker image for the ToxiProxy service. If omitted a sensible default is used. */
  toxiProxyImage?: string;

  /** Optional logger used by the environment. */
  logger?: ILogger;
}
