import { DomainEvent, DomainEventEnvelope } from './domain-event';
import { Snapshot } from './snapshot';

/**
 * Minimal ports (interfaces) to be implemented by infrastructure layer.
 */

export interface LoadEventsResult {
  events: DomainEventEnvelope[];
  version: number;
}

export interface IEventSourcedRepository {
  /**
   * Load events for a given aggregateId. Implementations should return events ordered by position.
   */
  loadEvents(aggregateId: string): Promise<LoadEventsResult>;

  /**
   * Save new events for an aggregate. expectedVersion is used for optimistic concurrency.
   */
  saveEvents(
    aggregateId: string,
    events: DomainEvent[],
    expectedVersion: number
  ): Promise<void>;

  /**
   * Optional: load latest snapshot for aggregateId if supported by store.
   */
  loadSnapshot?(aggregateId: string): Promise<Snapshot | null>;

  /**
   * Optional: persist snapshot for aggregateId.
   */
  saveSnapshot?(snapshot: Snapshot): Promise<void>;
}
