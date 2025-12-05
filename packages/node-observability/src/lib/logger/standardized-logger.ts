import {
  Level,
  Logger,
  TransportMultiOptions,
  TransportPipelineOptions,
  TransportSingleOptions,
} from 'pino';
import { trace, context } from '@opentelemetry/api';
import { isObject } from '@ecoma-io/common';
import { analyzeParams } from './utils/analyze-params';
import { buildMergingObject } from './utils/build-merging-object';
import { redactIfNeeded } from './utils/redact-if-needed';
import { isStackTrace } from './utils';
import pino = require('pino');

export type StandardizedLoggerConfig = {
  level?: Level;
  /**
   * List of keys to redact (PII fields) in log output.
   */
  redactKeys?: string[];

  transport?:
    | TransportSingleOptions
    | TransportMultiOptions
    | TransportPipelineOptions;

  extra?: Record<string, unknown>;
};

export class StandardizedLogger {
  /**
   * Static instance state for pino logger and configuration.
   */
  private static instance: {
    pino: Logger;
    redactKeys: readonly string[];
  } | null = null;

  /**
   * Initialize the logger with config, including redact keys.
   * @param config - Logger config
   */
  public static initialize(config: StandardizedLoggerConfig) {
    if (StandardizedLogger.instance) {
      throw new Error('StandardizedLogger has already been initialized.');
    }

    const redactKeys = config.redactKeys ?? [];
    const pinoLogger = pino({
      level: config.level,
      formatters: {
        log: StandardizedLogger.createLogFormatter(config, redactKeys),
      },
      transport: config.transport,
    });

    StandardizedLogger.instance = {
      pino: pinoLogger,
      redactKeys,
    };

    pinoLogger.info({
      msg: 'StandardizedLogger initialized',
      ...(config.extra ?? {}),
    });
  }

  /**
   * Creates the log formatter function with tracing and redaction support.
   * @param config - Logger configuration
   * @param redactKeys - Keys to redact from logs
   * @returns Formatter function for pino
   */
  private static createLogFormatter(
    config: StandardizedLoggerConfig,
    redactKeys: readonly string[]
  ) {
    return (object: Record<string, unknown>) => {
      const span = trace.getSpan(context.active());
      let base = { ...object };

      if (redactKeys.length > 0) {
        base = redactIfNeeded(base, redactKeys);
      }

      // Always include configured extras for every log record so users
      // reliably receive `extra` fields (serviceName/test metadata etc.)
      // irrespective of whether there is an active span.
      if (!span) {
        return {
          ...(config.extra ?? {}),
          ...base,
        };
      }

      // Defensive: getSpanContext may return undefined in some OTEL setups
      const spanCtx = trace.getSpanContext(context.active());
      if (!spanCtx) {
        // No context available — return base object (still apply configured extras)
        return {
          ...(config.extra ?? {}),
          ...base,
        };
      }

      const { spanId, traceId } = spanCtx;

      return {
        ...(config.extra ?? {}),
        ...base,
        spanId,
        traceId,
      };
    };
  }

  public static shutdown(): Promise<void> {
    if (StandardizedLogger.instance) {
      const { pino } = StandardizedLogger.instance;
      return new Promise<void>((resolve, reject) => {
        pino.info({ msg: 'StandardizedLogger shutting down' });
        pino.flush((err) => {
          if (err) {
            reject(err);
          } else {
            pino.info({
              msg: 'StandardizedLogger shut down successfully',
            });
            resolve();
          }
        });
      });
    } else {
      return Promise.resolve();
    }
  }

  /**
   * Gets the pino logger instance.
   * @throws Error if logger is not initialized
   */
  private static getInstancePino(): Logger {
    if (!StandardizedLogger.instance) {
      throw new Error(
        'StandardizedLogger is not initialized. Call initialize() first.'
      );
    }
    return StandardizedLogger.instance.pino;
  }

  /**
   * Gets the configured redact keys.
   */
  private static get redactKeys(): readonly string[] {
    return StandardizedLogger.instance?.redactKeys ?? [];
  }

  constructor(
    private readonly options?: {
      context?: string;
      extra?: Record<string, unknown>;
    }
  ) {}

  /**
   * Handles Error object logging.
   * @returns true if handled, false otherwise
   */
  private handleErrorMessage(
    level: Level,
    message: unknown,
    mergingObject: unknown,
    interpolationValues: unknown[]
  ): boolean {
    if (!(message instanceof Error)) {
      return false;
    }

    const logObject = {
      ...(isObject(mergingObject)
        ? (mergingObject as Record<string, unknown>)
        : {}),
      err: message,
    };

    StandardizedLogger.getInstancePino()[level](
      logObject,
      message.message || 'Error',
      ...interpolationValues
    );
    return true;
  }

