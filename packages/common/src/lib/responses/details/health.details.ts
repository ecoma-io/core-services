import { Dict } from '../../utils';

/**
 * Service health status values.
 *
 * @remarks
 * This enum is intentionally string-valued so it serializes cleanly in JSON
 * diagnostics and logs. Use these values when reporting or aggregating
 * service health across the system.
 */
export enum ServiceHealthStatus {
  /** Service is healthy and responding. */
  UP = 'up',
  /** Service is known to be unhealthy or failing. */
  DOWN = 'down',
  /** Service health is unknown or not yet determined. */
  UNKNOWN = 'unknown',
}

/**
 * Mapping of service identifiers to their current {@link ServiceHealthStatus}.
 *
 * @remarks
 * This is a plain dictionary used for lightweight health payloads shared
 * between services and monitoring tooling.
 */
export type HealthDetails = Dict<ServiceHealthStatus>;
