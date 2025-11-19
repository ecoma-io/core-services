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
  EventStoreDbRepository,
  OutboxRepository,
  RabbitMQEventPublisher,
} from '@ecoma-io/iam-infrastructure';

@Injectable()
export class HealthService extends HealthCheckService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly esRepo: EventStoreDbRepository,
    private readonly outboxRepo: OutboxRepository,
    private readonly publisher?: RabbitMQEventPublisher
  ) {
    super();
  }

  async check(): Promise<SuccessResponse<HealthDetails>> {
    this.logger.debug('Running command-service readiness checks');
    const details: HealthDetails = {};

    // Postgres / Outbox DB
    try {
      await Promise.race([
        this.dataSource.query('SELECT 1'),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error('timeout')), 2000)
        ),
      ] as any);
      // also touch outbox repository to ensure migrations/tables present
      try {
        await this.outboxRepo.countUnpublished();
        details.outbox = ServiceHealthStatus.UP;
      } catch (err) {
        this.logger.warn('Outbox check failed', err as any);
        details.outbox = ServiceHealthStatus.DOWN;
      }
      details.database = ServiceHealthStatus.UP;
    } catch (err) {
      this.logger.error('Database readiness check failed', err as any);
      details.database = ServiceHealthStatus.DOWN;
    }

    // EventStore check
    try {
      // attempt to read a non-existing stream to validate connectivity
      await Promise.race([
        this.esRepo.loadStreamVersion('health-check-stream'),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error('timeout')), 2000)
        ),
      ] as any);
      details.eventstore = ServiceHealthStatus.UP;
    } catch (err) {
      this.logger.warn('EventStore readiness check failed', err as any);
      details.eventstore = ServiceHealthStatus.DOWN;
    }

    // RabbitMQ publisher existence (best-effort)
    if (this.publisher) {
      try {
        details.rabbitmq = ServiceHealthStatus.UP;
      } catch (err) {
        details.rabbitmq = ServiceHealthStatus.DOWN;
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