  /**
   * Handles exception handler contract (string message + stack).
   * @returns true if handled, false otherwise
   */
  private handleExceptionHandlerContract(
    level: Level,
    message: unknown,
    paramsWithoutContext: unknown[],
    mergingObject: unknown
  ): boolean {
    // Detect the non-standard NestJS exception-handler contract where
    // `.error(message, stack)` is used instead of passing an Error instance.
    // Inline the guard here (previously delegated to `isWrongExceptionsHandlerContract`).
    if (
      !(
        paramsWithoutContext.length === 1 &&
        isStackTrace(message, level, paramsWithoutContext[0])
      )
    ) {
      return false;
    }

    const err = new Error(message as string);
    err.stack = paramsWithoutContext[0] as string;

    const logObject = {
      ...(isObject(mergingObject)
        ? (mergingObject as Record<string, unknown>)
        : {}),
      err,
    };

    StandardizedLogger.getInstancePino()[level](logObject);
    return true;
  }

  /**
   * Handles object message logging.
   * @returns true if handled, false otherwise
   */
  private handleObjectMessage(
    level: Level,
    message: unknown,
    mergingObject: unknown,
    interpolationValues: unknown[]
  ): boolean {
    if (typeof message !== 'object' || message === null) {
      return false;
    }

    const logObject = {
      ...(isObject(mergingObject)
        ? (mergingObject as Record<string, unknown>)
        : {}),
      ...(isObject(message) ? (message as Record<string, unknown>) : {}),
    };

    StandardizedLogger.getInstancePino()[level](
      logObject,
      undefined,
      ...interpolationValues
    );
    return true;
  }

  trace(message: unknown, ...optionalParams: unknown[]) {
    this.call('trace', message, ...optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    this.call('trace', message, ...optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    this.call('debug', message, ...optionalParams);
  }

  info(message: unknown, ...optionalParams: unknown[]) {
    this.call('info', message, ...optionalParams);
  }

  log(message: unknown, ...optionalParams: unknown[]) {
    this.call('info', message, ...optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    this.call('warn', message, ...optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    this.call('error', message, ...optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]) {
    this.call('fatal', message, ...optionalParams);
  }

  /**
   * Central logging method that handles different message shapes and
   * routes them to the underlying pino logger.
   *
   * Behaviour summary:
   * - The last parameter is interpreted as `context` unless it looks like a
   *   stack trace (in which case it belongs to the exception-handler contract).
   * - If the final parameter is an object and not required for interpolation
   *   it will be merged into the structured log payload.
   * - Error objects are logged with an `err` field.
   *
   * @param level - pino log level
   * @param message - main message or object
   * @param optionalParams - additional interpolation values or context
   */
  private call(
    level: Level,
    message: unknown,
    ...optionalParams: unknown[]
  ): void {
    // Analyze parameters to extract context, interpolation values, and merge object
    const { context, interpolationValues, mergeObject, paramsWithoutContext } =
      analyzeParams(message, level, optionalParams, this.options?.context);

    // Build base merging object with context and extras
    const mergingObject = buildMergingObject(
      this.options?.extra,
      context,
      mergeObject
    );

    // Redact sensitive data from all components
    const redactedMergingObject = redactIfNeeded(
      mergingObject,
      StandardizedLogger.redactKeys
    );
    const redactedMessage = redactIfNeeded(
      message,
      StandardizedLogger.redactKeys
    );
    const redactedInterpolationValues = interpolationValues.map((v) =>
      redactIfNeeded(v, StandardizedLogger.redactKeys)
    );

    // Handle special cases via guard clauses
    if (
      this.handleErrorMessage(
        level,
        message,
        redactedMergingObject,
        redactedInterpolationValues
      )
    ) {
      return;
    }

    if (
      this.handleExceptionHandlerContract(
        level,
        message,
        paramsWithoutContext,
        redactedMergingObject
      )
    ) {
      return;
    }
    if (
      this.handleObjectMessage(
        level,
        redactedMessage,
        redactedMergingObject,
        redactedInterpolationValues
      )
    ) {
      return;
    }

    // Default case: Handle string/primitive messages
    StandardizedLogger.getInstancePino()[level](
      redactedMergingObject,
      String(redactedMessage),
      ...redactedInterpolationValues
    );
  }
}
