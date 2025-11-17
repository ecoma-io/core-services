import { Entity } from './entity';

class TestEntity extends Entity<string> {}

describe('Entity', () => {
  test('constructor assigns id when provided and equality by id', () => {
    // Arrange
    const id = 'ent-1';

    // Act
    const a = new TestEntity(id);
    const b = new TestEntity(id);

    // Assert
    expect(a.id).toBe(id);
    expect(a.equals(b)).toBe(true);
  });

  test('default constructor generates an id string', () => {
    // Arrange & Act
    const e = new TestEntity();

    // Assert
    expect(typeof e.id).toBe('string');
    expect(e.equals(undefined as any)).toBe(false);
  });
});
