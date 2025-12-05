import { Readable } from 'stream';
import LogHandler from './log-handler';

describe('LogHandler', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
    verbose: jest.fn(),
  } as any;

  afterEach(() => jest.clearAllMocks());

  it('parses JSON message and calls logger with formatted entry', () => {
    const format = jest.fn().mockImplementation((_streamType, message) => ({
      level: 'info',
      message,
    }));
    const handler = new LogHandler(mockLogger, format, 'env-id');
    const consumer = handler.createLogConsumer('svc');

    // fake stream that invokes the data handler with a JSON line
    const fakeStream: any = {
      on: (ev: string, cb: any) => {
        if (ev === 'data') cb(Buffer.from(JSON.stringify({ msg: 'ok' })));
        if (ev === 'err') cb(Buffer.from('error'));
      },
    } as Readable;

    consumer(fakeStream);

    expect(format).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('handles non-JSON messages gracefully', () => {
    const format = jest.fn().mockImplementation((streamType, message) => ({
      level: 'info',
      message,
    }));
    const handler = new LogHandler(mockLogger, format);
    const consumer = handler.createLogConsumer('svc2');

    const fakeStream: any = {
      on: (ev: string, cb: any) => {
        if (ev === 'data') cb(Buffer.from('not-json'));
      },
    } as Readable;

    consumer(fakeStream);

    expect(format).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('processLine handles JSON primitives and different log levels', () => {
    const format = jest.fn().mockImplementation((streamType, message) => ({
      level: 'error',
      message,
    }));
    const handler = new LogHandler(mockLogger, format, 'my-env');

    // call private method directly to cover branches
    (handler as any).processLine(
      'my-service',
      'stdout',
      JSON.stringify('prim')
    );

    expect(format).toHaveBeenCalledWith(
      'stdout',
      expect.objectContaining({
        msg: 'prim',
        container: 'my-service',
        testEnvId: 'my-env',
      })
    );
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('processLine handles JSON null and when logger is undefined', () => {
    const format = jest.fn().mockImplementation((streamType, message) => ({
      level: 'warn',
      message,
    }));
    const handler = new LogHandler(undefined, format, 'env-x');

    // should not throw even if logger is undefined
    (handler as any).processLine('svc', 'stderr', JSON.stringify(null));
    expect(format).toHaveBeenCalledWith(
      'stderr',
      expect.objectContaining({
        msg: 'null',
        container: 'svc',
        testEnvId: 'env-x',
      })
    );
  });

  it('invokes all logger levels when present', () => {
    const levels: Array<
      'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
    > = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    const logger: any = {};
    levels.forEach((l) => (logger[l] = jest.fn()));

    const handler = new LogHandler(logger, (_streamType, message) => {
      // rotate through levels to call each method
      const level = levels.shift();
      return { level, message };
    });

    // call processLine multiple times to hit each level
    (handler as any).processLine('a', 'stdout', JSON.stringify({}));
    (handler as any).processLine('b', 'stdout', JSON.stringify({}));
    (handler as any).processLine('c', 'stdout', JSON.stringify({}));
    (handler as any).processLine('d', 'stdout', JSON.stringify({}));
    (handler as any).processLine('e', 'stdout', JSON.stringify({}));
    (handler as any).processLine('f', 'stdout', JSON.stringify({}));

    // all logger methods should have been called once
    expect(logger.trace).toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
    expect(logger.fatal).toHaveBeenCalled();
  });
});
