# @ecoma-io/node-observability

Lightweight helpers for centralized LMT (logging, metrics and tracing) used across ecoma projects. It's use for all nodejs apps is strongly recommended to ensure consistent observability practices.

This package provides two opinionated but flexible helpers used across the monorepo:

- `StandardizedLogger` — small wrapper around pino with redaction, structured merging rules and automatic trace id enrichment when used inside an OpenTelemetry span.
- `StandardizedTracer` — a convenient wrapper for the OpenTelemetry Node SDK to configure exporters, instrumentations and lifecycle helpers.

---

## Highlights

- Single-point initialization (singletons) — call `initialize()` once per process.
- Safe shutdown helpers to flush logs and spans (`shutdown()` methods).
- Good defaults and helpers for test environments (see examples in `core-product-integration-environment`).
- Flexible configuration options for exporters, sampling, redaction, and context enrichment.
- Built-in HttpInstrumentation and easy addition of further instrumentations.

---

## Quick commands

Build this library:

```bash
npx nx build observability
```

Run unit tests:

```bash
npx nx test observability
```

---

## Usage — StandardizedLogger

The logger exposes a static lifecycle and an instantiable logger object for contexts.

Examples

Basic initialization:

```ts
import { StandardizedLogger } from '@ecoma-io/observability';

StandardizedLogger.initialize({
  level: 'info',
  redactKeys: ['password', 'token'],
  extra: { serviceName: 'my-service' },
});

const logger = new StandardizedLogger({ context: 'MyModule' });
logger.info('service started');

// shutdown at process exit
await StandardizedLogger.shutdown();
```

Pino transport example (export logs to an OTLP HTTP endpoint via pino-opentelemetry-transport):

```ts
StandardizedLogger.initialize({
  level: 'trace',
  extra: { testEnvironmentId: 'id-123' },
  transport: {
    target: 'pino-opentelemetry-transport',
    level: 'trace',
    options: {
      resourceAttributes: {
        'service.name': 'my-service',
        'service.version': '1.0.0',
      },
      logRecordProcessorOptions: {
        recordProcessorType: 'simple',
        exporterOptions: {
          protocol: 'http',
          httpExporterOptions: {
            url: 'http://localhost:4318/v1/logs',
            headers: { Authorization: 'Bearer <key>' },
          },
        },
      },
    },
  },
});
```

Notes on behavior

- The logger will enrich log records with `traceId` and `spanId` when a span is active.
- `redactKeys` allows redaction of sensitive fields in messages and merged objects.
- The logger merges a final object parameter into the structured payload and treats Error objects specially (logged under `err`).

---

## Usage — StandardizedTracer

The tracer wraps the OpenTelemetry Node SDK, configures context propagation, a span processor and sensible defaults for common instrumentations.

Important note: StandardizedTracer already adds HttpInstrumentation by default during initialization (to capture outgoing/incoming HTTP calls). Add additional instrumentations depending on your runtime or framework — for example:

- ExpressInstrumentation when your NestJS app uses the express engine (adds richer HTTP route/span names)
- RedisInstrumentation, MySQL/Postgres instrumentations, or framework-specific instrumentations when your service interacts with those systems

Initialization example (OTLP exporter + instrumentations):

```ts
import { StandardizedTracer } from '@ecoma-io/observability';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';

StandardizedTracer.initialize(
  {
    environment: 'production',
    serviceName: 'my-service',
    serviceVersion: '1.0.0',
    otlpEndpoint: 'grpc://otel-collector:4317',
    otlpHeaders: { Authorization: 'Bearer <token>' },
  },
  [new ExpressInstrumentation()]
);

// Run a short-lived span and return a value
await StandardizedTracer.withSpanContext('my-operation', async () => {
  // business logic here
});

// Shutdown at process exit to flush spans
await StandardizedTracer.shutdown();
```

Exporter details

- If `otlpEndpoint` starts with `http://` or `https://` the SDK uses the OTLP HTTP exporter and appends `/v1/traces` automatically.
- If it starts with `grpc://` or `grpcs://` the SDK will configure gRPC exporter (grpcs uses secure channel).
- An invalid endpoint protocol will throw an error at initialization.
- An invalid endpoint protocol will throw an error at initialization.

### Metrics / Prometheus

- Description: The tracer can expose Prometheus metrics via the OpenTelemetry Prometheus exporter. This is useful for collecting runtime and SDK metrics in environments that scrape Prometheus endpoints.
- Enablement: Metrics are explicitly enabled via the `metrics` object passed to `StandardizedTracer.initialize()`.
- Default port: when enabled and no port is provided, the exporter listens on port `9464`.
- Configuration (preferred):

```ts
StandardizedTracer.initialize(
  {
    environment: 'production',
    serviceName: 'my-service',
    serviceVersion: '1.0.0',
    otlpEndpoint: 'http://otel-collector:4318',
    metrics: { enabled: true, metricsPort: 9464 },
  },
  []
);
```

- Disable metrics: set `metrics.enabled` to `false` (or omit the `metrics` object) to avoid starting the Prometheus exporter.
- Notes on legacy properties: This package does not support a top-level `metricsPort` property — prefer the `metrics` object shown above for clarity and forward-compatibility.
- HttpInstrumentation: the built-in `HttpInstrumentation` ignores requests to `/metrics` and `/health` so Prometheus scrapes and readiness/liveness probes are not traced.

Sampler configuration

- By default the SDK sampler is the OpenTelemetry default. You can control sampling explicitly via the `sampler` option passed to `StandardizedTracer.initialize()`.
- Supported sampler options (example shapes):

