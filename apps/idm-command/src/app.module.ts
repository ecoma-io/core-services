import { Module } from '@nestjs/common';
import { HealthModule } from '@ecoma-io/idm-command-adapter';
@Module({
  imports: [HealthModule],
})
export class AppModule {}
