import {
  DynamicModule,
  ForwardReference,
  Module,
  Provider,
  Type,
} from '@nestjs/common';
import { HealthCheckController } from './health-check.controller';
import { HealthChecker } from '@ecoma-io/ddd-common';

export const HEALTH_CHECK_SERVICES = 'HEALTH_CHECK_SERVICES';

/**
 * Dynamic health check module.
 *
 * @remarks
 * Consumers must register a concrete {@link HealthChecker} implementation.
 * Provides a generic controller that delegates readiness logic to that service.
 */
@Module({})
export class HealthCheckModule {
  /**
   * Registers the module with a concrete health service class.
   *
   * @param implementation {Type<HealthCheckService>} Concrete service implementing health checks.
   * @returns {DynamicModule} Configured dynamic module instance.
   */
  static register(
    healthChecks?: Type<HealthChecker>[],
    options?: {
      imports?: Array<
        | Type<unknown>
        | DynamicModule
        | Promise<DynamicModule>
        | ForwardReference
      >;
      extras?: Provider[];
    }
  ): DynamicModule {
    healthChecks = healthChecks || [];
    const healthCheckProviders = healthChecks.map((HealthCheckClass) => ({
      provide: HEALTH_CHECK_SERVICES,
      useClass: HealthCheckClass,
    }));

    return {
      module: HealthCheckModule,
      imports: [...(options?.imports || [])],
      controllers: [HealthCheckController],
      providers: [...healthCheckProviders, ...(options?.extras || [])],
    };
  }
}
