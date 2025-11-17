import {
  HealthDetails,
  SuccessResponse,
  ServiceHealthStatus,
} from '@ecoma-io/common';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HttpException } from '@ecoma-io/nestjs-exceptions';
import { S3Client } from '@ecoma-io/nestjs-s3';
import * as S3 from '@aws-sdk/client-s3';
import { HealthCheckService } from '@ecoma-io/nestjs-health';

/**
 * Service responsible for performing health checks on the application's dependencies,
 * including the database and storage (S3).
 */
@Injectable()
export class HealthService extends HealthCheckService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @S3Client() private readonly s3: S3.S3Client
  ) {
    super();
  }

  /**
   * Performs a comprehensive health check by verifying the status of the database and S3 storage.
   * @remarks This method checks both dependencies concurrently and returns a success response if both are up,
   * or throws an exception if either is down.
   * @returns {Promise<SuccessResponse<HealthDetails>>} A promise resolving to a success response containing health details.
   * @throws {HttpException<HealthDetails>} If either the database or storage is unavailable.
   */
  async check(): Promise<SuccessResponse<HealthDetails>> {
    this.logger.debug('Checking health...');
    const timeoutMs = 2000;

    // Perform health checks concurrently for database and storage
    const [databaseIsUp, storageIsUp] = await Promise.all([
      this.pingDatabase(timeoutMs),
      this.pingS3(timeoutMs),
    ]);

    const details: HealthDetails = {
      database: databaseIsUp
        ? ServiceHealthStatus.UP
        : ServiceHealthStatus.DOWN,
      storage: storageIsUp ? ServiceHealthStatus.UP : ServiceHealthStatus.DOWN,
    };

    if (databaseIsUp && storageIsUp) {
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

  /**
   * Pings the S3 storage to verify connectivity within a specified timeout.
   * @param {number} timeoutMs - The maximum time in milliseconds to wait for the ping to complete.
   * @returns {Promise<boolean>} A promise resolving to true if S3 is reachable, false otherwise.
   */
  private async pingS3(timeoutMs: number): Promise<boolean> {
    this.logger.debug('Pinging S3...');
    try {
      await Promise.race([
        this.s3.send(new S3.ListBucketsCommand()),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeoutMs)
        ),
      ]);
      this.logger.debug('S3 ping successful');
      return true;
    } catch (error) {
      this.logger.error('S3 ping failed', (error as Error).stack);
      return false;
    }
  }

  /**
   * Pings the database to verify connectivity within a specified timeout.
   * @param {number} timeoutMs - The maximum time in milliseconds to wait for the ping to complete.
   * @returns {Promise<boolean>} A promise resolving to true if the database is reachable, false otherwise.
   */
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
