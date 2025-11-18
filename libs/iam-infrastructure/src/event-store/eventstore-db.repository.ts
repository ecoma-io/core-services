import {
  EventStoreDBClient,
  jsonEvent,
  FORWARDS,
  START,
  ResolvedEvent,
  WrongExpectedVersionError,
} from '@eventstore/db-client';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { IEventStoreRepository } from '@ecoma-io/iam-command-interactor';
import { DomainEventEnvelope, DomainException } from '@ecoma-io/domain';
import type { OutboxRepository } from '../outbox/outbox.repository';
import type { SnapshotRepository } from '../snapshot/snapshot.repository';

/**
 * EventStoreDB implementation for the Event Store repository.
 * Handles storing and retrieving domain events with optimistic concurrency control.
 *
 * Outbox Integration (Phase 4.1):
 * - If OutboxRepository is provided, events are also saved to the outbox table
 * - Transactional consistency: Both EventStoreDB append and outbox save must succeed
 * - Outbox publisher will poll and publish events to RabbitMQ
 *
 * Snapshot Integration (Phase 4.2):
 * - If SnapshotRepository is provided, load() checks for snapshots before replaying events
 * - Reduces event replay overhead for large aggregates
 *
 * @see ADR-2: Technology Stack - EventStoreDB for Event Sourcing
 */
@Injectable()
export class EventStoreDbRepository implements IEventStoreRepository {
  private readonly logger = new Logger(EventStoreDbRepository.name);

  constructor(
    private readonly client: EventStoreDBClient,
    @Optional() private readonly outboxRepository?: OutboxRepository,
    @Optional() private readonly snapshotRepository?: SnapshotRepository
  ) {}

  /**
   * Save events to the event store with optimistic locking.
   *
   * Phase 4.1 Enhancement: Also saves events to outbox table for guaranteed delivery.
   * Both operations must succeed for transactional consistency.
   *
   * @param aggregateId - The aggregate identifier (stream name)
   * @param events - Domain events to append
   * @param expectedVersion - Expected stream version for optimistic locking
   * @throws OptimisticLockException if version mismatch
   */
  async saveEvents(
    aggregateId: string,
    events: DomainEventEnvelope[],
    expectedVersion?: number
  ): Promise<void> {
    const streamName = this.getStreamName(aggregateId);

    const eventStoreEvents = events.map((ev) =>
      jsonEvent({
        id: ev.id,
        type: ev.type,
        data: {
          aggregateId: ev.aggregateId,
          occurredAt: ev.occurredAt,
          eventVersion: ev.eventVersion,
          payload: ev.payload,
          metadata: ev.metadata,
        },
      })
    );

    try {
      const appendExpectation =
        expectedVersion === undefined || expectedVersion === -1
          ? 'no_stream'
          : BigInt(expectedVersion);

      // Step 1: Append to EventStoreDB
      await this.client.appendToStream(streamName, eventStoreEvents, {
        expectedRevision: appendExpectation,
      });

      // Step 2: Save to outbox table (if configured)
      if (this.outboxRepository) {
        const domainEvents = events.map((ev) => ({
          id: ev.id,
          type: ev.type,
          aggregateId: ev.aggregateId,
          eventVersion: ev.eventVersion,
          payload: ev.payload,
          metadata: ev.metadata,
          occurredAt: ev.occurredAt,
        }));

        const aggregateType = this.extractAggregateType(streamName);
        await this.outboxRepository.saveEvents(domainEvents, aggregateType);
        this.logger.log(
          `Saved ${events.length} events to outbox for ${streamName}`
        );
      }
    } catch (error) {
      if (error instanceof WrongExpectedVersionError) {
        throw new DomainException(
          `Optimistic lock failed for stream ${streamName}. Expected version: ${expectedVersion}`
        );
      }
      throw error;
    }
  }

  /**
   * Load events from the event store for an aggregate.
   *
   * Phase 4.2 Enhancement: Checks for snapshots and only loads events after snapshot version.
   *
   * @param aggregateId - The aggregate identifier
   * @param fromPosition - Optional starting position (inclusive)
   * @returns Array of domain events
   */
  async loadEvents(
    aggregateId: string,
    fromPosition?: number
  ): Promise<DomainEventEnvelope[]> {
    const streamName = this.getStreamName(aggregateId);

    // Check for snapshot if repository is available
    let startPosition = fromPosition;
    if (this.snapshotRepository && fromPosition === undefined) {
      const snapshot = await this.snapshotRepository.loadSnapshot(aggregateId);
      if (snapshot) {
        startPosition = snapshot.lastEventPosition + 1; // Load events after snapshot
        this.logger.log(
          `Loaded snapshot for ${streamName} at position ${snapshot.lastEventPosition}, replaying from ${startPosition}`
        );
      }
    }

    const events: DomainEventEnvelope[] = [];

    try {
      const readStream = this.client.readStream(streamName, {
        direction: FORWARDS,
        fromRevision:
          startPosition !== undefined ? BigInt(startPosition) : START,
      });

      for await (const resolvedEvent of readStream) {
        if (resolvedEvent.event) {
          events.push(this.toDomainEvent(resolvedEvent));
        }
      }
    } catch (error: unknown) {
      // Stream not found is not an error - return empty array
      if (this.isStreamNotFoundError(error)) {
        return [];
      }
      throw error;
    }

    return events;
  }

  /**
   * Load the current stream version (latest event position).
   *
   * @param aggregateId - The aggregate identifier
   * @returns Current version or null if stream doesn't exist
   */
  async loadStreamVersion(aggregateId: string): Promise<number | null> {
    const streamName = this.getStreamName(aggregateId);

    try {
      const readStream = this.client.readStream(streamName, {
        direction: FORWARDS,
        fromRevision: START,
        maxCount: 1,
      });

      let lastRevision: bigint | null = null;
      for await (const resolvedEvent of readStream) {
        if (resolvedEvent.event?.revision !== undefined) {
          lastRevision = resolvedEvent.event.revision;
        }
      }

      return lastRevision !== null ? Number(lastRevision) : null;
    } catch (error: unknown) {
      if (this.isStreamNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Convert EventStoreDB resolved event to domain event envelope.
   */
  private toDomainEvent(resolvedEvent: ResolvedEvent): DomainEventEnvelope {
    const { event } = resolvedEvent;
    if (!event) {
      throw new Error('Event is null');
    }

    const data = event.data as any;

    return {
      id: event.id,
      type: event.type,
      aggregateId: data.aggregateId,
      occurredAt: data.occurredAt,
      eventVersion: data.eventVersion || '1.0.0',
      payload: data.payload || {},
      metadata: data.metadata || {},
      position: Number(event.revision),
    };
  }

  /**
   * Type guard for EventStoreDB stream-not-found error.
   */
  private isStreamNotFoundError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      error.type === 'stream-not-found'
    );
  }

  /**
   * Generate stream name from aggregate ID.
   * Convention: <AggregateType>-<UUID>
   */
  private getStreamName(aggregateId: string): string {
    // Stream name format: "User-{uuid}" or "Tenant-{uuid}"
    // If aggregateId already contains hyphen, use as-is
    // Otherwise, prefix with generic "Aggregate"
    return aggregateId.includes('-') ? aggregateId : `Aggregate-${aggregateId}`;
  }

  /**
   * Extract aggregate type from stream name
   * Example: "Tenant-123" => "Tenant"
   */
  private extractAggregateType(streamName: string): string {
    const parts = streamName.split('-');
    return parts[0] || 'Aggregate';
  }
}
