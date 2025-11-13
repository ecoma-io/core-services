import { SuccessResponse, HealthDetails } from '@ecoma-io/common';

/**
 * Abstract base service contract for health checks.
 *
 * @remarks
 * Concrete implementations (in application code) should perform dependency
 * checks (databases, caches, external services) and return a unified
 * {@link SuccessResponse} containing {@link HealthDetails}. Throw an
 * HttpException (custom project exceptions) if the service is not ready.
 */
export abstract class HealthCheckService {
  /**
   * Executes a readiness health check.
   *
   * @returns {Promise<SuccessResponse<HealthDetails>>} A promise resolving to the health details when ready.
   */
  abstract check(): Promise<SuccessResponse<HealthDetails>>;
}
