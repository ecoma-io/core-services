import { ExportResultCode } from '@opentelemetry/core';
import { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-base';

jest.useRealTimers();

describe('traceExporter', () => {
  let fakeLogger: Record<string, jest.Mock>;

  beforeEach(() => {
    fakeLogger = {
      verbose: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  test('forwards successful export and logs', () => {
    // Arrange
    const fakeExporter: Partial<SpanExporter> = {
      export: jest.fn((spans: ReadableSpan[], cb: (r: any) => void) =>
        cb({ code: ExportResultCode.SUCCESS })
      ),
      forceFlush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };

    const { TraceExporter } = require('./trace-exporter');
    const te = new TraceExporter(
      fakeExporter as SpanExporter,
      fakeLogger as any
    );

    // Act
    const callback = jest.fn();
    te.export([{ name: 'x' } as unknown as ReadableSpan], callback);

    // Assert
    expect(fakeExporter.export).toHaveBeenCalled();
    expect(fakeLogger.verbose).toHaveBeenCalledWith('Exporting 1 spans');
    expect(fakeLogger.verbose).toHaveBeenCalledWith(
      'Successfully exported 1 spans'
    );
    expect(callback).toHaveBeenCalledWith({ code: ExportResultCode.SUCCESS });
  });

  test('logs failed result and still calls callback', () => {
    // Arrange: exporter returns FAILED result
    const fakeExporter: Partial<SpanExporter> = {
      export: jest.fn((spans: ReadableSpan[], cb: (r: any) => void) =>
        cb({ code: ExportResultCode.FAILED, error: new Error('boom') })
      ),
      forceFlush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };

    const { TraceExporter } = require('./trace-exporter');
    const te = new TraceExporter(
      fakeExporter as SpanExporter,
      fakeLogger as any
    );

    // Act
    const callback = jest.fn();
    te.export([], callback);

    // Assert
    expect(fakeExporter.export).toHaveBeenCalled();
    expect(fakeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'OTel span export failed',
        code: ExportResultCode.FAILED,
      })
    );
    expect(callback).toHaveBeenCalledWith({
      code: ExportResultCode.FAILED,
      error: expect.any(Error),
    });
  });

  test('handles synchronous exporter.throw and returns FAILED result to callback', () => {
    // Arrange: exporter throws synchronously
    const fakeExporter: Partial<SpanExporter> = {
      export: jest.fn(() => {
        throw new Error('sync boom');
      }),
      forceFlush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };

    const { TraceExporter } = require('./trace-exporter');
    const te = new TraceExporter(
      fakeExporter as SpanExporter,
      fakeLogger as any
    );

    // Act
    const callback = jest.fn();
    te.export([{ name: 'x' } as unknown as ReadableSpan], callback);

    // Assert - callback should receive failed ExportResult and logger.error called
    expect(fakeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'Unexpected exception during exporter.export',
      })
    );
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ code: ExportResultCode.FAILED })
    );
  });

  test('logs failed result when result.error is undefined', () => {
    // Arrange: exporter returns FAILED but error is explicitly undefined
    const fakeExporter: Partial<SpanExporter> = {
      export: jest.fn((spans: ReadableSpan[], cb: (r: any) => void) =>
        cb({ code: ExportResultCode.FAILED, error: undefined })
      ),
      forceFlush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };

    const { TraceExporter } = require('./trace-exporter');
    const te = new TraceExporter(
      fakeExporter as SpanExporter,
      fakeLogger as any
    );

    // Act
    const callback = jest.fn();
    te.export([], callback);

    // Assert
    expect(fakeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'OTel span export failed',
        code: ExportResultCode.FAILED,
        // ensure we can handle undefined error values
        error: undefined,
      })
    );
    expect(callback).toHaveBeenCalledWith({
      code: ExportResultCode.FAILED,
      error: undefined,
    });
  });

  test('handles synchronous exporter.throw with undefined (nullish) and returns FAILED', () => {
    // Arrange: exporter throws undefined (a nullish thrown value)
    const fakeExporter: Partial<SpanExporter> = {
      export: jest.fn(() => {
        throw undefined;
      }),
      forceFlush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };

    const { TraceExporter } = require('./trace-exporter');
    const te = new TraceExporter(
      fakeExporter as SpanExporter,
      fakeLogger as any
    );

    // Act
    const callback = jest.fn();
    te.export([{ name: 'x' } as unknown as ReadableSpan], callback);

    // Assert - callback should receive failed ExportResult and logger.error called with known message
    expect(fakeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'Unexpected exception during exporter.export',
        error: expect.any(Error),
      })
    );
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ code: ExportResultCode.FAILED })
    );
  });

  test('forceFlush logs and rethrows when underlying exporter rejects', async () => {
    // Arrange
    const fakeExporter: Partial<SpanExporter> = {
      export: jest.fn(),
      forceFlush: jest.fn().mockRejectedValue(new Error('flush fail')),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };

    const { TraceExporter } = require('./trace-exporter');
    const te = new TraceExporter(
      fakeExporter as SpanExporter,
      fakeLogger as any
    );

    // Act & Assert
    await expect(te.forceFlush()).rejects.toThrow(
      /TraceExporter.forceFlush failed/
    );
    expect(fakeLogger.debug).toHaveBeenCalledWith(
      'Forcing flush of OTel exporter'
    );
    expect(fakeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'Failed forcing flush on exporter' })
    );
  });

  test('forceFlush handles rejection with nullish error value', async () => {
    // Arrange: reject with undefined/null to exercise the nullish branch
    const fakeExporter: Partial<SpanExporter> = {
      export: jest.fn(),
      forceFlush: jest.fn().mockRejectedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };

    const { TraceExporter } = require('./trace-exporter');
    const te = new TraceExporter(
      fakeExporter as SpanExporter,
      fakeLogger as any
    );

    // Act & Assert
    await expect(te.forceFlush()).rejects.toThrow(
      /TraceExporter.forceFlush failed: (?:undefined|unknown error)/
    );
    expect(fakeLogger.debug).toHaveBeenCalledWith(
      'Forcing flush of OTel exporter'
    );
    expect(fakeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'Failed forcing flush on exporter' })
    );
  });

  test('forceFlush resolves when underlying exporter succeeds', async () => {
    // Arrange
    const fakeExporter: Partial<SpanExporter> = {
      export: jest.fn(),
      forceFlush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };

    const { TraceExporter } = require('./trace-exporter');
    const te = new TraceExporter(
      fakeExporter as SpanExporter,
      fakeLogger as any
    );

    // Act & Assert
    await expect(te.forceFlush()).resolves.toBeUndefined();
    expect(fakeLogger.debug).toHaveBeenCalledWith(
      'Forcing flush of OTel exporter'
    );
  });

  test('shutdown logs and rethrows when underlying exporter rejects', async () => {
    // Arrange
    const fakeExporter: Partial<SpanExporter> = {
      export: jest.fn(),
      forceFlush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockRejectedValue(new Error('shutdown fail')),
    };

    const { TraceExporter } = require('./trace-exporter');
    const te = new TraceExporter(
      fakeExporter as SpanExporter,
      fakeLogger as any
    );

    // Act & Assert
    await expect(te.shutdown()).rejects.toThrow(
      /TraceExporter.shutdown failed/
    );
    expect(fakeLogger.debug).toHaveBeenCalledWith(
      'Shutting down OTel exporter'
    );
    expect(fakeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'Exporter shutdown failed' })
    );
  });

  test('shutdown handles rejection with nullish error value', async () => {
    // Arrange: reject with null to exercise nullish handling
    const fakeExporter: Partial<SpanExporter> = {
      export: jest.fn(),
      forceFlush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockRejectedValue(null),
    };

    const { TraceExporter } = require('./trace-exporter');
    const te = new TraceExporter(
      fakeExporter as SpanExporter,
      fakeLogger as any
    );

    // Act & Assert
    await expect(te.shutdown()).rejects.toThrow(
      /TraceExporter.shutdown failed: (?:null|unknown error)/
    );
    expect(fakeLogger.debug).toHaveBeenCalledWith(
      'Shutting down OTel exporter'
    );
    expect(fakeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'Exporter shutdown failed' })
    );
  });

  test('shutdown resolves when underlying exporter succeeds', async () => {
    // Arrange
    const fakeExporter: Partial<SpanExporter> = {
      export: jest.fn(),
      forceFlush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };

    const { TraceExporter } = require('./trace-exporter');
    const te = new TraceExporter(
      fakeExporter as SpanExporter,
      fakeLogger as any
    );

    // Act & Assert
    await expect(te.shutdown()).resolves.toBeUndefined();
    expect(fakeLogger.debug).toHaveBeenCalledWith(
      'Shutting down OTel exporter'
    );
  });
});
