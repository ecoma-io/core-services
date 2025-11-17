import { DomainEventEnvelope } from '@ecoma-io/domain';

/**
 * Port interface for Event Store repository.
 * Infrastructure layer implements this to persist domain events.
 *
 * @see ADR-2: EventStoreDB for Event Sourcing
 */
export interface IEventStoreRepository {
  /**
   * Save events to the event store with optimistic locking.
   *
   * @param aggregateId - The aggregate identifier (stream name)
   * @param events - Domain events to append
   * @param expectedVersion - Expected stream version for optimistic locking
   * @throws OptimisticLockException if version mismatch
   */
  saveEvents(
    aggregateId: string,
    events: DomainEventEnvelope[],
    expectedVersion?: number
  ): Promise<void>;

  /**
   * Load events from the event store for an aggregate.
   *
   * @param aggregateId - The aggregate identifier
   * @param fromPosition - Optional starting position (inclusive)
   * @returns Array of domain events
   */
  loadEvents(
    aggregateId: string,
    fromPosition?: number
  ): Promise<DomainEventEnvelope[]>;

  /**
   * Load the current stream version (latest event position).
   *
   * @param aggregateId - The aggregate identifier
   * @returns Current version or null if stream doesn't exist
   */
  loadStreamVersion(aggregateId: string): Promise<number | null>;
}
