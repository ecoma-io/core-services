import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HealthCheckService } from '@ecoma-io/nestjs-observability';
import {
  SuccessResponse,
  HealthDetails,
  ServiceHealthStatus,
} from '@ecoma-io/common';
import {
  RabbitMqAdapter,
  CheckpointRepositoryImpl,
} from '@ecoma-io/iam-worker-infrastructure';

@Injectable()
export class HealthService extends HealthCheckService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly rabbitAdapter?: RabbitMqAdapter,
    private readonly checkpointRepo?: CheckpointRepositoryImpl
  ) {
    super();
  }

  async check(): Promise<SuccessResponse<HealthDetails>> {
    this.logger.debug('Running projector-service readiness checks');

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

    // RabbitMQ adapter existence
    if (this.rabbitAdapter) {
      details.rabbitmq = ServiceHealthStatus.UP;
    } else {
      details.rabbitmq = ServiceHealthStatus.DOWN;
    }

    // Checkpoint repository sanity (optional)
    if (this.checkpointRepo) {
      try {
        details.checkpoint = ServiceHealthStatus.UP;
      } catch (err) {
        details.checkpoint = ServiceHealthStatus.DOWN;
      }
    }

    const ok = Object.values(details).every(
      (v) => v === ServiceHealthStatus.UP || v === ServiceHealthStatus.UNKNOWN
    );

    return {
      message: ok ? 'Service is ready' : 'Readiness check failed',
      data: details,
    };
  }
}
