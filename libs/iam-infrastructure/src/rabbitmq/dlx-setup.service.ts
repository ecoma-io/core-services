import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import {
  DLXConfig,
  DEFAULT_DLX_CONFIG,
  calculateRetryDelay,
} from './dlx.config';

/**
 * DLXSetupService (Phase 4.4)
 *
 * Initializes RabbitMQ Dead Letter Exchange infrastructure:
 * 1. Creates DLX exchange
 * 2. Creates retry queue with TTL
 * 3. Creates DLQ (no consumers, manual processing)
 * 4. Binds queues to exchanges with proper routing
 *
 * Architecture:
 * ```
 * [Main Exchange] --routing--> [Main Queue] --on-error--> [DLX]
 *                                                           |
 *                                      +-------------------+--------------------+
 *                                      |                                        |
 *                                  [Retry Queue]                             [DLQ]
 *                                   (with TTL)                          (permanent storage)
 *                                      |
 *                                      +--after-TTL--> [Main Queue] (retry)
 * ```
 */
@Injectable()
export class DLXSetupService implements OnModuleInit {
  private readonly logger = new Logger(DLXSetupService.name);
  private readonly config: DLXConfig;

  constructor(
    private readonly amqpConnection: AmqpConnection,
    config: Partial<DLXConfig>
  ) {
    this.config = { ...DEFAULT_DLX_CONFIG, ...config } as DLXConfig;
  }

  /**
   * Initialize DLX infrastructure on module startup
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.setupDLXInfrastructure();
      this.logger.log('DLX infrastructure initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize DLX infrastructure', error);
      throw error;
    }
  }

  /**
   * Setup complete DLX infrastructure
   */
  private async setupDLXInfrastructure(): Promise<void> {
    const channel = this.amqpConnection.channel;

    // 1. Assert DLX exchange
    await channel.assertExchange(this.config.dlxExchange, 'topic', {
      durable: true,
    });
    this.logger.log(`Created DLX exchange: ${this.config.dlxExchange}`);

    // 2. Assert main queue with DLX configuration
    await channel.assertQueue(this.config.mainQueue, {
      durable: true,
      deadLetterExchange: this.config.dlxExchange,
      deadLetterRoutingKey: 'retry', // Route failed messages to retry queue
    });
    this.logger.log(`Created main queue: ${this.config.mainQueue}`);

    // 3. Bind main queue to main exchange (catch-all pattern)
    await channel.bindQueue(
      this.config.mainQueue,
      this.config.mainExchange,
      '#' // Subscribe to all events
    );
    this.logger.log(
      `Bound ${this.config.mainQueue} to ${this.config.mainExchange}`
    );

    // 4. Create retry queues with different TTLs for exponential backoff
    if (this.config.useExponentialBackoff) {
      for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
        const retryDelay = calculateRetryDelay(
          attempt,
          this.config.retryDelay,
          this.config.maxRetryDelay
        );

        const retryQueueName = `${this.config.retryQueue}.attempt-${attempt}`;

        await channel.assertQueue(retryQueueName, {
          durable: true,
          messageTtl: retryDelay, // TTL for this retry attempt
          deadLetterExchange: this.config.mainExchange, // Re-route back to main exchange after TTL
          deadLetterRoutingKey: '#', // Preserve original routing key
        });

        // Bind retry queue to DLX with retry.attempt-N routing key
        await channel.bindQueue(
          retryQueueName,
          this.config.dlxExchange,
          `retry.attempt-${attempt}`
        );

        this.logger.log(
          `Created retry queue: ${retryQueueName} (TTL: ${retryDelay}ms)`
        );
      }
    } else {
      // Single retry queue with fixed TTL
      await channel.assertQueue(this.config.retryQueue, {
        durable: true,
        messageTtl: this.config.retryDelay,
        deadLetterExchange: this.config.mainExchange,
        deadLetterRoutingKey: '#',
      });

      await channel.bindQueue(
        this.config.retryQueue,
        this.config.dlxExchange,
        'retry'
      );

      this.logger.log(
        `Created retry queue: ${this.config.retryQueue} (TTL: ${this.config.retryDelay}ms)`
      );
    }

    // 5. Assert Dead Letter Queue (DLQ) - permanent storage for failed messages
    await channel.assertQueue(this.config.dlq, {
      durable: true,
      // No deadLetterExchange - messages stay here permanently
      // No TTL - messages never expire
      // Manual intervention required to process/delete
    });

    // Bind DLQ to DLX with 'dlq' routing key
    await channel.bindQueue(this.config.dlq, this.config.dlxExchange, 'dlq');

    this.logger.log(`Created DLQ: ${this.config.dlq}`);
  }

  /**
   * Get current DLX configuration
   */
  getConfig(): DLXConfig {
    return this.config;
  }

  /**
   * Check DLQ depth (for monitoring)
   */
  async getDLQDepth(): Promise<number> {
    const channel = this.amqpConnection.channel;
    const queueInfo = await channel.checkQueue(this.config.dlq);
    return queueInfo.messageCount;
  }

  /**
   * Check retry queue depths (for monitoring)
   */
  async getRetryQueueDepths(): Promise<Record<string, number>> {
    const channel = this.amqpConnection.channel;
    const depths: Record<string, number> = {};

    if (this.config.useExponentialBackoff) {
      for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
        const queueName = `${this.config.retryQueue}.attempt-${attempt}`;
        const queueInfo = await channel.checkQueue(queueName);
        depths[queueName] = queueInfo.messageCount;
      }
    } else {
      const queueInfo = await channel.checkQueue(this.config.retryQueue);
      depths[this.config.retryQueue] = queueInfo.messageCount;
    }

    return depths;
  }
}
