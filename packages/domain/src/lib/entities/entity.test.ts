import { Entity } from './entity';

class TestEntity extends Entity {
  public getPublicId(): string {
    return this.id;
  }
}

test('Entity.equals compares by id (same id)', () => {
  // Arrange
  const id = 'entity-1';
  const a = new TestEntity(id);
  const b = new TestEntity(id);

  // Act
  const result = a.equals(b);

  // Assert
  expect(result).toBe(true);
});

test('Entity.equals returns false for different ids and null', () => {
  // Arrange
  const a = new TestEntity('a');
  const b = new TestEntity('b');

  // Act & Assert
  expect(a.equals(b)).toBe(false);
  expect(a.equals(undefined)).toBe(false);
  expect(a.equals(null)).toBe(false);
});
