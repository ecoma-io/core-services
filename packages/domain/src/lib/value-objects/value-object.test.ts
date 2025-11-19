import { ValueObject } from './value-object';

class TestVO extends ValueObject<{ a: number; b: Date; c: { d: string } }> {}

test('ValueObject.equals handles nested objects and Date equality', () => {
  // Arrange
  const date = new Date('2020-01-01T00:00:00.000Z');
  const a = new TestVO({ a: 1, b: date, c: { d: 'x' } });
  const b = new TestVO({
    a: 1,
    b: new Date(date.toISOString()),
    c: { d: 'x' },
  });

  // Act
  const result = a.equals(b);

  // Assert
  expect(result).toBe(true);
});

test('ValueObject.equals returns false for different nested values', () => {
  // Arrange
  const date = new Date('2020-01-01T00:00:00.000Z');
  const a = new TestVO({ a: 1, b: date, c: { d: 'x' } });
  const b = new TestVO({ a: 1, b: date, c: { d: 'y' } });

  // Act
  const result = a.equals(b);

  // Assert
  expect(result).toBe(false);
});
