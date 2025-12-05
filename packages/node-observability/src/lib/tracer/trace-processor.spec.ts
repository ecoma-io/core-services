import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

describe('TraceProcessor', () => {
  let fakeLogger: Record<string, jest.Mock>;

  beforeEach(() => {
    jest.resetAllMocks();
    fakeLogger = {
      verbose: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
  });

  afterEach(() => {
    // ensure no cross-test contamination
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  test('onStart logs and delegates to super', () => {
    // Arrange
    const exporter = {
      export: jest.fn(),
      forceFlush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const { TraceProcessor } = require('./trace-processor');
    const processor = new TraceProcessor(
      exporter,
      {} as any,
      fakeLogger as any
    );

    const mockSpan = {
      spanContext: () => ({ spanId: 'sid', traceId: 'tid' }),
      name: 'span-name',
    } as any;
    const parentContext = {} as any;

    const spy = jest
      .spyOn(BatchSpanProcessor.prototype, 'onStart')
      .mockImplementation(() => {
        // do nothing
      });

    // Act
    processor.onStart(mockSpan, parentContext);

    // Assert
    expect(fakeLogger.verbose).toHaveBeenCalledWith(
      'Span started: sid span-name'
    );
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('onStart logs error when super throws and rethrows', () => {
    // Arrange
    const exporter = {
      export: jest.fn(),
      forceFlush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const { TraceProcessor } = require('./trace-processor');
    const processor = new TraceProcessor(
      exporter,
      {} as any,
      fakeLogger as any
    );

    const mockSpan = {
      spanContext: () => ({ spanId: 'sid2', traceId: 'tid2' }),
      name: 'n2',
    } as any;
    const parentContext = {} as any;

    const spy = jest
      .spyOn(BatchSpanProcessor.prototype, 'onStart')
      .mockImplementation(() => {
        throw new Error('super fail');
      });

    // Act & Assert
    expect(() => processor.onStart(mockSpan, parentContext)).toThrow(
      'super fail'
    );
    expect(fakeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'Error in TraceProcessor.onStart' })
    );
    spy.mockRestore();
  });

  test('onStart logs error when super throws undefined and rethrows', () => {
    // Arrange
    const exporter = {
      export: jest.fn(),
      forceFlush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const { TraceProcessor } = require('./trace-processor');
    const processor = new TraceProcessor(
      exporter,
      {} as any,
      fakeLogger as any
    );

    const mockSpan = {
      spanContext: () => ({ spanId: 'sid2', traceId: 'tid2' }),
      name: 'n2',
    } as any;
    const parentContext = {} as any;

    const spy = jest
      .spyOn(BatchSpanProcessor.prototype, 'onStart')
      .mockImplementation(() => {
        throw undefined;
      });

    // Act & Assert
    expect(() => processor.onStart(mockSpan, parentContext)).toThrow();
    expect(fakeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'Error in TraceProcessor.onStart' })
    );
    spy.mockRestore();
  });

  test('onEnd logs and delegates to super', () => {
    // Arrange
    const exporter = {
      export: jest.fn(),
      forceFlush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const { TraceProcessor } = require('./trace-processor');
    const processor = new TraceProcessor(
      exporter,
      {} as any,
      fakeLogger as any
    );

    const mockSpan = {
      spanContext: () => ({ spanId: 'sid-end', traceId: 'tid-end' }),
      name: 'span-end',
    } as any;

    const spy = jest
      .spyOn(BatchSpanProcessor.prototype, 'onEnd')
      .mockImplementation(() => {
        // do nothing
      });

    // Act
    processor.onEnd(mockSpan);

    // Assert
    expect(fakeLogger.verbose).toHaveBeenCalledWith(
      'Span ended: sid-end span-end'
    );
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('onEnd logs error when super throws and rethrows', () => {
    // Arrange
    const exporter = {
      export: jest.fn(),
      forceFlush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const { TraceProcessor } = require('./trace-processor');
    const processor = new TraceProcessor(
      exporter,
      {} as any,
      fakeLogger as any
    );

    const mockSpan = {
      spanContext: () => ({ spanId: 'sid-end-2', traceId: 'tid-end-2' }),
      name: 'span-end-2',
    } as any;

    const spy = jest
      .spyOn(BatchSpanProcessor.prototype, 'onEnd')
      .mockImplementation(() => {
        throw new Error('onEnd fail');
      });

    // Act & Assert
    expect(() => processor.onEnd(mockSpan)).toThrow('onEnd fail');
    expect(fakeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'Error in TraceProcessor.onEnd' })
    );
    spy.mockRestore();
  });

  test('onEnd logs error when super throws nullish and rethrows', () => {
    // Arrange
    const exporter = {
      export: jest.fn(),
      forceFlush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const { TraceProcessor } = require('./trace-processor');
    const processor = new TraceProcessor(
      exporter,
      {} as any,
      fakeLogger as any
    );

    const mockSpan = {
      spanContext: () => ({ spanId: 'sid-end-2', traceId: 'tid-end-2' }),
      name: 'span-end-2',
    } as any;

    const spy = jest
      .spyOn(BatchSpanProcessor.prototype, 'onEnd')
      .mockImplementation(() => {
        throw null;
      });

    // Act & Assert
    expect(() => processor.onEnd(mockSpan)).toThrow();
    expect(fakeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'Error in TraceProcessor.onEnd' })
    );
    spy.mockRestore();
  });

  test('forceFlush wraps and logs error from super', async () => {
    // Arrange
    const exporter = {
      export: jest.fn(),
      forceFlush: jest.fn().mockRejectedValue(new Error('flush fail')),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const { TraceProcessor } = require('./trace-processor');
    const processor = new TraceProcessor(
      exporter,
      {} as any,
      fakeLogger as any
    );

    const spy = jest
      .spyOn(BatchSpanProcessor.prototype, 'forceFlush')
      .mockRejectedValue(new Error('flush fail'));

    // Act & Assert
    await expect(processor.forceFlush()).rejects.toThrow(
      /TraceProcessor.forceFlush failed/
    );
    expect(fakeLogger.debug).toHaveBeenCalledWith(
      'Forcing flush of TraceProcessor'
    );
    expect(fakeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'TraceProcessor.forceFlush failed' })
    );
    spy.mockRestore();
  });

  test('forceFlush handles rejection with nullish error value', async () => {
    // Arrange
    const exporter = {
      export: jest.fn(),
      forceFlush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const { TraceProcessor } = require('./trace-processor');
    const processor = new TraceProcessor(
      exporter,
      {} as any,
      fakeLogger as any
    );

    const spy = jest
      .spyOn(BatchSpanProcessor.prototype, 'forceFlush')
      .mockRejectedValue(undefined);

    // Act & Assert
    await expect(processor.forceFlush()).rejects.toThrow(
      /TraceProcessor.forceFlush failed/
    );
    expect(fakeLogger.debug).toHaveBeenCalledWith(
      'Forcing flush of TraceProcessor'
    );
    expect(fakeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'TraceProcessor.forceFlush failed' })
    );
    spy.mockRestore();
  });

  test('forceFlush resolves when super resolves', async () => {
    // Arrange
    const exporter = {
      export: jest.fn(),
      forceFlush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const { TraceProcessor } = require('./trace-processor');
    const processor = new TraceProcessor(
      exporter,
      {} as any,
      fakeLogger as any
    );

    const spy = jest
      .spyOn(BatchSpanProcessor.prototype, 'forceFlush')
      .mockResolvedValue(undefined);

    // Act & Assert
    await expect(processor.forceFlush()).resolves.toBeUndefined();
    expect(fakeLogger.debug).toHaveBeenCalledWith(
      'Forcing flush of TraceProcessor'
    );
    spy.mockRestore();
  });

  test('shutdown wraps and logs error from super', async () => {
    // Arrange
    const exporter = {
      export: jest.fn(),
      forceFlush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockRejectedValue(new Error('shutdown fail')),
    };
    const { TraceProcessor } = require('./trace-processor');
    const processor = new TraceProcessor(
      exporter,
      {} as any,
      fakeLogger as any
    );

    const spy = jest
      .spyOn(BatchSpanProcessor.prototype, 'shutdown')
      .mockRejectedValue(new Error('shutdown fail'));

    // Act & Assert
    await expect(processor.shutdown()).rejects.toThrow(
      /TraceProcessor.shutdown failed/
    );
    expect(fakeLogger.debug).toHaveBeenCalledWith(
      'Shutting down TraceProcessor'
    );
    expect(fakeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'TraceProcessor.shutdown failed' })
    );
    spy.mockRestore();
  });

  test('shutdown handles rejection with nullish error', async () => {
    // Arrange
    const exporter = {
      export: jest.fn(),
      forceFlush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const { TraceProcessor } = require('./trace-processor');
    const processor = new TraceProcessor(
      exporter,
      {} as any,
      fakeLogger as any
    );

    const spy = jest
      .spyOn(BatchSpanProcessor.prototype, 'shutdown')
      .mockRejectedValue(null);

    // Act & Assert
    await expect(processor.shutdown()).rejects.toThrow(
      /TraceProcessor.shutdown failed/
    );
    expect(fakeLogger.debug).toHaveBeenCalledWith(
      'Shutting down TraceProcessor'
    );
    expect(fakeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'TraceProcessor.shutdown failed' })
    );
    spy.mockRestore();
  });

  test('shutdown resolves when super resolves', async () => {
    // Arrange
    const exporter = {
      export: jest.fn(),
      forceFlush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const { TraceProcessor } = require('./trace-processor');
    const processor = new TraceProcessor(
      exporter,
      {} as any,
      fakeLogger as any
    );

    const spy = jest
      .spyOn(BatchSpanProcessor.prototype, 'shutdown')
      .mockResolvedValue(undefined);

    // Act & Assert
    await expect(processor.shutdown()).resolves.toBeUndefined();
    expect(fakeLogger.debug).toHaveBeenCalledWith(
      'Shutting down TraceProcessor'
    );
    spy.mockRestore();
  });
});
