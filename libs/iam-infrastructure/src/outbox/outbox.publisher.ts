import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxRepository } from './outbox.repository';
import { RabbitMQEventPublisher } from '../event-publisher/rabbitmq-event.publisher';
import type { OutboxEvent } from './outbox-event.entity';

/**
 * OutboxPublisher
 *
 * Background worker that polls the outbox table and publishes events to RabbitMQ.
 * Implements retry logic with exponential backoff for failed publish attempts.
 *
 * Design:
 * - Polls every 5 seconds for unpublished events
 * - Publishes in batches to RabbitMQ
 * - Retries failed events with exponential backoff
 * - Cleans up old published events daily
 */
@Injectable()
export class OutboxPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisher.name);
  private isPublishing = false;
  private shutdownRequested = false;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly eventPublisher: RabbitMQEventPublisher
  ) {}

  /**
   * Poll for unpublished events every 5 seconds
   */
  @Cron(CronExpression.EVERY_5_SECONDS)
  async publishPendingEvents(): Promise<void> {
    if (this.isPublishing || this.shutdownRequested) {
      return;
    }

    this.isPublishing = true;

    try {
      const unpublished = await this.outboxRepository.fetchUnpublished(100);

      if (unpublished.length === 0) {
        return;
      }

      this.logger.log(`Publishing ${unpublished.length} events from outbox...`);

      const results = await this.publishBatch(unpublished);

      this.logger.log(
        `Published ${results.successful.length} events, ${results.failed.length} failed`
      );

      // Mark successful as published
      if (results.successful.length > 0) {
        await this.outboxRepository.markAsPublished(results.successful);
      }

      // Increment attempts for failed
      for (const failure of results.failed) {
        await this.outboxRepository.incrementAttempts(
          failure.eventId,
          failure.error
        );
      }
    } catch (error) {
      this.logger.error('Error in outbox publisher', error);
    } finally {
      this.isPublishing = false;
    }
  }

  /**
   * Publish a batch of events to RabbitMQ
   *
   * @param events - Outbox events to publish
   * @returns Results with successful and failed event IDs
   */
  private async publishBatch(events: OutboxEvent[]): Promise<{
    successful: string[];
    failed: Array<{ eventId: string; error: Error }>;
  }> {
    const results = {
      successful: [] as string[],
      failed: [] as Array<{ eventId: string; error: Error }>,
    };

    for (const event of events) {
      // Skip events that have exceeded max retry attempts
      if (event.publishAttempts >= 10) {
        this.logger.warn(
          `Event ${event.id} exceeded max retry attempts (10), skipping`
        );
        continue;
      }

      // Apply exponential backoff for retries
      if (event.publishAttempts > 0) {
        const backoffMs = Math.min(
          1000 * Math.pow(2, event.publishAttempts - 1),
          60000 // Max 60 seconds
        );
        const age = Date.now() - event.createdAt.getTime();

        if (age < backoffMs) {
          continue; // Not yet time to retry
        }
      }

      try {
        // Reconstruct domain event from outbox
        const domainEvent = {
          id: event.id,
          type: event.eventType,
          aggregateId: event.aggregateId,
          eventVersion: event.eventVersion,
          payload: event.payload,
          metadata: event.metadata,
          occurredAt: event.occurredAt.toISOString(),
        };

        await this.eventPublisher.publish([domainEvent]);
        results.successful.push(event.id);
      } catch (error) {
        this.logger.error(
          `Failed to publish event ${event.id}: ${error instanceof Error ? error.message : String(error)}`
        );
        results.failed.push({
          eventId: event.id,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    return results;
  }

  /**
   * Clean up old published events (runs daily at 3 AM)
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupPublishedEvents(): Promise<void> {
    try {
      const retentionDays = 7; // Keep published events for 7 days
      const olderThan = new Date();
      olderThan.setDate(olderThan.getDate() - retentionDays);

      const deleted = await this.outboxRepository.deletePublished(olderThan);

      if (deleted > 0) {
        this.logger.log(
          `Cleaned up ${deleted} published events older than ${retentionDays} days`
        );
      }
    } catch (error) {
      this.logger.error('Error cleaning up published events', error);
    }
  }

  /**
   * Graceful shutdown: wait for current publish cycle to complete
   */
  async onModuleDestroy(): Promise<void> {
    this.shutdownRequested = true;

    // Wait for current publish cycle to complete (max 30 seconds)
    const maxWait = 30000;
    const startTime = Date.now();

    while (this.isPublishing && Date.now() - startTime < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (this.isPublishing) {
      this.logger.warn('Forcing shutdown while publish cycle is still running');
    } else {
      this.logger.log('Outbox publisher shut down gracefully');
    }
  }
}
