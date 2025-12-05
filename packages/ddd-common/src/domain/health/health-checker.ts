import { ServiceHealthStatus } from '@ecoma-io/common';

// The abstract class represents the contract (Domain Concept)
export abstract class HealthChecker {
  /**
   * The unique name or identifier for the dependency being checked.
   */
  abstract readonly name: string;

  /**
   * Executes the health check for the specific dependency.
   * @returns A promise that resolves to the health status of the dependency.
   */
  abstract check(): Promise<ServiceHealthStatus>;
}
