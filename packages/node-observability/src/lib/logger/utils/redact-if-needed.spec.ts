import { redactIfNeeded } from './redact-if-needed';

describe('redact-if-needed', () => {
  const original = { a: 1, secret: 's' };

  test('redacts when keys provided', () => {
    // Arrange & Act
    const out = redactIfNeeded(original, ['secret']);

    // Assert
    expect(out).toEqual({ a: 1, secret: '***' });
  });

  test('returns non-objects unchanged', () => {
    // Act & Assert
    expect(redactIfNeeded('x', ['secret'])).toBe('x');
  });
});
