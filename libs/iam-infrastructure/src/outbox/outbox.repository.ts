import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEvent } from './outbox-event.entity';
import type { DomainEvent } from '@ecoma-io/domain';

/**
 * OutboxRepository
 *
 * Manages persistence of domain events in the transactional outbox.
 * Provides methods for saving, fetching, and marking events as published.
 */
@Injectable()
export class OutboxRepository {
  private readonly logger = new Logger(OutboxRepository.name);

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly repository: Repository<OutboxEvent>
  ) {}

  /**
   * Save domain events to outbox table transactionally
   *
   * @param events - Domain events to persist
   * @returns Saved outbox events
   */
  async saveEvents(
    events: DomainEvent[],
    aggregateType: string
  ): Promise<OutboxEvent[]> {
    const outboxEvents = events.map((event) => {
      const outboxEvent = new OutboxEvent();
      outboxEvent.id = event.id;
      outboxEvent.aggregateId = event.aggregateId;
      outboxEvent.aggregateType = aggregateType;
      outboxEvent.eventType = event.type;
      outboxEvent.eventVersion = event.eventVersion;
      outboxEvent.payload = event.payload as Record<string, unknown>;
      outboxEvent.metadata = (event.metadata || {}) as Record<string, unknown>;
      outboxEvent.occurredAt = new Date(event.occurredAt);
      outboxEvent.publishedAt = null;
      outboxEvent.publishAttempts = 0;
      outboxEvent.lastError = null;

      return outboxEvent;
    });

    return this.repository.save(outboxEvents);
  }

  /**
   * Fetch unpublished events ordered by creation time
   *
   * @param limit - Maximum number of events to fetch
   * @returns Unpublished outbox events
   */
  async fetchUnpublished(limit = 100): Promise<OutboxEvent[]> {
    return this.repository.find({
      where: { publishedAt: null as unknown as Date },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  /**
   * Mark events as successfully published
   *
   * @param eventIds - IDs of events to mark as published
   */
  async markAsPublished(eventIds: string[]): Promise<void> {
    await this.repository.update(
      { id: { $in: eventIds } as never },
      {
        publishedAt: new Date(),
      }
    );

    this.logger.log(`Marked ${eventIds.length} events as published`);
  }

  /**
   * Increment publish attempts and record error
   *
   * @param eventId - ID of event that failed to publish
   * @param error - Error that occurred
   */
  async incrementAttempts(eventId: string, error: Error): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(OutboxEvent)
      .set({
        publishAttempts: () => 'publish_attempts + 1',
        lastError: error.message,
      })
      .where('id = :eventId', { eventId })
      .execute();
  }

  /**
   * Delete published events older than retention period
   *
   * @param olderThan - Delete events published before this date
   * @returns Number of deleted events
   */
  async deletePublished(olderThan: Date): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(OutboxEvent)
      .where('published_at IS NOT NULL')
      .andWhere('published_at < :olderThan', { olderThan })
      .execute();

    return result.affected ?? 0;
  }

  /**
   * Count unpublished events (for monitoring)
   *
   * @returns Number of unpublished events
   */
  async countUnpublished(): Promise<number> {
    return this.repository.count({
      where: { publishedAt: null as unknown as Date },
    });
  }

  /**
   * Count failed events (publish_attempts > 0 but not published)
   *
   * @returns Number of failed events
   */
  async countFailed(): Promise<number> {
    return this.repository
      .createQueryBuilder('outbox')
      .where('outbox.published_at IS NULL')
      .andWhere('outbox.publish_attempts > 0')
      .getCount();
  }
}
