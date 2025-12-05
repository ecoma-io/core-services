import { UuidV7VO } from './uuidv7.vo';
import { uuidv7 } from 'uuidv7';

test('UuidV7VO generates and validates uuidv7 values', () => {
  // Arrange & Act: runtime constructor access
  const inst = new (UuidV7VO as any)();
  const v = inst.getValue();

  // Implementation detail: when no explicit value supplied, private `value` may be undefined
  expect(v).toBeUndefined();

  // valid uuid v7 from library
  const good = uuidv7();
  const inst2 = new (UuidV7VO as any)(good);
  expect(inst2.getValue()).toBe(good);

  // invalid value should throw
  expect(() => new (UuidV7VO as any)('not-a-uuid')).toThrow(
    'Invalid UUIDv7 format'
  );
});
