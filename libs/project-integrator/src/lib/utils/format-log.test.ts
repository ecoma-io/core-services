import { formatLogMessageImpl } from './format-log';

describe('formatLogMessageImpl', () => {
  test('maps string levels to canonical levels', () => {
    // Arrange & Act & Assert: small pure function mapping checks
    expect(formatLogMessageImpl('stdout', { level: 'trace' })).toEqual({
      level: 'trace',
      message: { level: 'trace' },
    });
    expect(formatLogMessageImpl('stdout', { level: 'debug' })).toEqual({
      level: 'debug',
      message: { level: 'debug' },
    });
    expect(formatLogMessageImpl('stdout', { level: 'info' })).toEqual({
      level: 'info',
      message: { level: 'info' },
    });
    expect(formatLogMessageImpl('stdout', { level: 'warn' })).toEqual({
      level: 'warn',
      message: { level: 'warn' },
    });
    expect(formatLogMessageImpl('stdout', { level: 'error' })).toEqual({
      level: 'error',
      message: { level: 'error' },
    });
    expect(formatLogMessageImpl('stdout', { level: 'fatal' })).toEqual({
      level: 'fatal',
      message: { level: 'fatal' },
    });
  });

  test('maps numeric levels and falls back to streamType', () => {
    // Arrange & Act & Assert: numeric mapping behavior
    expect(formatLogMessageImpl('stdout', { level: 10 as any })).toEqual({
      level: 'trace',
      message: { level: 10 },
    });
    expect(formatLogMessageImpl('stderr', { level: undefined as any })).toEqual(
      { level: 'error', message: { level: undefined } }
    );
  });

  test('maps other numeric levels and verbose alias', () => {
    // Arrange & Act & Assert: additional numeric / alias mappings
    expect(formatLogMessageImpl('stdout', { level: 20 as any })).toEqual({
      level: 'debug',
      message: { level: 20 },
    });
    expect(formatLogMessageImpl('stdout', { level: 30 as any })).toEqual({
      level: 'info',
      message: { level: 30 },
    });
    expect(formatLogMessageImpl('stdout', { level: 40 as any })).toEqual({
      level: 'warn',
      message: { level: 40 },
    });
    expect(formatLogMessageImpl('stdout', { level: 50 as any })).toEqual({
      level: 'error',
      message: { level: 50 },
    });
    expect(formatLogMessageImpl('stdout', { level: 60 as any })).toEqual({
      level: 'fatal',
      message: { level: 60 },
    });
    expect(formatLogMessageImpl('stdout', { level: 'verbose' as any })).toEqual(
      {
        level: 'trace',
        message: { level: 'verbose' },
      }
    );
  });

  test('fallback returns info for unknown level on stdout', () => {
    // Arrange & Act & Assert: unknown level fallback
    expect(formatLogMessageImpl('stdout', { level: 'unknown' as any })).toEqual(
      {
        level: 'info',
        message: { level: 'unknown' },
      }
    );
  });
});
