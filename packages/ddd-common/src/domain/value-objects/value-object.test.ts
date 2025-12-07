import { ValueObject } from './value-object';

class TestVO extends ValueObject<{ a: number; b: Date; c: { d: string } }> {}

test('valueObject.equals handles nested objects and Date equality', () => {
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

test('valueObject.equals returns false for different nested values', () => {
  // Arrange
  const date = new Date('2020-01-01T00:00:00.000Z');
  const a = new TestVO({ a: 1, b: date, c: { d: 'x' } });
  const b = new TestVO({ a: 1, b: date, c: { d: 'y' } });

  // Act
  const result = a.equals(b);

  // Assert
  expect(result).toBe(false);
});

test('valueObject.equals handles null/undefined and other.toJSON undefined', () => {
  const a = new TestVO({ a: 1, b: new Date(), c: { d: 'x' } });
  expect(a.equals(null as any)).toBe(false);
  expect(a.equals(undefined as any)).toBe(false);

  const fake = { toJSON: () => undefined } as unknown as ValueObject<any>;
  expect(a.equals(fake)).toBe(false);

  const j = a.toJSON();
  expect(j).toHaveProperty('a');
  expect(j).not.toBe((a as any).props);
});
