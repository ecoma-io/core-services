import { ValueObject } from './value-object';

class VO extends ValueObject<{ a: number; b: string }> {}

describe('ValueObject', () => {
  test('equals returns true for same props', () => {
    // Arrange
    const v1 = new VO({ a: 1, b: 'x' });
    const v2 = new VO({ a: 1, b: 'x' });

    // Act
    const eq = v1.equals(v2);

    // Assert
    expect(eq).toBe(true);
  });

  test('toJSON returns shallow copy of props', () => {
    // Arrange
    const v = new VO({ a: 2, b: 'y' });

    // Act
    const json = v.toJSON();

    // Assert
    expect(json).toEqual({ a: 2, b: 'y' });
  });
});
