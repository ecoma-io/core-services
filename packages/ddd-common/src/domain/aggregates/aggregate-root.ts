import { DomainEvent } from '../events';
import { Entity } from '../entities';
import { AggregateRootEventNotProvidedException } from '../exceptions';

/**
 * Generic AggregateRoot base for event-sourced aggregates.
 *
 * Provides a protected queue of domain events produced during command
 * handling. The queue is intended to be read and cleared by the
 * application/infrastructure layer once events have been persisted and published.
 */
export abstract class AggregateRoot<T> extends Entity<T> {
  /**
   * The list holds the business events raised by the AR during the execution
   * of a single command (transaction).
   *
   * This is NOT the history for Event Sourcing, but events to be dispatched.
   */
  protected readonly domainEvents: DomainEvent[] = [];

  /**
   * Retrieves the recorded Domain Events.
   *
   * Returns a shallow copy so callers cannot mutate the internal queue.
   *
   * @returns ReadonlyArray<DomainEvent> - a read-only copy of recorded events
   */
  public getDomainEvents(): ReadonlyArray<DomainEvent> {
    // Return a copy to prevent external modification of the internal list.
    return this.domainEvents.slice();
  }

  /**
   * Clears all recorded Domain Events.
   *
   * MUST be called by the Infrastructure/Application layer AFTER the events
   * have been successfully saved (e.g., in an Outbox table) AND dispatched/published.
   * Ensures events are only processed once per transaction.
   */
  public clearDomainEvents(): void {
    this.domainEvents.length = 0;
  }

  /**
   * Records a Domain Event.
   *
   * This protected method is called internally by the AR's business methods
   * (e.g., `Order.place()`, `Product.changePrice()`) when a significant business
   * change occurs within its transactional boundary.
   *
   * @param event - The DomainEvent to record. Must be non-null.
   * @throws {AggregateRootEventNotProvidedException} When the provided event is null or undefined.
   */
  /**
   * Append a domain event to the aggregate's uncommitted event queue.
   * @param event - The DomainEvent to record. Must belong to this aggregate.
   * @throws AggregateRootEventNotProvidedException when event is null/undefined or aggregateId mismatch.
   */
  protected addDomainEvent(event: DomainEvent): void {
    if (event === null || event === undefined) {
      throw new AggregateRootEventNotProvidedException();
    }
    // Ensure the event belongs to this aggregate
    if (event.aggregateId !== this.id) {
      throw new AggregateRootEventNotProvidedException(
        `Event.aggregateId (${event.aggregateId}) does not match aggregate id (${this.id})`
      );
    }

    this.domainEvents.push(event);
  }
}
