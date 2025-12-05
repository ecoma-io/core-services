import { Context } from '@opentelemetry/api';
import {
  Span,
  SpanExporter,
  ReadableSpan,
  BatchSpanProcessor,
  BufferConfig,
} from '@opentelemetry/sdk-trace-base';

import { StandardizedLogger } from '../logger/standardized-logger';

/**
 * TraceProcessor
 * @remarks
 * A BatchSpanProcessor subclass that adds structured logging and safer
 * lifecycle/error handling around the base implementation.
 */
export class TraceProcessor extends BatchSpanProcessor {
  /**
   * Create a TraceProcessor.
   * @param exporter - The exporter to pass to the base BatchSpanProcessor.
   * @param config - Buffer configuration for the BatchSpanProcessor.
   * @param logger - Logger used for lifecycle and debug messages.
   */
  constructor(
    exporter: SpanExporter,
    config: BufferConfig,
    private readonly logger: StandardizedLogger
  ) {
    super(exporter, config);
    this.logger.info(`Initialized TraceProcessor`);
  }

  /**
   * Called when a span starts. Adds a debug log then delegates to the base
   * implementation.
   * @param span - The span that was started.
   * @param parentContext - The parent context of the span.
   */
  override onStart(span: Span, parentContext: Context): void {
    this.logger.verbose(
      `Span started: ${span.spanContext().spanId} ${span.name}`
    );

    try {
      super.onStart(span, parentContext);
    } catch (err: unknown) {
      this.logger.error({
        msg: 'Error in TraceProcessor.onStart',
        error: String(err ?? 'unknown'),
      });
      // do not swallow — rethrow so callers are notified
      throw err;
    }
  }

  /**
   * Called when a span ends. Adds structured logging then delegates to the
   * base implementation.
   * @param span - The readable span that ended.
   */
  override onEnd(span: ReadableSpan): void {
    this.logger.verbose(
      `Span ended: ${span.spanContext().spanId} ${span.name}`
    );

    try {
      super.onEnd(span);
    } catch (err: unknown) {
      this.logger.error({
        msg: 'Error in TraceProcessor.onEnd',
        error: String(err ?? 'unknown'),
      });
      throw err;
    }
  }

  /**
   * Force a flush of the processor's internal queue.
   * @returns A promise that resolves when the flush completes.
   */
  override async forceFlush(): Promise<void> {
    this.logger.debug('Forcing flush of TraceProcessor');

    try {
      await super.forceFlush();
    } catch (err: unknown) {
      const errorMsg = String(err ?? 'unknown error');
      this.logger.error({
        msg: 'TraceProcessor.forceFlush failed',
        error: errorMsg,
      });
      throw new Error(`TraceProcessor.forceFlush failed: ${errorMsg}`);
    }
  }

  /**
   * Shut down the processor and flush outstanding spans.
   * @returns A promise that resolves when shutdown completes.
   */
  override async shutdown(): Promise<void> {
    this.logger.debug('Shutting down TraceProcessor');

    try {
      await super.shutdown();
    } catch (err: unknown) {
      const errorMsg = String(err ?? 'unknown error');
      this.logger.error({
        msg: 'TraceProcessor.shutdown failed',
        error: errorMsg,
      });
      throw new Error(`TraceProcessor.shutdown failed: ${errorMsg}`);
    }
  }
}
