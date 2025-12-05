import {
  CompositePropagator,
  W3CTraceContextPropagator,
  W3CBaggagePropagator,
} from '@opentelemetry/core';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { StandardizedLogger } from '../logger/standardized-logger';
import { SpanExporter } from '@opentelemetry/sdk-trace-base';
import { Instrumentation } from '@opentelemetry/instrumentation';
import { trace, SpanOptions, context } from '@opentelemetry/api';
import { Sampler } from '@opentelemetry/sdk-trace-base';
import { buildSpanExporter } from './exporter-factory';
import { createSamplerFromConfig } from './sampler-factory';
import type { SamplerConfig } from './sampler-factory';
import { TraceProcessor } from './trace-processor';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { IncomingMessage } from 'http';

export type StandardizedTracerConfig = {
  environment: string;
  serviceName: string;
  serviceVersion: string;
  metrics?: {
    enabled?: boolean;
    metricsPort?: number;
  };
  otlpEndpoint: string;
  otlpHeaders?: Record<string, string>;
  /** Additional resource attributes to merge into the SDK resource */
  resourceAttributes?: Record<string, string>;
  /** Sampling configuration */
  sampler?:
    | { type: 'always_on' }
    | { type: 'always_off' }
    | { type: 'traceidratio'; ratio: number }
    | {
        type: 'parentbased';
        root?: {
          type: 'always_on' | 'always_off' | 'traceidratio';
          ratio?: number;
        };
      };
  redactedQueryParams?: string[];
  batchProcessMaxQueueSize?: number;
  batchProcessMaxExportBatchSize?: number;
  batchProcessScheduledDelayMillis?: number;
  batchProcessExportTimeoutMillis?: number;
  loggingExtra?: Record<string, unknown>;
};

export class StandardizedTracer {
  /**
   * StandardizedTracer
   * @remarks
   * A small helper wrapper around OpenTelemetry Node SDK providing a
   * consistent initialization surface, a configured span processor, and
   * convenience helpers used by consumers and tests.
   *
   * This class intentionally keeps a singleton instance so that multiple
   * parts of an application can call initialize() once and use
   * StandardizedTracer.getInstance() after that.
   */
  private static logger: StandardizedLogger;
  private static instance: StandardizedTracer;

  public static initialize(
    config: StandardizedTracerConfig,
    instrumentations?: Instrumentation[]
  ): void {
    if (!StandardizedTracer.instance) {
      StandardizedTracer.logger = new StandardizedLogger({
        context: StandardizedTracer.name,
        extra: { serviceName: config.serviceName, ...config.loggingExtra },
      });
      StandardizedTracer.instance = new StandardizedTracer(
        config,
        instrumentations
      );
      try {
        StandardizedTracer.instance.otelSDK.start();
        StandardizedTracer.logger.info('OTel SDK started successfully');
      } catch (err) {
        StandardizedTracer.logger.error({
          msg: 'Failed to start OTel SDK',
          err,
        });
        throw err;
      }
    } else {
      throw new Error('Observability has already been initialized.');
    }
  }

  /** Build sampler instance from config and return object to merge into NodeSDK options */
  private buildSamplerOption(
    config: StandardizedTracerConfig
  ): { sampler?: Sampler } | undefined {
    const sampler = createSamplerFromConfig(
      config.sampler as SamplerConfig | undefined
    );
    return sampler ? { sampler } : undefined;
  }

  /**
   * Returns the singleton StandardizedTracer instance.
   * @throws if the instance has not been initialized.
   */
  public static getInstance(): StandardizedTracer {
    if (!StandardizedTracer.instance) {
      throw new Error(
        'Observability is not initialized. Call initialize() first.'
      );
    }
    return StandardizedTracer.instance;
  }

  /**
   * Gracefully shut down the tracer: flush spans then shut down the SDK.
   * @returns Promise<void> resolved when shutdown completes.
   * @throws if shutdown is called before initialization.
   */
  public static async shutdown(): Promise<void> {
    if (!StandardizedTracer.instance) {
      throw new Error(
        'Observability is not initialized. Call initialize() first.'
      );
    }
    StandardizedTracer.logger.info('OTel SDK shutting down');
    try {
      await StandardizedTracer.instance.spanProcessor.forceFlush();
      await StandardizedTracer.instance.spanProcessor.shutdown();
      await StandardizedTracer.instance.otelSDK.shutdown();
      StandardizedTracer.logger.info('OTel SDK shut down successfully');
    } catch (err) {
      StandardizedTracer.logger.error({
        msg: 'Error during OTel SDK shutdown',
        err,
      });
    }
  }

