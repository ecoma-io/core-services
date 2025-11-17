import { Module } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthCheckModule } from '@ecoma-io/nestjs-health';

/**
 * Module for health-related endpoints in the resource service.
 *
 * @remarks
 * This module encapsulates the health check functionality, providing controllers
 * and services to monitor the application's health status.
 */
@Module({
  imports: [HealthCheckModule.register(HealthService)],
})
export class HealthModule {}
