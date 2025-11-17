import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { IEventPublisher } from '@ecoma-io/iam-command-interactor';
import { DomainEventEnvelope } from '@ecoma-io/domain';
import { Logger } from '@nestjs/common';

export interface RabbitMQConfig {
  exchange: string;
  exchangeType?: string;
}

/**
 * RabbitMQ implementation for publishing domain events using @golevelup/nestjs-rabbitmq.
 * Publishes events to an exchange with routing based on event type.
 *
 * @see ADR-2: Technology Stack - RabbitMQ for Message Bus
 * @see ADR-4: Event Handling & Replay - Retry & DLQ configuration
 */
export class RabbitMQEventPublisher implements IEventPublisher {
  private readonly logger = new Logger(RabbitMQEventPublisher.name);

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly config: RabbitMQConfig
  ) {}

  /**
   * Publish domain events to RabbitMQ exchange.
   * Events are routed by their type as the routing key.
   *
   * @param events - Domain events to publish
   */
  async publish(events: DomainEventEnvelope[]): Promise<void> {
    for (const event of events) {
      const routingKey = this.getRoutingKey(event);

      try {
        await this.amqpConnection.publish(
          this.config.exchange,
          routingKey,
          event,
          {
            persistent: true,
            contentType: 'application/json',
            timestamp: Date.now(),
            messageId: event.id,
            type: event.type,
            headers: {
              aggregateId: event.aggregateId,
              eventVersion: event.eventVersion,
            },
          }
        );

        this.logger.debug(
          `Published event ${event.type} (${event.id}) to ${routingKey}`
        );
      } catch (error) {
        this.logger.error(
          `Failed to publish event ${event.id} (${event.type})`,
          error
        );
        throw error;
      }
    }
  }

  /**
   * Generate routing key from event type.
   * Convention: iam.events.<EventType>
   * Example: UserRegistered -> iam.events.UserRegistered
   */
  private getRoutingKey(event: DomainEventEnvelope): string {
    return `iam.events.${event.type}`;
  }
}
