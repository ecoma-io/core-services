/**
 * Logger interface for structured logging at various levels.
 */
/**
 * Package-level logging abstraction for the integrator package.
 *
 * This file exposes a minimal, cross-platform logger interface intended to be
 * implemented by adapters that forward logs to the application's concrete
 * logging system (console, structured logger, cloud logging, etc.).
 *
 * Implementations are responsible for serialization, enrichment (timestamps,
 * metadata), level filtering, and safe handling of arbitrary payloads.
 *
 * @packageDocumentation
 */

/**
 * A minimal, implementation-agnostic logger interface.
 *
 * Implementations should accept arbitrary payloads (strings, Error objects,
 * plain objects, arrays, etc.), serialize them safely, and avoid throwing from
 * the logging call. Adapters can map these methods to framework-specific
 * log levels, add context (request id, correlation id), and perform batching
 * or persistence as needed.
 *
 * Usage notes:
 * - Prefer passing Error objects for exceptions so implementations can capture
 *   stack traces and structured error data.
 * - Keep verbose and debug levels off in production unless diagnosing issues.
 *
 * @public
 */

/**
 * Log a verbose-level message.
 *
 * Verbose logs are intended for extremely detailed tracing information,
 * typically useful only during development or deep diagnostics. They are
 * usually disabled in production environments.
 *
 * @param message - The payload to log (string, Error, object, etc.). Implementations
 *                  should serialize complex values safely and avoid throwing.
 * @returns void
 */

/**
 * Log an info-level message.
 *
 * Use for general informational messages that describe high-level operation
 * progress, configuration, or lifecycle events. Info-level logs are usually
 * enabled in production.
 *
 * @param message - The payload to log (string, Error, object, etc.).
 * @returns void
 */

/**
 * Log an error-level message.
 *
 * Use for recoverable and non-recoverable errors that should be investigated.
 * Prefer passing an Error object when available so implementations can include
 * stack traces and structured error metadata.
 *
 * @param message - The payload to log (string, Error, object, etc.).
 * @returns void
 */

/**
 * Log a warning-level message.
 *
 * Use for abnormal or unexpected conditions that do not yet prevent normal
 * operation but may require attention (deprecated usage, resource pressure,
 * intermittent failures).
 *
 * @param message - The payload to log (string, Error, object, etc.).
 * @returns void
 */

/**
 * Log a debug-level message.
 *
 * Use for diagnostic information useful to developers while debugging. Debug
 * logs are more concise than verbose logs but still intended primarily for
 * troubleshooting and development.
 *
 * @param message - The payload to log (string, Error, object, etc.).
 * @returns void
 */

/**
 * Log a fatal-level message.
 *
 * Use for unrecoverable errors or conditions that will likely lead to process
 * termination or require immediate attention/alerting. Implementations may
 * choose to perform additional actions (flush buffers, trigger alerts, exit).
 *
 * @param message - The payload to log (string, Error, object, etc.).
 * @returns void
 */
export interface ILogger {
  /** Log a verbose-level message. */
  verbose(message: unknown): void;
  /** Log an info-level message. */
  info(message: unknown): void;
  /** Log an error-level message. */
  error(message: unknown): void;
  /** Log a warning-level message. */
  warn(message: unknown): void;
  /** Log a debug-level message. */
  debug(message: unknown): void;
  /** Log a fatal-level message. */
  fatal(message: unknown): void;
}
