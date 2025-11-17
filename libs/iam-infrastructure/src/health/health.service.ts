import {
  HealthDetails,
  SuccessResponse,
  ServiceHealthStatus,
} from '@ecoma-io/common';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HttpException } from '@ecoma-io/nestjs-exceptions';
import { HealthCheckService } from '@ecoma-io/nestjs-health';

@Injectable()
export class HealthService extends HealthCheckService {
  private readonly logger = new Logger(HealthService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async check(): Promise<SuccessResponse<HealthDetails>> {
    this.logger.debug('Checking health...');
    const timeoutMs = 2000;
    const databaseIsUp = await this.pingDatabase(timeoutMs);
    const details: HealthDetails = {
      database: databaseIsUp
        ? ServiceHealthStatus.UP
        : ServiceHealthStatus.DOWN,
    };
    if (databaseIsUp) {
      this.logger.debug('Health check passed');
      return {
        message: 'Service is ready',
        data: details,
      };
    } else {
      this.logger.error('Health check failed');
      throw new HttpException<HealthDetails>(HttpStatus.SERVICE_UNAVAILABLE, {
        message: 'Service is not ready',
        details,
      });
    }
  }

  private async pingDatabase(timeoutMs: number): Promise<boolean> {
    this.logger.debug('Pinging database...');
    if (!this.dataSource?.isInitialized) {
      this.logger.warn('Datasource is not initialized');
      return false;
    }
    try {
      await Promise.race([
        this.dataSource.query('SELECT 1'),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeoutMs)
        ),
      ]);
      this.logger.debug('Database ping successful');
      return true;
    } catch (error) {
      this.logger.error('Database ping failed', (error as Error).stack);
      return false;
    }
  }
}
