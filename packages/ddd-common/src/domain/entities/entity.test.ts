import { Entity } from './entity';

class TestEntity extends Entity<number> {
  constructor(id?: number) {
    super(id);
  }
}

describe('entity', () => {
  test('id getter returns provided id or undefined', () => {
    const withId = new TestEntity(42);
    const withoutId = new TestEntity();
    expect(withId.id).toBe(42);
    expect(withoutId.id).toBeUndefined();
  });

  test('isEntity correctly identifies Entity instances', () => {
    const e = new TestEntity(1);
    expect(Entity.isEntity(e)).toBe(true);
    expect(Entity.isEntity({})).toBe(false);
    expect(Entity.isEntity(null)).toBe(false);
    expect(Entity.isEntity(undefined)).toBe(false);
    expect(Entity.isEntity(123)).toBe(false);
    expect(Entity.isEntity({ id: 1 })).toBe(false);
  });

  test('equals compares entities by defined id', () => {
    const a = new TestEntity(1);
    const b = new TestEntity(1);
    const c = new TestEntity(2);
    const d = new TestEntity();

    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
    expect(a.equals(d)).toBe(false);
    expect(d.equals(d)).toBe(false); // undefined id => equality false
    expect(a.equals(null)).toBe(false);
    expect(a.equals(undefined)).toBe(false);
  });

  test('toJSON returns plain object with id', () => {
    const e = new TestEntity(7);
    expect(e.toJSON()).toStrictEqual({ id: 7 });
    const empty = new TestEntity();
    expect(empty.toJSON()).toStrictEqual({ id: undefined });
  });

  test('instances are instanceof Entity', () => {
    const e = new TestEntity(5);
    expect(e instanceof Entity).toBe(true);
  });
});
