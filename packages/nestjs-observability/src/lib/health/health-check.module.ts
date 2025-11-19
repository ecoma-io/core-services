import {
  DynamicModule,
  ForwardReference,
  Module,
  Provider,
  Type,
} from '@nestjs/common';
import { HealthCheckController } from './health-check.controller';
import { HealthCheckService } from './health-check.service';

/**
 * Dynamic health check module.
 *
 * @remarks
 * Consumers must register a concrete {@link HealthCheckService} implementation.
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
    implementation: Type<HealthCheckService>,
    options?: {
      imports?: Array<
        Type<any> | DynamicModule | Promise<DynamicModule> | ForwardReference
      >;
      extras?: Provider[];
    }
  ): DynamicModule {
    return {
      module: HealthCheckModule,
      imports: [...(options?.imports || [])],
      controllers: [HealthCheckController],
      providers: [
        { provide: HealthCheckService, useClass: implementation },
        ...(options?.extras || []),
      ],
      exports: [HealthCheckService],
    };
  }
}