  /**
   * Run a callback inside a newly started span and return its result.
   *
   * @typeParam T - return type of the provided callback
   * @param name - span name
   * @param fn - callback to run inside span context
   * @param options - optional span creation options
   * @returns the value returned by fn
   * @remarks
   * Convenience helper for tests and consumers to create a short-lived span
   * and ensure it is ended properly. This does not change the singleton
   * lifecycle and uses the global tracer from OpenTelemetry.
   */
  public static async withSpanContext<T>(
    name: string,
    fn: () => Promise<T> | T,
    options?: SpanOptions
  ): Promise<T> {
    if (!StandardizedTracer.instance) {
      throw new Error(
        'Observability is not initialized. Call initialize() first.'
      );
    }

    const tracer = trace.getTracer(this.instance.serviceName);

    // create a span manually and run the callback inside its context.
    // This avoids TypeScript overload issues with `startActiveSpan`.
    const span = tracer.startSpan(name, options ?? {});
    try {
      return await context.with(
        trace.setSpan(context.active(), span),
        async () => {
          try {
            return await fn();
          } finally {
            // no-op here; outer finally will end the span
          }
        }
      );
    } finally {
      span.end();
    }
  }
  public readonly serviceName: string;
  public readonly serviceVersion: string;
  public readonly spanProcessor: TraceProcessor;
  public otelSDK: NodeSDK;

  /**
   * Internal constructor — application code should call initialize() instead.
   *
   * @param config - tracer configuration
   * @param instrumentations - optional instrumentations to pass to NodeSDK
   */
  protected constructor(
    config: StandardizedTracerConfig,
    instrumentations?: Instrumentation[]
  ) {
    // Avoid logging full config objects (potentially sensitive). Log a
    // non-sensitive subset of configuration at debug level instead.
    StandardizedTracer.logger.debug({
      msg: 'Initializing Standardized Tracer',
    });

    StandardizedTracer.logger.verbose({
      msg: 'Tracer Configuration',
      config,
    });

    this.serviceName = config.serviceName;
    this.serviceVersion = config.serviceVersion;

    const exporter = this.getSpanExporter(config);
    this.spanProcessor = new TraceProcessor(
      exporter,
      {
        maxQueueSize: config.batchProcessMaxQueueSize,
        maxExportBatchSize: config.batchProcessMaxExportBatchSize,
        scheduledDelayMillis: config.batchProcessScheduledDelayMillis,
        exportTimeoutMillis: config.batchProcessExportTimeoutMillis,
      },
      StandardizedTracer.logger
    );
    this.otelSDK = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: this.serviceName,
        [ATTR_SERVICE_VERSION]: this.serviceVersion,
        ['service.environment']: config.environment,
        ...(config.resourceAttributes || {}),
      }),
      ...(this.buildSamplerOption(config) || {}),
      // Configure Prometheus exporter only when explicitly enabled via
      // the `metrics` object. Use the provided port or default to 9464.
      metricReader: config.metrics?.enabled
        ? new PrometheusExporter({ port: config.metrics?.metricsPort ?? 9464 })
        : undefined,
      contextManager: new AsyncLocalStorageContextManager(),
      textMapPropagator: new CompositePropagator({
        propagators: [
          new W3CTraceContextPropagator(),
          new W3CBaggagePropagator(),
        ],
      }),
      instrumentations: [
        new HttpInstrumentation({
          ignoreIncomingRequestHook: (req: IncomingMessage) =>
            req.url === '/metrics' || req.url === '/health',
          redactedQueryParams: config.redactedQueryParams,
        }),
        ...(instrumentations || []),
      ],
      spanProcessor: this.spanProcessor,
    });
    StandardizedTracer.logger.debug('Standardized Tracer initialized');
  }

  /**
   * Build a SpanExporter backed by OTLP HTTP or gRPC exporter based on
   * configuration. Does not include headers in logs and throws if the
   * provided endpoint has an unsupported protocol.
   *
   * @param config - a subset of StandardizedTracerConfig with endpoint/headers
   * @returns a SpanExporter to pass to the SpanProcessor
   * @throws when the endpoint does not begin with http(s) or grpc(s).
   */
  private getSpanExporter(
    config: Pick<StandardizedTracerConfig, 'otlpEndpoint' | 'otlpHeaders'>
  ): SpanExporter {
    StandardizedTracer.logger.debug(
      `Configuring OTLP exporter for endpoint: ${config.otlpEndpoint}`
    );
    // Use the exporter factory which includes parsing + exporter construction.
    try {
      return buildSpanExporter(
        config.otlpEndpoint,
        config.otlpHeaders,
        StandardizedTracer.logger
      );
    } catch (err) {
      StandardizedTracer.logger.error({
        msg: 'Invalid OTLP endpoint URL',
        endpoint: config.otlpEndpoint,
      });
      throw err;
    }
  }
}
