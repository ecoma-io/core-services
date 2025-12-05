import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-base';

import { StandardizedLogger } from '../logger/standardized-logger';

/**
 * A wrapper for OTLP exporters that logs export errors.
 * @remarks
 * This class decorates the original exporter and logs errors via the provided logger.
 */
/**
 * TraceExporter
 * @remarks
 * A defensive wrapper around a SpanExporter that provides robust logging and
 * error handling in accordance with the repo's TypeScript rules.
 */
export class TraceExporter implements SpanExporter {
  private readonly exporter: SpanExporter;
  private readonly logger: StandardizedLogger;

  /**
   * @param {SpanExporter} exporter - The original exporter to wrap.
   * @param {StandardizedLogger} logger - Logger for error reporting.
   */
  /**
   * Creates an instance of TraceExporter.
   * @param exporter - The underlying exporter to delegate to.
   * @param logger - Logger used for structured diagnostics.
   */
  constructor(exporter: SpanExporter, logger: StandardizedLogger) {
    this.exporter = exporter;
    this.logger = logger;
    this.logger.info(`Initialized TraceExporter`);
  }

  /**
   * Exports spans and logs errors if export fails.
   * @param {Array<ReadableSpan>} spans - The spans to export.
   * @param {(result: ExportResult) => void} resultCallback - Callback for export result.
   */
  /**
   * Export spans through the wrapped exporter.
   * @param spans - Read-only array of spans to export.
   * @param resultCallback - Callback invoked with export result.
   * @remarks
   * This method wraps the underlying export call in a try/catch to ensure
   * unexpected synchronous errors are logged and converted to a failed
   * ExportResult for the callback.
   */
  export(
    spans: ReadonlyArray<ReadableSpan>,
    resultCallback: (result: ExportResult) => void
  ): void {
    this.logger.verbose(`Exporting ${spans.length} spans`);

    try {
      this.exporter.export(spans as ReadableSpan[], (result: ExportResult) => {
        if (result.code !== ExportResultCode.SUCCESS) {
          this.logger.error({
            msg: 'OTel span export failed',
            code: result.code,
            error: result.error,
          });
        } else {
          this.logger.verbose(`Successfully exported ${spans.length} spans`);
        }
        resultCallback(result);
      });
    } catch (err: unknown) {
      const errorMsg = String(err ?? 'unknown error');
      const runtimeError = new Error(errorMsg);
      this.logger.error({
        msg: 'Unexpected exception during exporter.export',
        error: runtimeError,
      });
      // Ensure the callback receives a failure result rather than leaving
      // the caller without a response.
      resultCallback({ code: ExportResultCode.FAILED, error: runtimeError });
    }
  }

  /**
   * Force the underlying exporter to flush.
   * @returns A promise that resolves when flush is complete.
   */
  async forceFlush(): Promise<void> {
    this.logger.debug('Forcing flush of OTel exporter');

    try {
      await this.exporter.forceFlush();
    } catch (err: unknown) {
      const errorMsg = String(err ?? 'unknown error');
      this.logger.error({
        msg: 'Failed forcing flush on exporter',
        error: errorMsg,
      });
      throw new Error(`TraceExporter.forceFlush failed: ${errorMsg}`);
    }
  }

  /**
   * Shuts down the exporter.
   * @returns {Promise<void>} A promise that resolves when shutdown is complete.
   */
  /**
   * Shut down the wrapped exporter and release resources.
   * @returns A promise that resolves when shutdown completes.
   */
  async shutdown(): Promise<void> {
    this.logger.debug('Shutting down OTel exporter');

    try {
      await this.exporter.shutdown();
    } catch (err: unknown) {
      const errorMsg = String(err ?? 'unknown error');
      this.logger.error({ msg: 'Exporter shutdown failed', error: errorMsg });
      throw new Error(`TraceExporter.shutdown failed: ${errorMsg}`);
    }
  }
}
