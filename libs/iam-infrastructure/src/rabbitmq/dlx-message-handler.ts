import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ConsumeMessage } from 'amqplib';
import { DLXConfig } from './dlx.config';
import {
  getRetryCount,
  hasExceededMaxRetries,
  buildRetryHeaders,
  buildDLQHeaders,
  getRetryRoutingKey,
  getOriginalRoutingKey,
} from './retry-utils';

/**
 * DLXMessageHandler (Phase 4.4)
 *
 * Base class for RabbitMQ message handlers with DLX retry support.
 * Subclasses should implement handleMessage() for business logic.
 *
 * Error handling flow:
 * 1. Message processing fails → check retry count
 * 2. If retries < max → republish to retry queue with incremented count
 * 3. If retries >= max → move to DLQ
 * 4. ACK original message (already moved to retry/DLQ)
 */
@Injectable()
export abstract class DLXMessageHandler {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected readonly amqpConnection: AmqpConnection,
    protected readonly dlxConfig: DLXConfig
  ) {}

  /**
   * Handle incoming message from main queue
   * Subclasses must implement this method
   */
  protected abstract handleMessage(
    message: unknown,
    amqpMsg: ConsumeMessage
  ): Promise<void>;

  /**
   * Process message with DLX retry support
   * This is called by RabbitSubscribe decorator in subclasses
   */
  protected async processWithRetry(
    message: unknown,
    amqpMsg: ConsumeMessage
  ): Promise<void> {
    const retryCount = getRetryCount(amqpMsg);

    try {
      this.logger.log(
        `Processing message (retry: ${retryCount}/${this.dlxConfig.maxRetries}): ${amqpMsg.fields.routingKey}`
      );

      await this.handleMessage(message, amqpMsg);

      // Success - ACK message
      this.logger.log(
        `Successfully processed message: ${amqpMsg.fields.routingKey}`
      );
      // Return void = auto-ACK
    } catch (error) {
      this.logger.error(
        `Failed to process message (retry: ${retryCount}/${this.dlxConfig.maxRetries}): ${error instanceof Error ? error.message : String(error)}`
      );

      if (hasExceededMaxRetries(amqpMsg, this.dlxConfig.maxRetries)) {
        // Max retries exceeded → move to DLQ
        await this.moveToDeadLetterQueue(amqpMsg, error as Error);
      } else {
        // Retry available → republish with incremented retry count
        await this.republishForRetry(amqpMsg, error as Error);
      }

      // ACK original message (already moved to retry/DLQ)
      // Return void = auto-ACK
    }
  }

  /**
   * Republish message to retry queue with incremented retry count
   */
  private async republishForRetry(
    amqpMsg: ConsumeMessage,
    error: Error
  ): Promise<void> {
    const retryCount = getRetryCount(amqpMsg);
    const nextRetryCount = retryCount + 1;
    const retryHeaders = buildRetryHeaders(amqpMsg, error);

    // Determine routing key based on exponential backoff config
    const routingKey = this.dlxConfig.useExponentialBackoff
      ? getRetryRoutingKey(nextRetryCount)
      : 'retry';

    this.logger.warn(
      `Republishing to retry queue (attempt ${nextRetryCount}): ${amqpMsg.fields.routingKey}`
    );

    await this.amqpConnection.publish(
      this.dlxConfig.dlxExchange,
      routingKey,
      amqpMsg.content,
      {
        headers: retryHeaders,
        persistent: true,
        contentType: amqpMsg.properties.contentType,
        messageId: amqpMsg.properties.messageId,
      }
    );
  }

  /**
   * Move message to Dead Letter Queue after max retries exceeded
   */
  private async moveToDeadLetterQueue(
    amqpMsg: ConsumeMessage,
    error: Error
  ): Promise<void> {
    const dlqHeaders = buildDLQHeaders(amqpMsg, error);

    this.logger.error(
      `Moving to DLQ after ${this.dlxConfig.maxRetries} failed attempts: ${amqpMsg.fields.routingKey}`
    );

    await this.amqpConnection.publish(
      this.dlxConfig.dlxExchange,
      'dlq',
      amqpMsg.content,
      {
        headers: dlqHeaders,
        persistent: true,
        contentType: amqpMsg.properties.contentType,
        messageId: amqpMsg.properties.messageId,
      }
    );

    // TODO: Trigger alert/notification for DLQ message
    this.logger.error(
      `⚠️ ALERT: Message moved to DLQ - manual intervention required`
    );
  }

  /**
   * Get original routing key (handles retried messages)
   */
  protected getOriginalRoutingKey(amqpMsg: ConsumeMessage): string {
    return getOriginalRoutingKey(amqpMsg);
  }
}
