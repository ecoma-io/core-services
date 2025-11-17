import { DomainEventEnvelope } from '@ecoma-io/domain';

/**
 * Port interface for Event Publisher.
 * Infrastructure layer implements this to publish domain events to message bus.
 *
 * @see ADR-2: RabbitMQ for Message Bus
 * @see ADR-4: Event Handling & Replay
 */
export interface IEventPublisher {
  /**
   * Publish domain events to message bus.
   * Events are routed by their type as the routing key.
   *
   * @param events - Domain events to publish
   */
  publish(events: DomainEventEnvelope[]): Promise<void>;
}
