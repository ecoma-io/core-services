import {
  HealthDetails,
  ServiceHealthStatus,
  ISuccessResponse,
} from '@ecoma-io/common';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Optional,
} from '@nestjs/common';
import { HEALTH_CHECK_SERVICES } from './health-check.module';
import { HealthChecker } from '@ecoma-io/ddd-common';
import { HttpException } from '../exceptions';
import { NestStandardizedLogger } from '../observability';
import { Span } from 'nestjs-otel';

/**
 * Generic health check controller exposed by the shared health module.
 *
 * @remarks
 * Application modules provide a concrete implementation of {@link HealthCheckService}.
 * Liveness is a lightweight ping; readiness performs deeper dependency checks.
 */
@Controller('health')
export class HealthCheckController {
  private readonly logger = new NestStandardizedLogger({
    context: HealthCheckController.name,
  });

  /**
   * Creates an instance of HealthCheckController.
   *
   * @param healthCheckServices {HealthChecker[]} Injected health check service implementations.
   */
  constructor(
    @Optional()
    @Inject(HEALTH_CHECK_SERVICES)
    private readonly healthCheckServices?: HealthChecker[]
  ) {}

  /**
   * Liveness probe – indicates the process is running and able to respond.
   *
   * @returns {ISuccessResponse} Simple success payload.
   */
  @Get('liveness')
  @HttpCode(HttpStatus.OK)
  @Span()
  liveness(): ISuccessResponse {
    return { message: 'Service still alive' };
  }

  /**
   * Readiness probe – performs deeper dependency checks via the injected health service.
   *
   * @returns {Promise<ISuccessResponse<HealthDetails>>} Aggregated dependency health status.
   */
  @Get('readiness')
  @HttpCode(HttpStatus.OK)
  @Span()
  async readiness(): Promise<ISuccessResponse<HealthDetails>> {
    this.logger.debug('Performing readiness check');
    const data: HealthDetails = {};
    let isUp: boolean;

    if (this.healthCheckServices) {
      const data: HealthDetails = {};

      await Promise.all(
        this.healthCheckServices.map(async (service) => {
          try {
            const status = await service.check();
            data[service.name] = status;
          } catch {
            data[service.name] = ServiceHealthStatus.UNKNOWN;
          }
        })
      );
      isUp = Object.values(data).every(
        (status) => status === ServiceHealthStatus.UP
      );
    } else {
      isUp = true;
    }

    if (isUp) {
      this.logger.debug('Readiness check passed');
      return {
        message: 'Service are readiness',
        data,
      };
    } else {
      throw new HttpException<HealthDetails>(HttpStatus.SERVICE_UNAVAILABLE, {
        message: 'Service is unavailable',
        details: data,
      });
    }
  }
}
