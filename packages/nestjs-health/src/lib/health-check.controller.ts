import { HealthDetails, SuccessResponse } from '@ecoma-io/common';
import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { HealthCheckService } from './health-check.service';

/**
 * Generic health check controller exposed by the shared health module.
 *
 * @remarks
 * Application modules provide a concrete implementation of {@link HealthCheckService}.
 * Liveness is a lightweight ping; readiness performs deeper dependency checks.
 */
@Controller('health')
export class HealthCheckController {
  /**
   * Creates an instance of HealthCheckController.
   *
   * @param healthService - The health check service to delegate readiness checks to.
   */
  constructor(private readonly healthService: HealthCheckService) {}

  /**
   * Liveness probe – indicates the process is running and able to respond.
   *
   * @returns {SuccessResponse} Simple success payload.
   */
  @Get('liveness')
  @HttpCode(HttpStatus.OK)
  liveness(): SuccessResponse {
    return { message: 'Service still alive' };
  }

  /**
   * Readiness probe – performs deeper dependency checks via the injected health service.
   *
   * @returns {Promise<SuccessResponse<HealthDetails>>} Aggregated dependency health status.
   */
  @Get('readiness')
  @HttpCode(HttpStatus.OK)
  readiness(): Promise<SuccessResponse<HealthDetails>> {
    return this.healthService.check();
  }
}
