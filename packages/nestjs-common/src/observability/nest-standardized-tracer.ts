import {
  StandardizedTracer,
  StandardizedTracerConfig,
} from '@ecoma-io/node-observability';
import { SpanOptions } from '@opentelemetry/api';
import { Instrumentation } from '@opentelemetry/instrumentation';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';

export class NestStandardizedTracer extends StandardizedTracer {
  public static initialize(
    config: StandardizedTracerConfig,
    instrumentations?: Instrumentation[]
  ): void {
    StandardizedTracer.initialize(config, [
      new ExpressInstrumentation({
        spanNameHook: (info, defaultName) =>
          `${info.request.method.toUpperCase()} ${info.request.url} - ${defaultName}`,
      }),
      ...(instrumentations || []),
    ]);
  }

  public static shutdown(): Promise<void> {
    return StandardizedTracer.shutdown();
  }

  public static withSpanContext<T>(
    name: string,
    fn: () => Promise<T> | T,
    options?: SpanOptions
  ): Promise<T> {
    return StandardizedTracer.withSpanContext(name, fn, options);
  }

  protected constructor(
    config: StandardizedTracerConfig,
    instrumentations?: Instrumentation[]
  ) {
    super(config, instrumentations);
  }
}
