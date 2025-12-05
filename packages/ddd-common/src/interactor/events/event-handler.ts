import { DomainEvent } from '../../domain';

/**
 * Handles domain events.
 *
 * @typeParam E - Concrete DomainEvent type.
 * @remarks
 * Event handlers typically perform eventual-consistency side effects (projections,
 * notifications) and should return a resolved promise when complete.
 */
export interface IEventHandler<E extends DomainEvent> {
  /**
   * Handle the given domain event.
   *
   * @param event - The domain event instance to handle.
   * @returns A promise that resolves when handling completes.
   */
  handle(event: E): Promise<void>;
}
