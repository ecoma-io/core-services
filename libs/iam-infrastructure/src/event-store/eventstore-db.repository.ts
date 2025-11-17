import {
  EventStoreDBClient,
  jsonEvent,
  FORWARDS,
  START,
  ResolvedEvent,
  WrongExpectedVersionError,
} from '@eventstore/db-client';
import { IEventStoreRepository } from '@ecoma-io/iam-command-interactor';
import { DomainEventEnvelope, DomainException } from '@ecoma-io/domain';

/**
 * EventStoreDB implementation for the Event Store repository.
 * Handles storing and retrieving domain events with optimistic concurrency control.
 *
 * @see ADR-2: Technology Stack - EventStoreDB for Event Sourcing
 */
export class EventStoreDbRepository implements IEventStoreRepository {
  constructor(private readonly client: EventStoreDBClient) {}

  /**
   * Save events to the event store with optimistic locking.
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

      await this.client.appendToStream(streamName, eventStoreEvents, {
        expectedRevision: appendExpectation,
      });
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
   * @param aggregateId - The aggregate identifier
   * @param fromPosition - Optional starting position (inclusive)
   * @returns Array of domain events
   */
  async loadEvents(
    aggregateId: string,
    fromPosition?: number
  ): Promise<DomainEventEnvelope[]> {
    const streamName = this.getStreamName(aggregateId);
    const events: DomainEventEnvelope[] = [];

    try {
      const readStream = this.client.readStream(streamName, {
        direction: FORWARDS,
        fromRevision: fromPosition !== undefined ? BigInt(fromPosition) : START,
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
}
