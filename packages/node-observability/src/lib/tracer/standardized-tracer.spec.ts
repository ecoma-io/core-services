jest.mock('pino');

// Ensure Prometheus exporter is mocked in all unit tests so they don't bind ports
const promMock = jest.fn(() => ({}));
jest.doMock('@opentelemetry/exporter-prometheus', () => ({
  PrometheusExporter: promMock,
}));

type Captured = { opts?: any; nodeSdkOpts?: any };

/**
 * Comprehensive tests for StandardizedTracer.
 *
 * These tests mock external dependencies (NodeSDK, TraceProcessor, TraceExporter)
 * so they remain unit tests and do not start the real OpenTelemetry SDK.
 *
 * This file consolidates all StandardizedTracer tests including:
 * - Basic lifecycle (initialize, getInstance, shutdown)
 * - Exporter selection (HTTP, gRPC, gRPCs)
 * - Sampler configuration (AlwaysOn, AlwaysOff, TraceIdRatio, ParentBased)
 * - Error handling and edge cases
 * - Span context management
 */

describe('standardizedTracer', (): void => {
  beforeEach((): void => {
    // Reset module registry so static singletons are fresh for each test.
    jest.resetModules();
    jest.clearAllMocks();
  });

  afterEach((): void => {
    // keep tests isolated and ensure any mocks are reset/cleared/restored
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('basic lifecycle and initialization', (): void => {
    test('initialize starts the NodeSDK and creates a singleton', async (): Promise<void> => {
      // Arrange: mock NodeSDK, TraceProcessor and TraceExporter before importing
      const startSpy = jest.fn();
      const shutdownSpy = jest.fn();

      // Mock pino for StandardizedLogger
      const fakePinoLogger = {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
        trace: jest.fn(),
        warn: jest.fn(),
        fatal: jest.fn(),
        flush: jest.fn((cb: any) => cb && cb(undefined)),
      };
      jest.doMock('pino', () => jest.fn(() => fakePinoLogger));

      jest.doMock('@opentelemetry/sdk-node', () => ({
        NodeSDK: jest.fn().mockImplementation(() => ({
          start: startSpy,
          shutdown: shutdownSpy,
        })),
      }));

      // TraceProcessor: mock to provide forceFlush/shutdown hooks
      const forceFlushSpy = jest.fn().mockResolvedValue(undefined);
      const processorShutdownSpy = jest.fn().mockResolvedValue(undefined);

      jest.doMock('./trace-processor', () => ({
        TraceProcessor: jest.fn().mockImplementation(() => ({
          forceFlush: forceFlushSpy,
          shutdown: processorShutdownSpy,
        })),
      }));

      // TraceExporter stub – constructor is not required to do anything special
      jest.doMock('./trace-exporter', () => ({
        TraceExporter: jest.fn().mockImplementation(() => ({
          /* stub */
        })),
      }));

      // Now import the module under test
      const { StandardizedTracer } = await import('./standardized-tracer');
      const { StandardizedLogger } = await import(
        '../logger/standardized-logger'
      );

      // Initialize the global logger in high level so tests are quiet
      StandardizedLogger.initialize({ level: 'fatal' });

      // Act
      const cfg = {
        environment: 'test',
        serviceName: 'svc',
        serviceVersion: '1.0',
        otlpEndpoint: 'http://localhost:4318',
        metrics: { enabled: true, metricsPort: 9464 },
      } as const;

      // initialize should call NodeSDK.start (mocked)
      StandardizedTracer.initialize(cfg);

      // Assert
      expect(startSpy).toHaveBeenCalled();

      // shutdown should call the processor and SDK shutdown hooks
      await StandardizedTracer.shutdown();

      expect(forceFlushSpy).toHaveBeenCalled();
      expect(processorShutdownSpy).toHaveBeenCalled();
      expect(shutdownSpy).toHaveBeenCalled();
    });

    test('double initialize throws', async (): Promise<void> => {
      // Mock pino for StandardizedLogger
      const fakePinoLogger = {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
        trace: jest.fn(),
        warn: jest.fn(),
        fatal: jest.fn(),
        flush: jest.fn((cb: any) => cb && cb(undefined)),
      };
      jest.doMock('pino', () => jest.fn(() => fakePinoLogger));

      jest.doMock('@opentelemetry/sdk-node', () => ({
        NodeSDK: jest.fn().mockImplementation(() => ({
          start: jest.fn(),
          shutdown: jest.fn(),
        })),
      }));
      jest.doMock('./trace-processor', () => ({
        TraceProcessor: jest.fn().mockImplementation(() => ({
          forceFlush: jest.fn(),
        })),
      }));
      jest.doMock('./trace-exporter', () => ({
        TraceExporter: jest.fn().mockImplementation(() => ({
          /* stub */
        })),
      }));

      const { StandardizedTracer } = await import('./standardized-tracer');
      const { StandardizedLogger } = await import(
        '../logger/standardized-logger'
      );

      StandardizedLogger.initialize({ level: 'fatal' });

      const cfg = {
        environment: 'test',
        serviceName: 'svc',
        serviceVersion: '1.0',
        otlpEndpoint: 'http://localhost:4318',
        metrics: { enabled: true, metricsPort: 9464 },
      } as const;

      // first initialization is OK
      StandardizedTracer.initialize(cfg);

      // second initialization should throw
      expect(() => StandardizedTracer.initialize(cfg)).toThrow(
        /already been initialized/
      );
    });

    test('getInstance and shutdown throw when not initialized and withSpanContext errors when not initialized', async (): Promise<void> => {
      const { StandardizedTracer } = await import('./standardized-tracer');
      // getInstance should throw when not initialized
      expect(() => StandardizedTracer.getInstance()).toThrow(/not initialized/);

      // shutdown should throw when not initialized
      await expect(StandardizedTracer.shutdown()).rejects.toThrow(
        /not initialized/
      );

      // withSpanContext should also throw when not initialized
      await expect(
        StandardizedTracer.withSpanContext('x', async () => 'ok')
      ).rejects.toThrow(/not initialized/);
    });

    test('initialize fails and logs error when NodeSDK.start throws', async (): Promise<void> => {
      const startError = new Error('SDK start failed');
      const fakePinoLogger = {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
        trace: jest.fn(),
        warn: jest.fn(),
        fatal: jest.fn(),
        flush: jest.fn((cb: any) => cb && cb(undefined)),
      };
      jest.doMock('pino', () => jest.fn(() => fakePinoLogger));

      jest.doMock('@opentelemetry/sdk-node', () => ({
        NodeSDK: jest.fn().mockImplementation(() => ({
          start: jest.fn().mockImplementation(() => {
            throw startError;
          }),
          shutdown: jest.fn(),
        })),
      }));

      jest.doMock('./trace-processor', () => ({
        TraceProcessor: jest.fn().mockImplementation(() => ({
          forceFlush: jest.fn(),
          shutdown: jest.fn(),
        })),
      }));

      jest.doMock('./trace-exporter', () => ({
        TraceExporter: jest.fn().mockImplementation(() => ({})),
      }));

      const { StandardizedTracer } = await import('./standardized-tracer');
      const { StandardizedLogger } = await import(
        '../logger/standardized-logger'
      );

      StandardizedLogger.initialize({ level: 'fatal' });

      const cfg = {
        environment: 'test',
        serviceName: 'svc',
        serviceVersion: '1.0',
        otlpEndpoint: 'http://localhost:4318',
        metrics: { enabled: true, metricsPort: 9464 },
      } as const;

      expect(() => StandardizedTracer.initialize(cfg)).toThrow(startError);
      // The logger.error is called with an object containing msg, err, context, and serviceName
      expect(fakePinoLogger.error).toHaveBeenCalled();
      const errorCall = fakePinoLogger.error.mock.calls[0];
      expect(errorCall[0]).toMatchObject({
        msg: 'Failed to start OTel SDK',
        err: startError,
        context: 'StandardizedTracer',
        serviceName: 'svc',
      });
    });
  });

  describe('exporter selection and configuration', (): void => {
    // Exporter + sampling configuration tests were moved into separate
    // unit tests (exporter-factory.spec.ts and sampler-factory.spec.ts).
    // Here we intentionally avoid duplicating those assertions and keep the
    // StandardizedTracer test-suite focused on the class lifecycle only.
  });

  test('initialize logs an error and throws when exporter parsing fails', async (): Promise<void> => {
    const fakePinoLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      trace: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: any) => cb && cb(undefined)),
    };
    jest.doMock('pino', () => jest.fn(() => fakePinoLogger));

    // NodeSDK should not be constructed because exporter parsing will fail,
    // but we still mock it to avoid accidental real behavior.
    jest.doMock('@opentelemetry/sdk-node', () => ({
      NodeSDK: jest
        .fn()
        .mockImplementation(() => ({ start: jest.fn(), shutdown: jest.fn() })),
    }));

    // Keep trace-processor mock minimal
    jest.doMock('./trace-processor', () => ({
      TraceProcessor: jest.fn().mockImplementation(() => ({
        forceFlush: jest.fn(),
        shutdown: jest.fn(),
      })),
    }));

    const { StandardizedTracer } = await import('./standardized-tracer');
    const { StandardizedLogger } = await import(
      '../logger/standardized-logger'
    );

    StandardizedLogger.initialize({ level: 'fatal' });

    // Provide an unsupported endpoint so buildSpanExporter.parse throws and
    // StandardizedTracer.getSpanExporter catches and logs
    expect(() =>
      StandardizedTracer.initialize({
        environment: 'test',
        serviceName: 'svc',
        serviceVersion: '1.0',
        otlpEndpoint: 'unsupported://host',
        metrics: { enabled: true, metricsPort: 9464 },
      } as const)
    ).toThrow();

    expect(fakePinoLogger.error).toHaveBeenCalled();
  });

  describe('sampler configuration (smoke)', (): void => {
    test('accepts sampler option and passes it to NodeSDK options', (): void => {
      // Minimal assert that ensures StandardizedTracer forwards sampler options
      const captured: Captured = {};

      const NodeSDKMock = jest.fn(function (opts: any) {
        captured.opts = opts;
        return { start: jest.fn(), shutdown: jest.fn() };
      });
      jest.doMock('@opentelemetry/sdk-node', () => ({ NodeSDK: NodeSDKMock }));

      const { StandardizedLogger } = require('../logger/standardized-logger');
      const { StandardizedTracer } = require('./standardized-tracer');

      StandardizedLogger.initialize({ level: 'info' });

      StandardizedTracer.initialize(
        {
          environment: 'prod',
          serviceName: 'svc',
          serviceVersion: '1.0.0',
          otlpEndpoint: 'http://localhost:4318',
          metrics: { enabled: true, metricsPort: 9464 },
          sampler: { type: 'always_on' },
        },
        []
      );

      expect(captured.opts).toBeDefined();
      expect(captured.opts.sampler).toBeDefined();
    });
  });

  describe('shutdown and error handling', (): void => {
    test('shutdown logs errors when spanProcessor.forceFlush throws', async (): Promise<void> => {
      const captured: Captured = {};

      const fakePinoLogger = {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
        trace: jest.fn(),
        warn: jest.fn(),
        fatal: jest.fn(),
        flush: jest.fn((cb: any) => cb && cb(undefined)),
      };
      jest.doMock('pino', () => jest.fn(() => fakePinoLogger));

      // Minimal exporter mock used by TraceProcessor
      const exporterMock = jest.fn(() => ({
        forceFlush: jest.fn(),
        shutdown: jest.fn(),
      }));
      jest.doMock('@opentelemetry/exporter-trace-otlp-http', () => ({
        OTLPTraceExporter: exporterMock,
      }));

      // Mock NodeSDK
      const startMock = jest.fn();
      const shutdownMock = jest.fn();
      const NodeSDKMock = jest.fn(function (opts: any) {
        captured.nodeSdkOpts = opts;
        return { start: startMock, shutdown: shutdownMock };
      });
      jest.doMock('@opentelemetry/sdk-node', () => ({ NodeSDK: NodeSDKMock }));

      const { StandardizedTracer } = await import('./standardized-tracer');
      const { StandardizedLogger } = await import(
        '../logger/standardized-logger'
      );

      StandardizedLogger.initialize({ level: 'info' });

      StandardizedTracer.initialize({
        environment: 'prod',
        serviceName: 'svc',
        serviceVersion: '1.2.3',
        otlpEndpoint: 'http://otel:4318',
        metrics: { enabled: true, metricsPort: 9464 },
      });

      // Replace the spanProcessor with a fake that throws on forceFlush
      const instance = StandardizedTracer.getInstance();
      (
        instance as unknown as {
          spanProcessor: { forceFlush: jest.Mock; shutdown: jest.Mock };
        }
      ).spanProcessor = {
        forceFlush: jest.fn().mockRejectedValue(new Error('flush fail')),
        shutdown: jest.fn().mockResolvedValue(undefined),
      };

      // Call shutdown and ensure it resolves (errors are caught) and logger.error called
      await expect(StandardizedTracer.shutdown()).resolves.toBeUndefined();
      // logger.error should have been called at least once
      expect(fakePinoLogger.error).toHaveBeenCalled();
    });

    test('shutdown logs errors when spanProcessor.shutdown throws', async (): Promise<void> => {
      const captured: Captured = {};

      const fakePinoLogger = {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
        trace: jest.fn(),
        warn: jest.fn(),
        fatal: jest.fn(),
        flush: jest.fn((cb: any) => cb && cb(undefined)),
      };
      jest.doMock('pino', () => jest.fn(() => fakePinoLogger));

      const exporterMock = jest.fn(() => ({
        forceFlush: jest.fn(),
        shutdown: jest.fn(),
      }));
      jest.doMock('@opentelemetry/exporter-trace-otlp-http', () => ({
        OTLPTraceExporter: exporterMock,
      }));

      const startMock = jest.fn();
      const shutdownMock = jest.fn();
      const NodeSDKMock = jest.fn(function (opts: any) {
        captured.nodeSdkOpts = opts;
        return { start: startMock, shutdown: shutdownMock };
      });
      jest.doMock('@opentelemetry/sdk-node', () => ({ NodeSDK: NodeSDKMock }));

      const { StandardizedTracer } = await import('./standardized-tracer');
      const { StandardizedLogger } = await import(
        '../logger/standardized-logger'
      );

      StandardizedLogger.initialize({ level: 'info' });

      StandardizedTracer.initialize({
        environment: 'prod',
        serviceName: 'svc',
        serviceVersion: '1.2.3',
        otlpEndpoint: 'http://otel:4318',
        metrics: { enabled: true, metricsPort: 9464 },
      });

      // Replace the spanProcessor with a fake that throws on shutdown
      const instance = StandardizedTracer.getInstance();
      (
        instance as unknown as {
          spanProcessor: { forceFlush: jest.Mock; shutdown: jest.Mock };
        }
      ).spanProcessor = {
        forceFlush: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockRejectedValue(new Error('shutdown fail')),
      };

      await expect(StandardizedTracer.shutdown()).resolves.toBeUndefined();
      expect(fakePinoLogger.error).toHaveBeenCalled();
    });

    test('shutdown logs errors when SDK.shutdown throws', async (): Promise<void> => {
      const captured: Captured = {};

      const fakePinoLogger = {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
        trace: jest.fn(),
        warn: jest.fn(),
        fatal: jest.fn(),
        flush: jest.fn((cb: any) => cb && cb(undefined)),
      };
      jest.doMock('pino', () => jest.fn(() => fakePinoLogger));

      const exporterMock = jest.fn(() => ({
        forceFlush: jest.fn(),
        shutdown: jest.fn(),
      }));
      jest.doMock('@opentelemetry/exporter-trace-otlp-http', () => ({
        OTLPTraceExporter: exporterMock,
      }));

      const startMock = jest.fn();
      const shutdownMock = jest
        .fn()
        .mockRejectedValue(new Error('SDK shutdown fail'));
      const NodeSDKMock = jest.fn(function (opts: any) {
        captured.nodeSdkOpts = opts;
        return { start: startMock, shutdown: shutdownMock };
      });
      jest.doMock('@opentelemetry/sdk-node', () => ({ NodeSDK: NodeSDKMock }));

      const { StandardizedTracer } = await import('./standardized-tracer');
      const { StandardizedLogger } = await import(
        '../logger/standardized-logger'
      );

      StandardizedLogger.initialize({ level: 'info' });

      StandardizedTracer.initialize({
        environment: 'prod',
        serviceName: 'svc',
        serviceVersion: '1.2.3',
        otlpEndpoint: 'http://otel:4318',
        metrics: { enabled: true, metricsPort: 9464 },
      });

      await expect(StandardizedTracer.shutdown()).resolves.toBeUndefined();
      expect(fakePinoLogger.error).toHaveBeenCalled();
    });

    test('does not configure Prometheus exporter when metrics disabled', async (): Promise<void> => {
      const captured: Captured = {};

      const fakePinoLogger = {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
        trace: jest.fn(),
        warn: jest.fn(),
        fatal: jest.fn(),
        flush: jest.fn((cb: any) => cb && cb(undefined)),
      };
      jest.doMock('pino', () => jest.fn(() => fakePinoLogger));

      // Minimal exporter mock used by TraceProcessor
      const exporterMock = jest.fn(() => ({
        forceFlush: jest.fn(),
        shutdown: jest.fn(),
      }));
      jest.doMock('@opentelemetry/exporter-trace-otlp-http', () => ({
        OTLPTraceExporter: exporterMock,
      }));

      // Capture NodeSDK options to verify metricReader is undefined
      const startMock = jest.fn();
      const shutdownMock = jest.fn();
      const NodeSDKMock = jest.fn(function (opts: any) {
        captured.nodeSdkOpts = opts;
        return { start: startMock, shutdown: shutdownMock };
      });
      jest.doMock('@opentelemetry/sdk-node', () => ({ NodeSDK: NodeSDKMock }));

      const { StandardizedTracer } = await import('./standardized-tracer');
      const { StandardizedLogger } = await import(
        '../logger/standardized-logger'
      );

      StandardizedLogger.initialize({ level: 'info' });

      // Provide explicit metrics.disabled and no legacy metricsPort
      StandardizedTracer.initialize({
        environment: 'prod',
        serviceName: 'svc',
        serviceVersion: '1.2.3',
        otlpEndpoint: 'http://otel:4318',
        metrics: { enabled: false },
      } as any);

      // metricReader should not be configured
      expect(captured.nodeSdkOpts).toBeDefined();
      expect(captured.nodeSdkOpts.metricReader).toBeUndefined();

      await StandardizedTracer.shutdown();
    });
  });

  describe('span context management', (): void => {
    test('withSpanContext starts/ends a span and returns the inner value', async (): Promise<void> => {
      // Arrange: mock SDK + processor/exporter
      const startSpy = jest.fn();
      const shutdownSpy = jest.fn();

      jest.doMock('@opentelemetry/sdk-node', () => ({
        NodeSDK: jest.fn().mockImplementation(() => ({
          start: startSpy,
          shutdown: shutdownSpy,
        })),
      }));

      const forceFlushSpy = jest.fn().mockResolvedValue(undefined);
      const processorShutdownSpy = jest.fn().mockResolvedValue(undefined);

      jest.doMock('./trace-processor', () => ({
        TraceProcessor: jest.fn().mockImplementation(() => ({
          forceFlush: forceFlushSpy,
          shutdown: processorShutdownSpy,
        })),
      }));

      jest.doMock('./trace-exporter', () => ({
        TraceExporter: jest.fn().mockImplementation(() => ({
          /* stub */
        })),
      }));

      // Mock API tracer/context behaviour
      const spanEnd = jest.fn();
      const startSpan = jest.fn().mockImplementation(() => ({ end: spanEnd }));
      const getTracer = jest.fn().mockReturnValue({ startSpan });
      const setSpan = jest.fn((_, s) => s);
      const active = jest.fn();
      const withFn = jest.fn((_ctx, cb) => cb());

      jest.doMock('@opentelemetry/api', () => {
        const actual = jest.requireActual('@opentelemetry/api');
        return {
          ...actual,
          trace: { ...actual.trace, getTracer, setSpan },
          context: { ...actual.context, active, with: withFn },
        };
      });

      const { StandardizedTracer } = await import('./standardized-tracer');
      const { StandardizedLogger } = await import(
        '../logger/standardized-logger'
      );

      StandardizedLogger.initialize({ level: 'fatal' });

      const cfg = {
        environment: 'test',
        serviceName: 'svc',
        serviceVersion: '1.0',
        otlpEndpoint: 'http://localhost:4318',
        metrics: { enabled: true, metricsPort: 9464 },
      } as const;

      // initialize should succeed
      StandardizedTracer.initialize(cfg);

      // Act: run withSpanContext and ensure return value is propagated and span.end is called
      const result = await (StandardizedTracer as any).withSpanContext(
        'nm',
        async () => 'value'
      );

      expect(result).toBe('value');
      expect(getTracer).toHaveBeenCalledWith('svc');
      expect(startSpan).toHaveBeenCalledWith('nm', {});
      expect(spanEnd).toHaveBeenCalled();

      // cleanup
      await StandardizedTracer.shutdown();
    });

    test('withSpanContext forwards provided options to startSpan', async (): Promise<void> => {
      const startSpy = jest.fn();
      const shutdownSpy = jest.fn();

      jest.doMock('@opentelemetry/sdk-node', () => ({
        NodeSDK: jest.fn().mockImplementation(() => ({
          start: startSpy,
          shutdown: shutdownSpy,
        })),
      }));

      const forceFlushSpy = jest.fn().mockResolvedValue(undefined);
      const processorShutdownSpy = jest.fn().mockResolvedValue(undefined);

      jest.doMock('./trace-processor', () => ({
        TraceProcessor: jest.fn().mockImplementation(() => ({
          forceFlush: forceFlushSpy,
          shutdown: processorShutdownSpy,
        })),
      }));

      jest.doMock('./trace-exporter', () => ({
        TraceExporter: jest.fn().mockImplementation(() => ({
          /* stub */
        })),
      }));

      const spanEnd = jest.fn();
      const startSpan = jest.fn().mockImplementation(() => ({ end: spanEnd }));
      const getTracer = jest.fn().mockReturnValue({ startSpan });
      const setSpan = jest.fn((_, s) => s);
      const active = jest.fn();
      const withFn = jest.fn((_ctx, cb) => cb());

      jest.doMock('@opentelemetry/api', () => {
        const actual = jest.requireActual('@opentelemetry/api');
        return {
          ...actual,
          trace: { ...actual.trace, getTracer, setSpan },
          context: { ...actual.context, active, with: withFn },
        };
      });

      const { StandardizedTracer } = await import('./standardized-tracer');
      const { StandardizedLogger } = await import(
        '../logger/standardized-logger'
      );

      StandardizedLogger.initialize({ level: 'fatal' });

      StandardizedTracer.initialize({
        environment: 'test',
        serviceName: 'svc',
        serviceVersion: '1.0',
        otlpEndpoint: 'http://localhost:4318',
        metrics: { enabled: true, metricsPort: 9464 },
      } as const);

      const options = { attributes: { a: 'b' } };
      await (StandardizedTracer as any).withSpanContext(
        'nm',
        async () => 'ok',
        options
      );

      expect(startSpan).toHaveBeenCalledWith('nm', options);

      await StandardizedTracer.shutdown();
    });

    test('withSpanContext ends span even when callback throws', async (): Promise<void> => {
      const startSpy = jest.fn();
      const shutdownSpy = jest.fn();

      jest.doMock('@opentelemetry/sdk-node', () => ({
        NodeSDK: jest.fn().mockImplementation(() => ({
          start: startSpy,
          shutdown: shutdownSpy,
        })),
      }));

      const forceFlushSpy = jest.fn().mockResolvedValue(undefined);
      const processorShutdownSpy = jest.fn().mockResolvedValue(undefined);

      jest.doMock('./trace-processor', () => ({
        TraceProcessor: jest.fn().mockImplementation(() => ({
          forceFlush: forceFlushSpy,
          shutdown: processorShutdownSpy,
        })),
      }));

      jest.doMock('./trace-exporter', () => ({
        TraceExporter: jest.fn().mockImplementation(() => ({
          /* stub */
        })),
      }));

      const spanEnd = jest.fn();
      const startSpan = jest.fn().mockImplementation(() => ({ end: spanEnd }));
      const getTracer = jest.fn().mockReturnValue({ startSpan });
      const setSpan = jest.fn((_, s) => s);
      const active = jest.fn();
      const withFn = jest.fn((_ctx, cb) => cb());

      jest.doMock('@opentelemetry/api', () => {
        const actual = jest.requireActual('@opentelemetry/api');
        return {
          ...actual,
          trace: { ...actual.trace, getTracer, setSpan },
          context: { ...actual.context, active, with: withFn },
        };
      });

      const { StandardizedTracer } = await import('./standardized-tracer');
      const { StandardizedLogger } = await import(
        '../logger/standardized-logger'
      );

      StandardizedLogger.initialize({ level: 'fatal' });

      const cfg = {
        environment: 'test',
        serviceName: 'svc',
        serviceVersion: '1.0',
        otlpEndpoint: 'http://localhost:4318',
        metrics: { enabled: true, metricsPort: 9464 },
      } as const;

      StandardizedTracer.initialize(cfg);

      const error = new Error('callback error');
      await expect(
        (StandardizedTracer as any).withSpanContext('nm', async () => {
          throw error;
        })
      ).rejects.toThrow(error);

      // span.end should still be called
      expect(spanEnd).toHaveBeenCalled();

      await StandardizedTracer.shutdown();
    });
  });

  test('httpInstrumentation ignoreIncomingRequestHook handles /metrics and /health', async (): Promise<void> => {
    const captured: { httpOpts?: any } = {};

    const fakePinoLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      trace: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: any) => cb && cb(undefined)),
    };
    jest.doMock('pino', () => jest.fn(() => fakePinoLogger));

    // Mock HttpInstrumentation to capture the options passed to its constructor
    jest.doMock('@opentelemetry/instrumentation-http', () => ({
      HttpInstrumentation: jest.fn().mockImplementation((opts: any) => {
        captured.httpOpts = opts;
        return {
          /* stub */
        };
      }),
    }));

    // Mock NodeSDK so we can construct without side effects
    const NodeSDKMock = jest.fn(function (_opts: any) {
      return { start: jest.fn(), shutdown: jest.fn() };
    });
    jest.doMock('@opentelemetry/sdk-node', () => ({ NodeSDK: NodeSDKMock }));

    // Minimal trace processor/exporter mocks
    jest.doMock('./trace-processor', () => ({
      TraceProcessor: jest.fn().mockImplementation(() => ({
        forceFlush: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined),
      })),
    }));
    jest.doMock('./trace-exporter', () => ({
      TraceExporter: jest.fn().mockImplementation(() => ({})),
    }));

    const { StandardizedTracer } = await import('./standardized-tracer');
    const { StandardizedLogger } = await import(
      '../logger/standardized-logger'
    );

    StandardizedLogger.initialize({ level: 'fatal' });

    StandardizedTracer.initialize({
      environment: 'test',
      serviceName: 'svc',
      serviceVersion: '1.0',
      otlpEndpoint: 'http://localhost:4318',
    } as const);

    // The captured httpOpts.ignoreIncomingRequestHook should be a function
    expect(captured.httpOpts).toBeDefined();
    const hook = captured.httpOpts.ignoreIncomingRequestHook;
    expect(typeof hook).toBe('function');

    // Should return true for metrics and health endpoints
    expect(hook({ url: '/metrics' })).toBe(true);
    expect(hook({ url: '/health' })).toBe(true);
    // Should return false for other URLs
    expect(hook({ url: '/foo' })).toBe(false);

    await StandardizedTracer.shutdown();
  });

  test('configures Prometheus exporter when metrics.enabled is true with provided metricsPort', async (): Promise<void> => {
    const captured: { nodeSdkOpts?: any } = {};

    const fakePinoLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      trace: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: any) => cb && cb(undefined)),
    };
    jest.doMock('pino', () => jest.fn(() => fakePinoLogger));

    // Ensure Prometheus exporter mock is available (top-level promMock is defined)
    // Capture NodeSDK options to verify metricReader is configured
    const startMock = jest.fn();
    const shutdownMock = jest.fn();
    const NodeSDKMock = jest.fn(function (opts: any) {
      captured.nodeSdkOpts = opts;
      return { start: startMock, shutdown: shutdownMock };
    });
    jest.doMock('@opentelemetry/sdk-node', () => ({ NodeSDK: NodeSDKMock }));

    // Minimal trace processor/exporter mocks
    jest.doMock('./trace-processor', () => ({
      TraceProcessor: jest.fn().mockImplementation(() => ({
        forceFlush: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined),
      })),
    }));
    jest.doMock('./trace-exporter', () => ({
      TraceExporter: jest.fn().mockImplementation(() => ({})),
    }));

    const { StandardizedTracer } = await import('./standardized-tracer');
    const { StandardizedLogger } = await import(
      '../logger/standardized-logger'
    );

    StandardizedLogger.initialize({ level: 'fatal' });

    // Initialize with metrics.enabled true and explicit metrics.metricsPort
    StandardizedTracer.initialize({
      environment: 'test',
      serviceName: 'svc',
      serviceVersion: '1.0',
      otlpEndpoint: 'http://localhost:4318',
      metrics: { enabled: true, metricsPort: 5555 },
    } as any);

    // The global promMock (declared at top of this file) should have been called with port 5555
    expect(promMock).toHaveBeenCalledWith({ port: 5555 });

    expect(captured.nodeSdkOpts).toBeDefined();
    expect(captured.nodeSdkOpts.metricReader).toBeDefined();

    await StandardizedTracer.shutdown();
  });

  test('uses default Prometheus port 9464 when enabled but no port provided', async (): Promise<void> => {
    const captured: { nodeSdkOpts?: any } = {};

    const fakePinoLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      trace: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: any) => cb && cb(undefined)),
    };
    jest.doMock('pino', () => jest.fn(() => fakePinoLogger));

    const startMock = jest.fn();
    const shutdownMock = jest.fn();
    const NodeSDKMock = jest.fn(function (opts: any) {
      captured.nodeSdkOpts = opts;
      return { start: startMock, shutdown: shutdownMock };
    });
    jest.doMock('@opentelemetry/sdk-node', () => ({ NodeSDK: NodeSDKMock }));

    jest.doMock('./trace-processor', () => ({
      TraceProcessor: jest.fn().mockImplementation(() => ({
        forceFlush: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined),
      })),
    }));
    jest.doMock('./trace-exporter', () => ({
      TraceExporter: jest.fn().mockImplementation(() => ({})),
    }));

    const { StandardizedTracer } = await import('./standardized-tracer');
    const { StandardizedLogger } = await import(
      '../logger/standardized-logger'
    );

    StandardizedLogger.initialize({ level: 'fatal' });

    StandardizedTracer.initialize({
      environment: 'test',
      serviceName: 'svc',
      serviceVersion: '1.0',
      otlpEndpoint: 'http://localhost:4318',
      metrics: { enabled: true },
    } as any);

    expect(promMock).toHaveBeenCalledWith({ port: 9464 });
    expect(captured.nodeSdkOpts.metricReader).toBeDefined();

    await StandardizedTracer.shutdown();
  });
});
