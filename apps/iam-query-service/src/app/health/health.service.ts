import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HealthCheckService } from '@ecoma-io/nestjs-observability';
import {
  SuccessResponse,
  HealthDetails,
  ServiceHealthStatus,
} from '@ecoma-io/common';
import { PermissionCacheRepository } from '@ecoma-io/iam-infrastructure';

@Injectable()
export class HealthService extends HealthCheckService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly permissionCache?: PermissionCacheRepository
  ) {
    super();
  }

  async check(): Promise<SuccessResponse<HealthDetails>> {
    this.logger.debug('Running query-service readiness checks');

    const details: HealthDetails = {};

    // Postgres check
    try {
      await Promise.race([
        this.dataSource.query('SELECT 1'),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error('timeout')), 2000)
        ),
      ] as any);
      details.database = ServiceHealthStatus.UP;
    } catch (err) {
      this.logger.error('Postgres readiness check failed', err as any);
      details.database = ServiceHealthStatus.DOWN;
    }

    // Redis / permission cache check (optional)
    if (this.permissionCache) {
      try {
        const tree = await Promise.race([
          this.permissionCache.getCombinedPermissionsTree(),
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error('timeout')), 1000)
          ),
        ] as any);
        details.redis = tree
          ? ServiceHealthStatus.UP
          : ServiceHealthStatus.UNKNOWN;
      } catch (err) {
        this.logger.warn('Redis readiness check failed', err as any);
        details.redis = ServiceHealthStatus.DOWN;
      }
    }

    const ok = Object.values(details).every(
      (v) => v === ServiceHealthStatus.UP || v === ServiceHealthStatus.UNKNOWN
    );

    if (!ok) {
      return {
        message: 'Readiness check failed',
        data: details,
      };
    }

    return {
      message: 'Service is ready',
      data: details,
    };
  }
}
