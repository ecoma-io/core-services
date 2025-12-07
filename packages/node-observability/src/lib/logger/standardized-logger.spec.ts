// Use jest to mock the 'pino' module so we can validate calls into the underlying logger
jest.mock('pino');

describe('standardizedLogger', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // ensure any module mocks/spies are reset and cleared after each test
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  test('should initialize and then throw on double initialization', () => {
    // Arrange
    const pino = require('pino');
    const { StandardizedLogger } = require('./standardized-logger');

    const fakeLogger = {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };
    pino.mockReturnValueOnce(fakeLogger);

    // Act
    StandardizedLogger.initialize({ level: 'info' });

    // Assert first init succeeded
    const logger = new StandardizedLogger();
    logger.info('hello world');
    expect(fakeLogger.info).toHaveBeenCalled();

    // Double initialize should throw
    expect(() => StandardizedLogger.initialize({ level: 'info' })).toThrow(
      /already been initialized/i
    );
  });

  test('should log Error objects by attaching err field to merging object', () => {
    const pino = require('pino');
    const { StandardizedLogger } = require('./standardized-logger');

    const fakeLogger = {
      info: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };
    pino.mockReturnValueOnce(fakeLogger);

    StandardizedLogger.initialize({ level: 'info' });
    const logger = new StandardizedLogger({ context: 'TST' });

    // Act
    const err = new Error('boom');
    logger.error(err);

    // Assert
    expect(fakeLogger.error).toHaveBeenCalled();
    const firstCallArgs = fakeLogger.error.mock.calls[0];
    // first arg is merging object, should contain err
    expect(firstCallArgs[0]).toBeDefined();
    expect(firstCallArgs[0].err).toBe(err);
  });

  test('should handle exceptions handler contract (string message + stack string)', () => {
    const pino = require('pino');
    const { StandardizedLogger } = require('./standardized-logger');

    const fakeLogger = {
      error: jest.fn(),
      info: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };
    pino.mockReturnValueOnce(fakeLogger);

    StandardizedLogger.initialize({ level: 'info' });
    const logger = new StandardizedLogger();

    // Act: message + stack (single param looks like an error stack)
    const fakeStack = 'Error: x\n    at Object.<anonymous> (index.js:1:1)';
    logger.error('something failed', fakeStack);

    // When the special case is detected, underlying logger.error should be called once with an object
    expect(fakeLogger.error).toHaveBeenCalledTimes(1);
    const calledWith = fakeLogger.error.mock.calls[0][0];
    expect(calledWith).toHaveProperty('err');
    expect(calledWith.err).toBeInstanceOf(Error);
    expect(calledWith.err.message).toStrictEqual('something failed');
  });

  test('should merge object messages and pass through interpolation values', () => {
    const pino = require('pino');
    const { StandardizedLogger } = require('./standardized-logger');

    const fakeLogger = {
      info: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };
    pino.mockReturnValueOnce(fakeLogger);

    StandardizedLogger.initialize({ level: 'info' });
    const logger = new StandardizedLogger({ context: 'ctx' });

    // Act: pass object message and interpolation value
    const msgObj = { user: 'u1' };
    logger.info(msgObj, 'ignoredContext');

    expect(fakeLogger.info).toHaveBeenCalled();
    const args =
      fakeLogger.info.mock.calls[fakeLogger.info.mock.calls.length - 1];
    // merging object and message are present (message undefined for object message case)
    expect(args[0]).toMatchObject(
      expect.objectContaining({ context: 'ignoredContext' })
    );
  });

  test('shutdown should call flush and resolve', async () => {
    const pino = require('pino');
    const { StandardizedLogger } = require('./standardized-logger');

    const fakeLogger = {
      info: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };
    pino.mockReturnValueOnce(fakeLogger);

    StandardizedLogger.initialize({ level: 'info' });

    await expect(StandardizedLogger.shutdown()).resolves.toBeUndefined();
    expect(fakeLogger.flush).toHaveBeenCalled();
  });

  test('shutdown resolves when pino was not initialized', async () => {
    // Ensure modules are fresh and no pino instance created
    jest.resetModules();
    jest.clearAllMocks();
    const { StandardizedLogger } = require('./standardized-logger');

    // Expect shutdown to resolve even if initialize wasn't called
    await expect(StandardizedLogger.shutdown()).resolves.toBeUndefined();
  });

  test('string messages use last param as context and interpolation values pass through', () => {
    const pino = require('pino');
    const { StandardizedLogger } = require('./standardized-logger');

    const fakeLogger = {
      info: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };
    pino.mockReturnValueOnce(fakeLogger);

    StandardizedLogger.initialize({ level: 'info' });
    const logger = new StandardizedLogger({ context: 'def' });

    // Act: message with format placeholder, interpolation value, and final context
    logger.info('hi %s', 'bob', 'customCtx');

    expect(fakeLogger.info).toHaveBeenCalled();
    const args =
      fakeLogger.info.mock.calls[fakeLogger.info.mock.calls.length - 1];
    // first arg merging object should contain extracted context from last param
    expect(args[0]).toMatchObject(
      expect.objectContaining({ context: 'customCtx' })
    );
    // message and interpolation passed to pino should be present
    expect(args[1]).toBe('hi %s');
    expect(args[2]).toBe('bob');
  });

  test('redactKeys configuration redacts secrets in message and merging object', () => {
    const pino = require('pino');
    const { StandardizedLogger } = require('./standardized-logger');

    const fakeLogger = {
      info: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };
    pino.mockReturnValueOnce(fakeLogger);

    StandardizedLogger.initialize({ level: 'info', redactKeys: ['secret'] });
    const logger = new StandardizedLogger({ extra: { svc: 'X' } });

    // Provide an object message containing a secret that should be redacted
    const msgObj = { user: 'u1', secret: 'topsecret' };
    logger.info(msgObj, 'ctx');

    const callArgs =
      fakeLogger.info.mock.calls[fakeLogger.info.mock.calls.length - 1];
    // Merged object should have secret replaced with '***'
    expect(callArgs[0]).toHaveProperty('secret', '***');
  });

  test('pino formatters.log attaches trace/span ids when span exists (and respects extra)', () => {
    // We'll capture the formatters.log function passed to pino and call it directly.
    const pino = require('pino');
    type CapturedFormatter = {
      formatLog?: (
        obj: Record<string, unknown>
      ) => Record<string, unknown> | undefined;
    };
    const captured: CapturedFormatter = {};

    const fakeLogger = {
      info: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };

    // Make pino capture the formatters.log function passed during initialization
    pino.mockImplementationOnce((opts: any) => {
      captured.formatLog = opts.formatters?.log;
      return fakeLogger;
    });

    // Mock OpenTelemetry trace/context helpers used by the formatter
    const getSpan = jest.fn().mockReturnValue(true);
    const getSpanContext = jest
      .fn()
      .mockReturnValue({ spanId: 's1', traceId: 't1' });
    const active = jest.fn();

    jest.doMock('@opentelemetry/api', () => ({
      trace: { getSpan, getSpanContext },
      context: { active },
    }));

    const { StandardizedLogger } = require('./standardized-logger');

    // initialize with extra so formatters includes it in the result
    StandardizedLogger.initialize({ level: 'info', extra: { svc: 'X' } });

    // The captured formatter should exist
    expect(typeof captured.formatLog).toBe('function');

    // Call the formatter with a sample object
    const out = captured.formatLog({ a: 1 });
    expect(out).toMatchObject({ svc: 'X', a: 1, spanId: 's1', traceId: 't1' });
  });

  test('pino formatters.log attaches span ids when span exists and no extra is configured', () => {
    const pino = require('pino');
    type CapturedFormatter = {
      formatLog?: (
        obj: Record<string, unknown>
      ) => Record<string, unknown> | undefined;
    };
    const captured: CapturedFormatter = {};

    const fakeLogger = {
      info: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };

    // Capture formatter
    pino.mockImplementationOnce((opts: any) => {
      captured.formatLog = opts.formatters?.log;
      return fakeLogger;
    });

    // OpenTelemetry returns a span and span context
    const getSpan = jest.fn().mockReturnValue(true);
    const getSpanContext = jest
      .fn()
      .mockReturnValue({ spanId: 'sX', traceId: 'tX' });
    const active = jest.fn();

    jest.doMock('@opentelemetry/api', () => ({
      trace: { getSpan, getSpanContext },
      context: { active },
    }));

    const { StandardizedLogger } = require('./standardized-logger');

    // initialize without extra
    StandardizedLogger.initialize({ level: 'info' });

    expect(typeof captured.formatLog).toBe('function');

    const out = captured.formatLog({ x: 1 });
    // Output should contain base and span/trace ids but no extra fields
    expect(out).toMatchObject({ x: 1, spanId: 'sX', traceId: 'tX' });
  });

  test('formatters.log handles span present but spanContext missing gracefully', () => {
    const pino = require('pino');
    type CapturedFormatter = {
      formatLog?: (
        obj: Record<string, unknown>
      ) => Record<string, unknown> | undefined;
    };
    const captured: CapturedFormatter = {};

    const fakeLogger = {
      info: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };

    // Capture formatter
    pino.mockImplementationOnce((opts: any) => {
      captured.formatLog = opts.formatters?.log;
      return fakeLogger;
    });

    // Mock OpenTelemetry: span exists but spanContext is missing
    const getSpan = jest.fn().mockReturnValue(true);
    const getSpanContext = jest.fn().mockReturnValue(undefined);
    const active = jest.fn();

    jest.doMock('@opentelemetry/api', () => ({
      trace: { getSpan, getSpanContext },
      context: { active },
    }));

    const { StandardizedLogger } = require('./standardized-logger');

    // initialize with extra so the formatter will include extra keys when it returns
    StandardizedLogger.initialize({ level: 'info', extra: { svc: 'X' } });

    expect(typeof captured.formatLog).toBe('function');

    // When span exists but there is no span context, the formatter should not throw
    // and should return base with extra fields but without spanId/traceId
    const out = captured.formatLog({ a: 1 });
    expect(out).toMatchObject({ svc: 'X', a: 1 });
    expect(out).not.toHaveProperty('spanId');
    expect(out).not.toHaveProperty('traceId');
  });

  test('formatters.log handles span present and no extra configured (fallback path)', () => {
    const pino = require('pino');
    type CapturedFormatter = {
      formatLog?: (
        obj: Record<string, unknown>
      ) => Record<string, unknown> | undefined;
    };
    const captured: CapturedFormatter = {};

    const fakeLogger = {
      info: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };

    pino.mockImplementationOnce((opts: any) => {
      captured.formatLog = opts.formatters?.log;
      return fakeLogger;
    });

    // span exists but spanContext undefined, and initialize without extra
    const getSpan = jest.fn().mockReturnValue(true);
    const getSpanContext = jest.fn().mockReturnValue(undefined);
    const active = jest.fn();

    jest.doMock('@opentelemetry/api', () => ({
      trace: { getSpan, getSpanContext },
      context: { active },
    }));

    const { StandardizedLogger } = require('./standardized-logger');
    // initialize without extra
    StandardizedLogger.initialize({ level: 'info' });

    expect(typeof captured.formatLog).toBe('function');

    const out = captured.formatLog({ x: 2 });
    // Without extra configured and spanContext missing formatter should return base only
    expect(out).toStrictEqual({ x: 2 });
  });

  test('object as interpolation (not merged) when message requires interpolation', () => {
    const pino = require('pino');
    const { StandardizedLogger } = require('./standardized-logger');

    const fakeLogger = {
      info: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };
    pino.mockReturnValueOnce(fakeLogger);

    StandardizedLogger.initialize({ level: 'info' });
    const logger = new StandardizedLogger();

    // Message has two placeholders, last optional param is an object and should be used for interpolation
    const obj = { foo: 'bar' };
    logger.info('%s %j', 'hello', obj, 'ctx');

    const call =
      fakeLogger.info.mock.calls[fakeLogger.info.mock.calls.length - 1];
    // Because object was used for interpolation, it should appear after the message
    expect(call[1]).toBe('%s %j');
    expect(call[2]).toBe('hello');
    expect(call[3]).toBe(obj);
  });

  test('formatters.log returns base when there is no active span', () => {
    const pino = require('pino');
    type CapturedFormatter = {
      formatLog?: (
        obj: Record<string, unknown>
      ) => Record<string, unknown> | undefined;
    };
    const captured: CapturedFormatter = {};

    const fakeLogger = {
      info: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };

    pino.mockImplementationOnce((opts: any) => {
      captured.formatLog = opts.formatters?.log;
      return fakeLogger;
    });

    // Make OpenTelemetry helpers return no span
    const getSpan = jest.fn().mockReturnValue(undefined);
    const getSpanContext = jest
      .fn()
      .mockReturnValue({ spanId: 's1', traceId: 't1' });
    const active = jest.fn();

    jest.doMock('@opentelemetry/api', () => ({
      trace: { getSpan, getSpanContext },
      context: { active },
    }));

    const { StandardizedLogger } = require('./standardized-logger');

    // initialize without extra so returned value should be just the base object
    StandardizedLogger.initialize({ level: 'info' });

    expect(typeof captured.formatLog).toBe('function');
    const out = captured.formatLog({ a: 1 });
    expect(out).toStrictEqual({ a: 1 });
  });

  test('formatters.log merges config.extra into base when there is no active span', () => {
    const pino = require('pino');
    type CapturedFormatter = {
      formatLog?: (
        obj: Record<string, unknown>
      ) => Record<string, unknown> | undefined;
    };
    const captured: CapturedFormatter = {};

    const fakeLogger = {
      info: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };

    pino.mockImplementationOnce((opts: any) => {
      captured.formatLog = opts.formatters?.log;
      return fakeLogger;
    });

    // No active span
    const getSpan = jest.fn().mockReturnValue(undefined);
    const getSpanContext = jest.fn().mockReturnValue(undefined);
    const active = jest.fn();

    jest.doMock('@opentelemetry/api', () => ({
      trace: { getSpan, getSpanContext },
      context: { active },
    }));

    const { StandardizedLogger } = require('./standardized-logger');

    // initialize with extra so formatter should merge extras even when no span
    StandardizedLogger.initialize({ level: 'info', extra: { svc: 'X' } });

    expect(typeof captured.formatLog).toBe('function');

    const out = captured.formatLog({ a: 1 });
    expect(out).toMatchObject({ svc: 'X', a: 1 });
  });

  test('shutdown rejects when flush returns error', async () => {
    const pino = require('pino');
    const { StandardizedLogger } = require('./standardized-logger');

    const fakeLogger = {
      info: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn(
        (cb: (err?: Error | null) => void) =>
          cb && cb(new Error('flush failed'))
      ),
    };

    pino.mockReturnValueOnce(fakeLogger);

    StandardizedLogger.initialize({ level: 'info' });

    await expect(StandardizedLogger.shutdown()).rejects.toThrow(
      /flush failed/i
    );
    expect(fakeLogger.flush).toHaveBeenCalled();
  });

  test('error object with empty message uses default "Error" string when logging', () => {
    const pino = require('pino');
    const { StandardizedLogger } = require('./standardized-logger');

    const fakeLogger = {
      info: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };
    pino.mockReturnValueOnce(fakeLogger);

    StandardizedLogger.initialize({ level: 'info' });
    const logger = new StandardizedLogger();

    // Create an Error with empty message
    const err = new Error('');
    logger.error(err, 'ctx');

    expect(fakeLogger.error).toHaveBeenCalled();
    const called = fakeLogger.error.mock.calls[0];
    // second arg should be the default 'Error' string
    expect(called[1]).toBe('Error');
  });

  test('exception handler contract merges instance extra when provided', () => {
    const pino = require('pino');
    const { StandardizedLogger } = require('./standardized-logger');

    const fakeLogger = {
      error: jest.fn(),
      info: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };
    pino.mockReturnValueOnce(fakeLogger);

    StandardizedLogger.initialize({ level: 'info' });
    const logger = new StandardizedLogger({ extra: { svc: 'E' } });

    const fakeStack = 'Error: x\n    at here';
    logger.error('boom', fakeStack);

    expect(fakeLogger.error).toHaveBeenCalledTimes(1);
    const calledWith = fakeLogger.error.mock.calls[0][0];
    // merging object should include the instance extra property
    expect(calledWith).toHaveProperty('svc', 'E');
    expect(calledWith).toHaveProperty('err');
  });

  test('object message merges both instance-extra and message props into log object', () => {
    const pino = require('pino');
    const { StandardizedLogger } = require('./standardized-logger');

    const fakeLogger = {
      info: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };
    pino.mockReturnValueOnce(fakeLogger);

    StandardizedLogger.initialize({ level: 'info' });
    const logger = new StandardizedLogger({ extra: { svc: 'EX' } });

    const msg = { user: 'u9' };
    logger.info(msg, 'CTX');

    expect(fakeLogger.info).toHaveBeenCalled();
    const called =
      fakeLogger.info.mock.calls[fakeLogger.info.mock.calls.length - 1][0];
    // both instance-extra and message properties are merged
    expect(called).toMatchObject({ svc: 'EX', user: 'u9', context: 'CTX' });
  });

  test('private handleErrorMessage handles non-object mergingObject (no spread) correctly', () => {
    const pino = require('pino');
    const { StandardizedLogger } = require('./standardized-logger');

    const fakeLogger = {
      info: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };
    pino.mockReturnValueOnce(fakeLogger);

    StandardizedLogger.initialize({ level: 'info' });
    const logger = new StandardizedLogger();

    const err = new Error('err-msg');

    // Call the private handler with a non-object mergingObject (e.g., null)
    (logger as any).handleErrorMessage('error', err, null, []);

    expect(fakeLogger.error).toHaveBeenCalled();
    const firstArg = fakeLogger.error.mock.calls[0][0];
    // merging object was non-object so log object should only include err
    expect(firstArg).toMatchObject({ err });
    expect(Object.keys(firstArg)).toStrictEqual(expect.arrayContaining(['err']));
  });

  test('private handleExceptionHandlerContract handles non-object mergingObject (no spread)', () => {
    const pino = require('pino');
    const { StandardizedLogger } = require('./standardized-logger');

    const fakeLogger = {
      error: jest.fn(),
      info: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };
    pino.mockReturnValueOnce(fakeLogger);

    StandardizedLogger.initialize({ level: 'info' });
    const logger = new StandardizedLogger();

    const stack = 'Error: X\n at a:1:1';

    // Call the private handler with params that match the special contract and null mergingObject
    const handled = (logger as any).handleExceptionHandlerContract(
      'error',
      'boom',
      [stack],
      null
    );

    expect(handled).toBe(true);
    expect(fakeLogger.error).toHaveBeenCalled();
    const obj = fakeLogger.error.mock.calls[0][0];
    expect(obj).toHaveProperty('err');
  });

  test('private handleObjectMessage handles non-object mergingObject and merges message', () => {
    const pino = require('pino');
    const { StandardizedLogger } = require('./standardized-logger');

    const fakeLogger = {
      info: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };
    pino.mockReturnValueOnce(fakeLogger);

    StandardizedLogger.initialize({ level: 'info' });
    const logger = new StandardizedLogger();

    const message = { a: 1 };

    const handled = (logger as any).handleObjectMessage(
      'info',
      message,
      null,
      []
    );

    expect(handled).toBe(true);
    expect(fakeLogger.info).toHaveBeenCalled();
    const arg =
      fakeLogger.info.mock.calls[fakeLogger.info.mock.calls.length - 1][0];
    // mergingObject was non-object so result should include only message props
    expect(arg).toMatchObject({ a: 1 });
  });

  test('handleObjectMessage omits message props when message is non-plain-object (e.g., array)', () => {
    const pino = require('pino');
    const { StandardizedLogger } = require('./standardized-logger');

    const fakeLogger = {
      info: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };
    pino.mockReturnValueOnce(fakeLogger);

    StandardizedLogger.initialize({ level: 'info' });
    const logger = new StandardizedLogger();

    const message = [1, 2, 3];
    const merging = { base: 'B' };

    const handled = (logger as any).handleObjectMessage(
      'info',
      message,
      merging,
      []
    );

    expect(handled).toBe(true);
    // Should have been called and merged only mergingObject (message array not spread)
    const last =
      fakeLogger.info.mock.calls[fakeLogger.info.mock.calls.length - 1][0];
    expect(last).toMatchObject({ base: 'B' });
    expect(last).not.toHaveProperty('0');
  });

  test('calling logger methods before initialize throws', () => {
    // Ensure a fresh module instance (no pino created) so logger isn't initialized
    jest.resetModules();
    jest.clearAllMocks();
    const { StandardizedLogger } = require('./standardized-logger');

    const logger = new StandardizedLogger();
    expect(() => logger.info('x')).toThrow(/not initialized/i);
  });

  test('wrapper methods delegate to underlying pino methods', () => {
    const pino = require('pino');
    const fakeLogger = {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };
    pino.mockReturnValueOnce(fakeLogger);

    const { StandardizedLogger } = require('./standardized-logger');

    StandardizedLogger.initialize({ level: 'info' });
    const logger = new StandardizedLogger();

    // Call all wrapper methods
    logger.trace('t');
    logger.verbose('v');
    logger.debug('d');
    logger.info('i');
    logger.log('l');
    logger.warn('w');
    logger.error('e');
    logger.fatal('f');

    expect(fakeLogger.trace).toHaveBeenCalled();
    expect(fakeLogger.debug).toHaveBeenCalled();
    expect(fakeLogger.info).toHaveBeenCalled();
    expect(fakeLogger.warn).toHaveBeenCalled();
    expect(fakeLogger.error).toHaveBeenCalled();
    expect(fakeLogger.fatal).toHaveBeenCalled();
  });

  test('merges last object param when message not interpolated', () => {
    const pino = require('pino');
    const { StandardizedLogger } = require('./standardized-logger');

    const fakeLogger = {
      info: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };
    pino.mockReturnValueOnce(fakeLogger);

    StandardizedLogger.initialize({ level: 'info' });
    const logger = new StandardizedLogger({ context: 'base' });

    // message has no placeholders, last optional param is object and should be merged
    const obj = { merged: true };
    logger.info('hello', obj, 'customContext');

    const callArgs =
      fakeLogger.info.mock.calls[fakeLogger.info.mock.calls.length - 1];
    // merging object should include merged properties and provided context should be used
    expect(callArgs[0]).toMatchObject({
      merged: true,
      context: 'customContext',
    });
  });

  test('formatters.log uses redactKeys path when configured and no span', () => {
    const pino = require('pino');
    type CapturedFormatter = {
      formatLog?: (
        obj: Record<string, unknown>
      ) => Record<string, unknown> | undefined;
    };
    const captured: CapturedFormatter = {};

    const fakeLogger = {
      info: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      fatal: jest.fn(),
      flush: jest.fn((cb: (err?: Error | null) => void) => cb && cb(undefined)),
    };

    pino.mockImplementationOnce((opts: any) => {
      captured.formatLog = opts.formatters?.log;
      return fakeLogger;
    });

    // Make OpenTelemetry helpers return no span
    const getSpan = jest.fn().mockReturnValue(undefined);
    const getSpanContext = jest
      .fn()
      .mockReturnValue({ spanId: 's1', traceId: 't1' });
    const active = jest.fn();

    jest.doMock('@opentelemetry/api', () => ({
      trace: { getSpan, getSpanContext },
      context: { active },
    }));

    const { StandardizedLogger } = require('./standardized-logger');

    // initialize with redactKeys so formatter will redact
    StandardizedLogger.initialize({ level: 'info', redactKeys: ['secret'] });

    expect(typeof captured.formatLog).toBe('function');

    const out = captured.formatLog({ user: 'u1', secret: 'topsecret' });
    expect(out).toHaveProperty('secret', '***');
  });
});
