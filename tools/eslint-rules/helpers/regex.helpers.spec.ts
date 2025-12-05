import { createRegex } from './regex.helpers';

describe('createRegex', () => {
  it('creates regex from valid pattern', () => {
    // Arrange
    const regex = createRegex('^@myorg/.*');
    // Act & Assert
    expect(regex.test('@myorg/package')).toBe(true);
    expect(regex.test('invalid')).toBe(false);
  });

  it('falls back to default pattern on invalid regex', () => {
    // Arrange
    const regex = createRegex('[');
    // Act & Assert
    expect(regex.test('@scope/name')).toBe(true);
    expect(regex.test('no-scope')).toBe(false);
  });

  it('uses default pattern when no pattern provided', () => {
    // Arrange
    const regex = createRegex();
    // Act & Assert
    expect(regex.test('@scope/name')).toBe(true);
    expect(regex.test('no-scope')).toBe(false);
  });

  it('handles empty string pattern', () => {
    // Arrange
    const regex = createRegex('');
    // Act & Assert
    expect(regex.test('')).toBe(true);
    expect(regex.test('anything')).toBe(true);
  });
});
