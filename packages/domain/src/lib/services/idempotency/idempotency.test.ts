import { normalizeCommandId } from './idempotency';

describe('normalizeCommandId', () => {
  test('returns null for undefined', () => {
    expect(normalizeCommandId(undefined)).toBeNull();
  });

  test('returns null for null', () => {
    expect(normalizeCommandId(null)).toBeNull();
  });

  test('trims whitespace and returns null for empty', () => {
    expect(normalizeCommandId('   ')).toBeNull();
    expect(normalizeCommandId('')).toBeNull();
  });

  test('returns trimmed string for valid input', () => {
    expect(normalizeCommandId('  abc-123  ')).toBe('abc-123');
  });

  test('converts numeric-like inputs via String()', () => {
    // pass a numeric-like value coerced to any to simulate non-string input
    expect(normalizeCommandId(12345 as unknown as any)).toBe('12345');
  });
});
