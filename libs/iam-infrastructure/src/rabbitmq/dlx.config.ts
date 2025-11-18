/**
 * RabbitMQ DLX Configuration (Phase 4.4)
 *
 * Dead Letter Exchange strategy for failed message handling:
 * - Main queue: receives all events from exchange
 * - Retry queue: receives failed events with TTL for delayed retry
 * - DLQ: receives permanently failed events after max retries
 */

export interface DLXConfig {
  /**
   * Main exchange name (e.g., 'iam.events')
   */
  mainExchange: string;

  /**
   * Dead Letter Exchange name (e.g., 'iam.events.dlx')
   */
  dlxExchange: string;

  /**
   * Main queue name (e.g., 'iam.events.queue')
   */
  mainQueue: string;

  /**
   * Retry queue name (e.g., 'iam.events.retry')
   */
  retryQueue: string;

  /**
   * Dead Letter Queue name (e.g., 'iam.events.dlq')
   */
  dlq: string;

  /**
   * Maximum retry attempts before moving to DLQ (default: 5)
   */
  maxRetries: number;

  /**
   * Initial retry delay in milliseconds (default: 5000)
   */
  retryDelay: number;

  /**
   * Whether to use exponential backoff for retries (default: true)
   */
  useExponentialBackoff: boolean;

  /**
   * Maximum retry delay in milliseconds (default: 300000 = 5 minutes)
   */
  maxRetryDelay: number;
}

export const DEFAULT_DLX_CONFIG: Partial<DLXConfig> = {
  maxRetries: 5,
  retryDelay: 5000, // 5 seconds
  useExponentialBackoff: true,
  maxRetryDelay: 300000, // 5 minutes
};

/**
 * Calculate retry delay with exponential backoff
 *
 * @param attempt - Current retry attempt (1-based)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay cap
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number
): number {
  // Exponential backoff: delay = baseDelay * 2^(attempt-1)
  const delay = baseDelay * Math.pow(2, attempt - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Get routing key from event type
 * Convention: eventType in PascalCase → routing.key in dot.case
 *
 * Examples:
 * - TenantCreated → tenant.created
 * - UserRegistered → user.registered
 *
 * @param eventType - Event type in PascalCase
 * @returns Routing key in dot.case
 */
export function getRoutingKeyFromEventType(eventType: string): string {
  return eventType
    .replace(/([A-Z])/g, (match, p1, offset) =>
      offset > 0 ? `.${p1.toLowerCase()}` : p1.toLowerCase()
    )
    .toLowerCase();
}
