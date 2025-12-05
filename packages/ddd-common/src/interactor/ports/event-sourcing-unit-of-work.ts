import { DomainEvent } from '../../domain';

/**
 * Unit of Work specialized for event sourcing workflows.
 *
 * @remarks
 * Implementations coordinate persisting events to an event store and
 * publishing them atomically from an application perspective.
 */
export interface IEventSourcingUnitOfWork {
  /**
   * Persist and publish events for the provided aggregate.
   *
   * @param aggregateId - The id of the aggregate emitting events.
   * @param events - Events to persist and publish. Treated as readonly by the implementation.
   * @param expectedVersion - Optional expected aggregate version for optimistic concurrency.
   * @returns The new aggregate version after commit.
   */
  commit(
    aggregateId: string,
    events: ReadonlyArray<DomainEvent>,
    expectedVersion?: number
  ): Promise<number>;
}
