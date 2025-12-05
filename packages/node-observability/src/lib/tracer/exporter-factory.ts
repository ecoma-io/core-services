import { OTLPTraceExporter as GrpcOltpTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPTraceExporter as HttpOltpTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ChannelCredentials } from '@grpc/grpc-js';
import { SpanExporter } from '@opentelemetry/sdk-trace-base';
import { TraceExporter } from './trace-exporter';
import { StandardizedLogger } from '../logger/standardized-logger';
import { parseOtlpEndpoint } from './otlp-endpoint';

/**
 * Builds and returns an OTLP SpanExporter for the provided OTLP endpoint.
 *
 * This function parses the supplied endpoint (using `parseOtlpEndpoint`) and constructs
 * the appropriate OpenTelemetry exporter:
 * - For `http` / `https` endpoints it creates an instance of the HTTP OTLP exporter and
 *   appends `/v1/traces` to the parsed URL.
 * - For `grpc` / `grpcs` endpoints it creates an instance of the gRPC OTLP exporter and
 *   passes gRPC channel credentials (`createInsecure()` for `grpc`, undefined for `grpcs`).
 *
 * If a `logger` is provided the created exporter is wrapped in a `TraceExporter` which
 * delegates export calls and emits standardized logging around export activity.
 *
 * @remarks
 * This function expects `endpoint` to be a valid OTLP endpoint string recognizable by
 * `parseOtlpEndpoint`. Supported protocols are `http`, `https`, `grpc`, and `grpcs`.
 * The returned object implements the OpenTelemetry `SpanExporter` interface.
 *
 * @param endpoint - The OTLP endpoint URL or address to which spans should be exported.
 *                   Examples: "https://otel.example.com", "http://localhost:4318",
 *                   "grpc://collector:4317", "grpcs://collector:4317".
 * @param headers - Optional map of request headers to attach to exporter requests (e.g. for auth).
 *                  These headers are forwarded to the underlying OTLP exporter implementation.
 * @param logger - Optional standardized logger. When provided, the created exporter is wrapped
 *                 in a `TraceExporter` that logs export operations and errors.
 *
 * @returns A configured `SpanExporter`. This is either a raw OTLP exporter instance
 *          (HTTP or gRPC) or a `TraceExporter` wrapper around it when `logger` is given.
 *
 * @throws {TypeError} If the provided `endpoint` cannot be parsed into a supported OTLP
 *                     configuration, a `TypeError` is thrown as a safety fallback.
 *
 * @example
 * ```ts
 * // HTTP exporter
 * const exporter = buildSpanExporter('https://otel.example.com', { Authorization: 'Bearer ...' });
 *
 * // gRPC exporter with logging wrapper
 * const exporterWithLogging = buildSpanExporter('grpcs://collector:4317', undefined, myLogger);
 * ```
 */
export function buildSpanExporter(
  endpoint: string,
  headers?: Record<string, string>,
  logger?: StandardizedLogger
): SpanExporter {
  const parsed = parseOtlpEndpoint(endpoint);
  let exporter: SpanExporter;

  if (parsed.protocol === 'http' || parsed.protocol === 'https') {
    exporter = new HttpOltpTraceExporter({
      url: parsed.url + '/v1/traces',
      headers,
    });
  }

  // grpc / grpcs
  if ('host' in parsed) {
    exporter = new GrpcOltpTraceExporter({
      credentials:
        parsed.protocol === 'grpc'
          ? ChannelCredentials.createInsecure()
          : undefined,
      url: parsed.host,
      headers,
    });
  }

  if (logger && exporter) {
    return new TraceExporter(exporter, logger);
  } else if (exporter) {
    return exporter;
  } else {
    // should not happen, but keep safe
    throw new TypeError(`Invalid OTLP endpoint data for exporter: ${endpoint}`);
  }
}
