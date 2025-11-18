import { ConsumeMessage } from 'amqplib';

/**
 * Retry tracking utilities (Phase 4.4)
 *
 * Manages retry attempt counting and routing decisions for DLX
 */

export const RETRY_COUNT_HEADER = 'x-retry-count';
export const ORIGINAL_ROUTING_KEY_HEADER = 'x-original-routing-key';
export const FAILURE_REASON_HEADER = 'x-failure-reason';
export const FIRST_FAILURE_TIME_HEADER = 'x-first-failure-time';

/**
 * Get retry count from message headers
 */
export function getRetryCount(message: ConsumeMessage): number {
  const headers = message.properties.headers || {};
  return (headers[RETRY_COUNT_HEADER] as number) || 0;
}

/**
 * Increment retry count in message headers
 */
export function incrementRetryCount(message: ConsumeMessage): number {
  const currentCount = getRetryCount(message);
  return currentCount + 1;
}

/**
 * Check if message has exceeded max retries
 */
export function hasExceededMaxRetries(
  message: ConsumeMessage,
  maxRetries: number
): boolean {
  return getRetryCount(message) >= maxRetries;
}

/**
 * Get original routing key from headers (if message was retried)
 */
export function getOriginalRoutingKey(message: ConsumeMessage): string {
  const headers = message.properties.headers || {};
  return (
    (headers[ORIGINAL_ROUTING_KEY_HEADER] as string) ||
    message.fields.routingKey
  );
}

/**
 * Build retry headers for republishing
 */
export function buildRetryHeaders(
  message: ConsumeMessage,
  error: Error
): Record<string, unknown> {
  const currentHeaders = message.properties.headers || {};
  const retryCount = incrementRetryCount(message);

  return {
    ...currentHeaders,
    [RETRY_COUNT_HEADER]: retryCount,
    [ORIGINAL_ROUTING_KEY_HEADER]:
      currentHeaders[ORIGINAL_ROUTING_KEY_HEADER] || message.fields.routingKey,
    [FAILURE_REASON_HEADER]: error.message,
    [FIRST_FAILURE_TIME_HEADER]:
      currentHeaders[FIRST_FAILURE_TIME_HEADER] || new Date().toISOString(),
  };
}

/**
 * Calculate which retry queue to use based on attempt number
 */
export function getRetryRoutingKey(retryCount: number): string {
  return `retry.attempt-${retryCount}`;
}

/**
 * Build DLQ headers with failure metadata
 */
export function buildDLQHeaders(
  message: ConsumeMessage,
  error: Error
): Record<string, unknown> {
  const currentHeaders = message.properties.headers || {};

  return {
    ...currentHeaders,
    [RETRY_COUNT_HEADER]: getRetryCount(message),
    [ORIGINAL_ROUTING_KEY_HEADER]: getOriginalRoutingKey(message),
    [FAILURE_REASON_HEADER]: error.message,
    [FIRST_FAILURE_TIME_HEADER]:
      currentHeaders[FIRST_FAILURE_TIME_HEADER] || new Date().toISOString(),
    'x-final-failure-time': new Date().toISOString(),
    'x-error-stack': error.stack || '',
  };
}
