jest.mock('@ecoma-io/node-observability', () => {
  class StdLogger {
    static initialize = jest.fn();
    static shutdown = jest.fn();
  }

  class StdTracer {
    static initialize = jest.fn();
    static shutdown = jest.fn(() => Promise.resolve());
    static withSpanContext = jest.fn((name: string, fn: any) => fn());
  }

  return {
    StandardizedLogger: StdLogger,
    StandardizedTracer: StdTracer,
  };
});

import { NestStandardizedLogger } from './nest-standardized-logger';
import { NestStandardizedTracer } from './nest-standardized-tracer';
import { ObservabilityModule } from './observability.module';
import {
  StandardizedLogger,
  StandardizedTracer,
} from '@ecoma-io/node-observability';

describe('Observability integrations', () => {
  test('NestStandardizedLogger forwards initialize and shutdown', () => {
    const cfg = { redact: [] } as any;
    NestStandardizedLogger.initialize(cfg);
    expect((StandardizedLogger.initialize as jest.Mock).mock.calls.length).toBe(
      1
    );

    NestStandardizedLogger.shutdown();
    expect((StandardizedLogger.shutdown as jest.Mock).mock.calls.length).toBe(
      1
    );
  });

  test('NestStandardizedTracer forwards initialize, shutdown and withSpanContext', async () => {
    const cfg = {} as any;
    NestStandardizedTracer.initialize(cfg, []);
    expect((StandardizedTracer.initialize as jest.Mock).mock.calls.length).toBe(
      1
    );
    const initArgs = (StandardizedTracer.initialize as jest.Mock).mock.calls[0];
    // second arg should be an array with ExpressInstrumentation as first element
    expect(Array.isArray(initArgs[1])).toBe(true);
    expect(initArgs[1][0]).toBeDefined();

    await NestStandardizedTracer.shutdown();
    expect((StandardizedTracer.shutdown as jest.Mock).mock.calls.length).toBe(
      1
    );

    const result = await NestStandardizedTracer.withSpanContext(
      'name',
      () => 'ok'
    );
    expect(result).toBe('ok');
    expect(
      (StandardizedTracer.withSpanContext as jest.Mock).mock.calls.length
    ).toBe(1);
  });

  test('ObservabilityModule is importable (covers module initialization lines)', () => {
    expect(ObservabilityModule).toBeDefined();
  });
});
