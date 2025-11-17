/**
 * RabbitMQ adapter using @golevelup/nestjs-rabbitmq.
 * Handles message consumption with ack/nack, DLX, and retry support.
 */
import { AmqpConnection, Nack } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';

export interface RabbitMQAdapterConfig {
  queue: string;
  exchange: string;
  routingKey: string;
}

/**
 * Adapter for consuming messages from RabbitMQ using @golevelup/nestjs-rabbitmq.
 * This adapter wraps the AmqpConnection to provide a simpler interface for projectors.
 */
@Injectable()
export class RabbitMqAdapter {
  private readonly logger = new Logger(RabbitMqAdapter.name);
  private handler?: (msg: any) => Promise<void>;

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly config: RabbitMQAdapterConfig
  ) {}

  /**
   * Subscribe to a queue and process messages with the provided handler.
   *
   * @param queue - Queue name (for backward compatibility, config.queue is preferred)
   * @param handler - Message handler function
   */
  async subscribe(
    queue: string,
    handler: (msg: any) => Promise<void>
  ): Promise<void> {
    this.handler = handler;
    this.logger.log(`Subscribed to queue: ${queue}`);
  }

  /**
   * Handle incoming messages from RabbitMQ.
   * This method is called by the @RabbitSubscribe decorator.
   *
   * @param msg - Message payload
   */
  async handleMessage(msg: any): Promise<void | Nack> {
    if (!this.handler) {
      this.logger.warn('No handler registered for incoming message');
      return new Nack(false); // Don't requeue
    }

    try {
      await this.handler(msg);
      // Message successfully processed, auto-ack
    } catch (error) {
      this.logger.error('Error processing message', error);
      // Nack without requeue - let DLX handle it
      return new Nack(false);
    }
  }

  /**
   * Close the adapter (no-op as connection is managed by NestJS).
   */
  async close(): Promise<void> {
    this.logger.log('RabbitMQ adapter closed');
  }
}
