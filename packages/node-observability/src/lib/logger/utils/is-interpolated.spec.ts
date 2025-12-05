import { isInterpolated } from './is-interpolated';

describe('isInterpolated', () => {
  test('returns false for non-string messages', () => {
    // Arrange
    const msg = {};

    // Act
    const out = isInterpolated(msg, 0);

    // Assert
    expect(out).toBe(false);
  });

  test('counts placeholders correctly and respects cutoff', () => {
    // Arrange
    const msg = '%s %j';

    // Act & Assert
    expect(isInterpolated(msg, 1)).toBe(true);
    expect(isInterpolated(msg, 2)).toBe(false);
  });

  test('returns true when message has placeholders and objIndex omitted', () => {
    // Act & Assert
    expect(isInterpolated('%s %s')).toBe(true);
    expect(isInterpolated('no placeholders')).toBe(false);
  });
});