```ts
// TraceId ratio sampler (sample ~25% of traces)
StandardizedTracer.initialize(
  {
    environment: 'production',
    serviceName: 'my-service',
    serviceVersion: '1.0.0',
    otlpEndpoint: 'http://otel-collector:4318',
    sampler: { type: 'traceidratio', ratio: 0.25 },
  },
  []
);

// Always on / always off
sampler: { type: 'always_on' }
sampler: { type: 'always_off' }

// Parent-based sampler with a root TraceIdRatioBasedSampler
sampler: { type: 'parentbased', root: { type: 'traceidratio', ratio: 0.1 } }
```

Notes:

- Use sampling to limit trace volume and cost in production. A `traceidratio` sampler is a simple and effective choice for most services.
- Parent-based sampler is useful when you want children to inherit sampling decisions from incoming requests while controlling root sampling behaviour.

Best-practice for instrumentations

- HttpInstrumentation is included by default — avoid adding a second HTTP instrumentation unless the added instrumentation provides framework-specific behavior (e.g. ExpressInstrumentation adds richer route names when using the express engine in NestJS).
- Add only the instrumentations you need for your app (Redis, database, framework) to limit overhead and avoid span duplication.
  Logging & production collector behaviour

In production containerized environments logs are typically printed to stdout/stderr and collected by the cluster's logging/telemetry system (for us: LTM). That means the application itself usually should not assume logs are exported in OTLP format by default. Instead:

- Write structured logs to stdout/stderr (our default approach) so the platform's shipper (sidecar/daemonset/etc.) can collect them into LTM.
- If you want logs to also be available to an OTLP-based export pipeline (useful for unified logs + traces workflows) you can wire pino-opentelemetry-transport as a pino transport — this is what `core-product-integration-environment` does for tests and environments where direct OTLP log ingestion is available.

Resource attributes

- You can provide additional resource attributes when initializing `StandardizedTracer` via `resourceAttributes` (a `Record<string,string>`). These attributes are merged into the SDK Resource and appear on exported spans. Example:

```ts
StandardizedTracer.initialize({
  environment: 'production',
  serviceName: 'my-service',
  serviceVersion: '1.0.0',
  otlpEndpoint: 'http://otel-collector:4318',
  resourceAttributes: {
    'service.instance.id': 'instance-42',
    'deployment.environment': 'gke-staging',
  },
});
```

Redaction options (logger)

- The logger supports redaction of sensitive keys via the `redactKeys` option passed to `StandardizedLogger.initialize()` — this performs recursive redaction for nested objects by key name.
<!-- detailed programmatic helper removed from user-facing README -->

Recommendations

- Prefer specifying a small set of `redactKeys` via `StandardizedLogger.initialize()` for common PII fields (e.g., `['password','token']`).

e2e / test-run pattern

For e2e tests it's useful to have both immediate log visibility and prompt trace exports for easy debugging:

- Use a `simple` log record processor so logs are exported as they are emitted (this helps tests surface logs quickly in the collector).
- For traces prefer to configure the OTEL batch processor to be very aggressive in test runs — set `OTEL_BATCH_PROCESS_MAX_EXPORT_BATCH_SIZE=1` (or pass the equivalent configuration to StandardizedTracer constructor) to ensure traces are sent right after each trace is completed. This is exactly the pattern used in the e2e `TestEnvironment` — it improves reproducibility and makes it easy to correlate logs/span information during CI debugging.

Example — full integration and axios propagation

---

## Example — full integration and axios propagation

Taken from internal `CoreProductIntegrationEnvironment` examples — demonstrates combined initialization and injecting trace context into outgoing HTTP calls:

```ts
// Initialize logging
StandardizedLogger.initialize({
  level: 'trace',
  extra: { testEnvironmentId: 'id' },
  transport: {
    /* pino-opentelemetry-transport */
  },
});

// Initialize tracing
StandardizedTracer.initialize(
  {
    environment: 'test',
    serviceName: 'integration-env',
    serviceVersion: 'test',
    otlpEndpoint: 'grpc://127.0.0.1:4317',
    otlpHeaders: { Authorization: 'Bearer <key>' },
    loggingExtra: { testEnvironmentId: 'id' },
  },
  []
);

// Axios interceptor example
import { trace, propagation, context } from '@opentelemetry/api';
const tracer = trace.getTracer('integration-env');
axios.interceptors.request.use((config) =>
  tracer.startActiveSpan('outgoing-request', (span) => {
    propagation.inject(context.active(), config.headers);
    span.end();
    return config;
  })
);
```

---

## Testing tips

- Use `StandardizedTracer.withSpanContext()` in unit tests to produce a span context and assert logs contain `traceId`/`spanId`.
- The project includes unit tests demonstrating the important behaviors — run them with `npx nx test observability`.

---

## Operational / best-practices

- Initialize once per process; re-initialization throws. When writing tests in shared TS runtimes, consider process-level isolation to avoid singleton conflicts.
- Shutdown both logger and tracer on graceful shutdown to avoid dropped logs/spans.
- Avoid adding secrets to `extra` — prefer using secure exporter headers and configure collectors to redact or separate logs/metrics/traces when needed.

---

## Contributing

Run tests and lint locally:

```bash
npx nx test observability
npx nx build observability
```

Add unit tests for any new logger/tracer behaviors — the library uses Jest and includes examples in `src/lib/*.spec.ts`.

---

## License

See top-level repository LICENSE.
