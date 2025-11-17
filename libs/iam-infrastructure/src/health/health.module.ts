import { Module } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthCheckModule } from '@ecoma-io/nestjs-health';

@Module({
  imports: [HealthCheckModule.register(HealthService)],
  providers: [HealthService],
  exports: [HealthCheckModule, HealthService],
})
export class HealthModule {}
