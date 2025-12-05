type Capture = {
  httpOpts?: { url?: string; headers?: Record<string, unknown> };
  wrapperExporter?: unknown;
  wrapperLogger?: unknown;
  grpcOpts?: { url?: string; credentials?: unknown };
};

describe('exporter-factory', () => {
  afterEach(() => {
    // Ensure any module mocks or spies are cleared between tests
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });
  describe('buildSpanExporter', () => {
    test('creates an HTTP OTLP exporter when http url provided', () => {
      // Very small smoke test: ensure we don't throw when constructing
      const { buildSpanExporter } = require('./exporter-factory');
      const exporter = buildSpanExporter('http://example:4318', { a: 'b' });
      expect(exporter).toBeDefined();
      // exporter is a wrapper object (TraceExporter) and should not be null
      expect(typeof exporter).toBe('object');
    });

    test('creates a gRPC OTLP exporter when grpc url provided', () => {
      const { buildSpanExporter } = require('./exporter-factory');
      const exporter = buildSpanExporter('grpc://host:4317');
      expect(exporter).toBeDefined();
      expect(typeof exporter).toBe('object');
    });

    test('passes headers & logger to TraceExporter and underlying HTTP exporter', () => {
      jest.resetModules();
      const captured: Capture = {};

      const fakeLogger = {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        verbose: jest.fn(),
        trace: jest.fn(),
        warn: jest.fn(),
        fatal: jest.fn(),
      } as any;

      // mock HTTP exporter ctor to capture options
      const httpMockCtor = jest.fn(function (opts: any) {
        captured.httpOpts = opts;
        return { forceFlush: jest.fn(), shutdown: jest.fn() } as any;
      });
      jest.doMock('@opentelemetry/exporter-trace-otlp-http', () => ({
        OTLPTraceExporter: httpMockCtor,
      }));

      // Mock TraceExporter wrapper to capture args
      const traceWrapper = jest.fn(function (exporter: any, loggerArg: any) {
        captured.wrapperExporter = exporter;
        captured.wrapperLogger = loggerArg;
        return { forceFlush: jest.fn(), shutdown: jest.fn() } as any;
      });
      jest.doMock('./trace-exporter', () => ({ TraceExporter: traceWrapper }));

      // Import the module under test AFTER mocks are in place
      const { buildSpanExporter } = require('./exporter-factory');

      const headers = { Authorization: 'Bearer x' };
      buildSpanExporter('http://a:4318', headers, fakeLogger);

      expect(captured.httpOpts).toBeDefined();
      expect(captured.httpOpts.url).toContain('/v1/traces');
      expect(captured.httpOpts.headers).toEqual(headers);

      expect(captured.wrapperExporter).toBeDefined();
      expect(captured.wrapperLogger).toBe(fakeLogger);
    });

    test('creates grpcs exporter without insecure credentials', () => {
      jest.resetModules();
      const captured: Capture = {};

      const grpcMockCtor = jest.fn(function (opts: any) {
        captured.grpcOpts = opts;
        return { forceFlush: jest.fn(), shutdown: jest.fn() } as any;
      });
      jest.doMock('@opentelemetry/exporter-trace-otlp-grpc', () => ({
        OTLPTraceExporter: grpcMockCtor,
      }));

      const traceWrapper = jest.fn(function (exporter: any, loggerArg: any) {
        captured.wrapperExporter = exporter;
        captured.wrapperLogger = loggerArg;
        return { forceFlush: jest.fn(), shutdown: jest.fn() } as any;
      });
      jest.doMock('./trace-exporter', () => ({ TraceExporter: traceWrapper }));

      // Stub ChannelCredentials to detect calls
      const channelCreateInsecure = jest.fn(() => 'INSECURE');
      jest.doMock('@grpc/grpc-js', () => ({
        ChannelCredentials: { createInsecure: channelCreateInsecure },
      }));

      const { buildSpanExporter } = require('./exporter-factory');
      buildSpanExporter('grpcs://host:4317');

      expect(captured.grpcOpts).toBeDefined();
      expect(captured.grpcOpts.credentials).toBeUndefined();
      expect(captured.grpcOpts.url).toContain('host:4317');
    });

    test('throws final fallback when parse returns unexpected structure (covers unreachable final throw)', () => {
      jest.resetModules();

      // Mock the external otlp-endpoint module so parseOtlpEndpoint returns
      // an unexpected shape and buildSpanExporter reaches the final throw.
      jest.doMock('./otlp-endpoint', () => ({
        parseOtlpEndpoint: () => ({ protocol: 'unknown' }) as any,
      }));

      const { buildSpanExporter } = require('./exporter-factory');
      expect(() => buildSpanExporter('http://x:4318')).toThrow(
        /Invalid OTLP endpoint data for exporter/
      );
    });

    test('noop logger methods are invoked so those lines are exercised', () => {
      jest.resetModules();

      // Make TraceExporter call all provided logger methods so noopLogger functions are executed
      const traceWrapper = jest.fn(function (_exporter: any, loggerArg: any) {
        loggerArg.info();
        loggerArg.error();
        loggerArg.debug();
        loggerArg.verbose();
        loggerArg.trace();
        loggerArg.warn();
        loggerArg.fatal();
        return { forceFlush: jest.fn(), shutdown: jest.fn() } as any;
      });
      jest.doMock('./trace-exporter', () => ({ TraceExporter: traceWrapper }));

      // Ensure parseOtlpEndpoint uses the real implementation (undo any
      // previous test mocks) so HTTP exporter path is exercised.
      jest.doMock('./otlp-endpoint', () =>
        jest.requireActual('./otlp-endpoint')
      );

      const httpMockCtor = jest.fn(function () {
        return { forceFlush: jest.fn(), shutdown: jest.fn() } as any;
      });
      jest.doMock('@opentelemetry/exporter-trace-otlp-http', () => ({
        OTLPTraceExporter: httpMockCtor,
      }));

      const { buildSpanExporter } = require('./exporter-factory');
      expect(() => buildSpanExporter('http://x:4318')).not.toThrow();
    });
  });
});
