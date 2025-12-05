/**
 * Represents a network service with host and port configuration.
 */
export interface IService {
  /** The hostname or IP address of the service. */
  readonly host: string;
  /** The port number on which the service is listening. */
  readonly port: number;
}

/**
 * Extends IService with Toxiproxy-specific capabilities for chaos engineering.
 * Allows injecting network toxics and toggling proxy state.
 */
/**
 * Represents a service that is routed through a controllable proxy so callers can simulate
 * network conditions and enable/disable traffic for testing and resilience validation.
 *
 * @remarks
 * This interface extends IService and adds runtime controls for a proxied service:
 * - addToxic: injects a controllable "toxic" into the proxy to simulate network behaviors
 *   such as added latency, bandwidth limits, connection errors, or slow closes.
 * - setEnabled: toggles whether the proxy forwards traffic for the service.
 *
 * Common toxic types and typical attribute shapes (implementation-specific):
 * - "latency": { latency: number, jitter?: number } — latency and optional jitter in milliseconds.
 * - "bandwidth": { rate: number } — throughput limit in bytes per second.
 * - "slow_close": { delay: number } — delay in milliseconds applied when closing connections.
 *
 * Notes:
 * - The attributes parameter is treated as read-only by callers; the exact accepted keys and
 *   semantics depend on the underlying proxy provider.
 * - Toxic names must be unique per proxied service; adding a toxic with an existing name may
 *   replace or reject the existing toxic depending on provider semantics.
 * - setEnabled(false) is expected to block or drop traffic while preserving configured toxics,
 *   so re-enabling restores the previously configured conditions.
 * - All operations return Promises and will reject with provider-specific errors on failure
 *   (e.g., validation errors, connectivity issues, or unsupported toxic types).
 *
 * @example
 * // Add downstream latency and enable traffic
 * await proxiedService.addToxic('sim-latency', 'latency', { latency: 250, jitter: 20 }, 'downstream');
 * await proxiedService.setEnabled(true);
 *
 * @public
 * @extends IService
 */
export interface IProxiedService extends IService {
  /**
   * Adds a toxic to simulate network conditions (latency, bandwidth limits, etc.).
   *
   * @param name - Unique identifier for the toxic.
   * @param type - Type of toxic (e.g., 'latency', 'bandwidth', 'slow_close').
   * @param attributes - Configuration parameters specific to the toxic type.
   * @param stream - Direction of traffic ('upstream' or 'downstream'). Defaults to 'downstream'.
   * @returns Promise resolving to the created toxic object.
   */
  addToxic: (
    name: string,
    type: string,
    attributes: Readonly<Record<string, unknown>>,
    stream?: 'upstream' | 'downstream'
  ) => Promise<unknown>;

  /**
   * Enables or disables the proxy, controlling traffic flow.
   *
   * @param enabled - `true` to allow traffic, `false` to block all traffic.
   * @returns Promise resolving when the state change is applied.
   */
  setEnabled: (enabled: boolean) => Promise<unknown>;
}
