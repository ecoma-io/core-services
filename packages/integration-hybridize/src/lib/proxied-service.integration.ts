/**
 * Represents a network service with host and port configuration.
 */
export interface Service {
  /** The hostname or IP address of the service. */
  readonly host: string;
  /** The port number on which the service is listening. */
  readonly port: number;
}

/**
 * Extends Service with Toxiproxy-specific capabilities for chaos engineering.
 * Allows injecting network toxics and toggling proxy state.
 */
export interface ProxiedService extends Service {
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
