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

describe('observability integrations', () => {
  test('nestStandardizedLogger forwards initialize and shutdown', () => {
    const cfg = { redact: [] } as any;
    NestStandardizedLogger.initialize(cfg);
    expect((jest.mocked(StandardizedLogger.initialize)).mock.calls).toHaveLength(
      1
    );

    NestStandardizedLogger.shutdown();
    expect((jest.mocked(StandardizedLogger.shutdown)).mock.calls).toHaveLength(
      1
    );
  });

  test('nestStandardizedTracer forwards initialize, shutdown and withSpanContext', async () => {
    const cfg = {} as any;
    NestStandardizedTracer.initialize(cfg, []);
    expect((jest.mocked(StandardizedTracer.initialize)).mock.calls).toHaveLength(
      1
    );
    const initArgs = (jest.mocked(StandardizedTracer.initialize)).mock.calls[0];
    // second arg should be an array with ExpressInstrumentation as first element
    expect(Array.isArray(initArgs[1])).toBe(true);
    expect(initArgs[1][0]).toBeDefined();

    await NestStandardizedTracer.shutdown();
    expect((jest.mocked(StandardizedTracer.shutdown)).mock.calls).toHaveLength(
      1
    );

    const result = await NestStandardizedTracer.withSpanContext(
      'name',
      () => 'ok'
    );
    expect(result).toBe('ok');
    expect(
      (jest.mocked(StandardizedTracer.withSpanContext)).mock.calls
    ).toHaveLength(1);
  });

  test('observabilityModule is importable (covers module initialization lines)', () => {
    expect(ObservabilityModule).toBeDefined();
  });
});
