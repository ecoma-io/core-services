import { Module } from '@nestjs/common';
import { HealthCheckModule, ObservabilityModule } from '@ecoma-io/nestjs-common';

@Module({
  imports: [HealthCheckModule.register([]), ObservabilityModule],
})
export class HealthModule {}
