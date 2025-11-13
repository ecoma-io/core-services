import {
  ID,
  NullableOptional,
  Nullable,
  Optional,
  DeepPartial,
  ExtractArrayType,
  isPrimitiveValue,
  isObjectValue,
  deepClone,
} from './utils';
import { sleep } from './utils';

describe('utils type smoke tests (compile-time + runtime)', () => {
  // These helper functions are never executed for branching logic;
  // they're used so TypeScript checks assignability at compile time.
  function acceptID(id: ID) {
    return id;
  }

  function acceptNullableOptional<T>(v: NullableOptional<T>) {
    return v;
  }

  function acceptNullable<T>(v: Nullable<T>) {
    return v;
  }

  function acceptOptional<T>(v: Optional<T>) {
    return v;
  }

  function acceptDeepPartial<T>(v: DeepPartial<T>) {
    return v;
  }

  function acceptExtractArrayType<T>(v: ExtractArrayType<T>) {
    return v;
  }

  test('ID accepts string and number at compile-time and runtime', () => {
    // Arrange: Prepare test values
    const strValue = 'abc';
    const numValue = 123;

    // Act: Call the helper function with different types
    const s = acceptID(strValue);
    const n = acceptID(numValue);

    // Assert: Verify the types are accepted
    expect(typeof s === 'string' || typeof s === 'number').toBe(true);
    expect(typeof n === 'string' || typeof n === 'number').toBe(true);
  });

  test('NullableOptional / Nullable / Optional behave at compile-time', () => {
    // Arrange: Prepare test values for different nullable/optional types
    const nullVal = null;
    const undefinedVal = undefined;
    const strVal = 'value';
    const numNull = null;
    const numVal = 42;
    const boolUndefined = undefined;
    const boolVal = true;

    // Act: Call helper functions with the values
    const a = acceptNullableOptional<string>(nullVal);
    const b = acceptNullableOptional<string>(undefinedVal);
    const c = acceptNullableOptional<string>(strVal);

    const n1 = acceptNullable<number>(numNull);
    const n2 = acceptNullable<number>(numVal);

    const o1 = acceptOptional<boolean>(boolUndefined);
    const o2 = acceptOptional<boolean>(boolVal);

    // Assert: Verify that all values are accepted (length check ensures no compile errors)
    expect([a, b, c, n1, n2, o1, o2].length).toBeGreaterThan(0);
  });

  test('DeepPartial & ExtractArrayType used in a minimal scenario', () => {
    // Arrange: Define a type and prepare partial data
    type Foo = { a: { b: number }; list: string[] };
    const partialData: DeepPartial<Foo> = { a: {} };
    const extractedValue = 'x';

    // Act: Use the helper functions
    const extracted = acceptExtractArrayType<string[]>(extractedValue);
    acceptDeepPartial<Foo>(partialData);

    // Assert: Verify the operations succeed
    expect(partialData).toBeDefined();
    expect(extracted).toBe(extractedValue);
  });

  test('runtime helpers: isPrimitiveValue, isObjectValue, deepClone', () => {
    // Arrange: Prepare test values for primitives and objects
    const nullVal = null;
    const numVal = 1;
    const strVal = 's';
    const objVal = { a: 1 };
    const arrVal = [1, 2];
    type Orig = { a: number; b: { c: string }; d: Date };
    const original: Orig = { a: 1, b: { c: 'x' }, d: new Date('2020-01-01') };

    // Act: Test primitive checks
    const isNullPrimitive = isPrimitiveValue(nullVal);
    const isNumPrimitive = isPrimitiveValue(numVal);
    const isStrPrimitive = isPrimitiveValue(strVal);
    const isObjObject = isObjectValue(objVal);
    const isArrObject = isObjectValue(arrVal);
    const cloned = deepClone<Orig>(original);

    // Assert: Verify primitive checks
    expect(isNullPrimitive).toBe(true);
    expect(isNumPrimitive).toBe(true);
    expect(isStrPrimitive).toBe(true);
    expect(isObjObject).toBe(true);
    expect(isArrObject).toBe(false);

    // Assert: Verify deep clone
    expect(cloned).not.toBe(original);
    expect(cloned.b).not.toBe(original.b);
    expect(cloned.d instanceof Date).toBe(true);
    expect(cloned.d.getTime()).toBe(original.d.getTime());
  });

  test('sleep waits at least the requested time', async () => {
    // Arrange: Record start time and set sleep duration
    const start = Date.now();
    const sleepMs = 30;

    // Act: Sleep for the specified time
    await sleep(sleepMs);
    const elapsed = Date.now() - start;

    // Assert: Verify elapsed time is at least the requested minus variance
    expect(elapsed).toBeGreaterThanOrEqual(25);
  });

  test('deepClone handles arrays and primitives', () => {
    // Arrange: Prepare array and primitive values
    const arr = [1, { a: 2 }, [3]] as const;
    const num = 5;
    const str = 'x';

    // Act: Clone the values
    const clonedArr = deepClone(arr);
    const clonedNum = deepClone(num);
    const clonedStr = deepClone(str);

    // Assert: Verify arrays are deeply cloned
    expect(clonedArr).not.toBe(arr);
    expect(clonedArr[1]).not.toBe(arr[1]);

    // Assert: Verify primitives are unchanged
    expect(clonedNum).toBe(num);
    expect(clonedStr).toBe(str);
  });

  test('deepClone fallback returns input when JSON.stringify throws', () => {
    // Arrange: Create a function and mock JSON.stringify to throw
    const fn = () => {
      /* noop */
    };
    const spy = jest.spyOn(JSON, 'stringify').mockImplementation(() => {
      throw new Error('force stringify error');
    });

    try {
      // Act: Attempt to clone the function
      const out = deepClone(fn as unknown as () => void);

      // Assert: Verify the original input is returned
      expect(out).toBe(fn);
    } finally {
      spy.mockRestore();
    }
  });
});
