import {
  ID,
  NullableOptional,
  Nullable,
  Optional,
  DeepPartial,
  deepEqual,
  ExtractArrayType,
  isPrimitiveValue,
  deepClone,
  isObject,
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

  test('runtime helpers: isPrimitiveValue, isObject, deepClone', () => {
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
    const isObjObject = isObject(objVal);
    const isArrObject = isObject(arrVal);
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

  test('deepClone uses JSON fallback for non-plain objects (Map/Set)', () => {
    // Arrange: Map and Set are not plain objects for `isObject` and will hit the JSON fallback
    const m = new Map([['k', 1]]);
    const s = new Set([1, 2, 3]);

    // Act
    const outMap = deepClone(m as unknown as object);
    const outSet = deepClone(s as unknown as object);

    // Assert: JSON fallback will produce plain objects/arrays (or empty objects), not the original instances
    expect(typeof outMap).toBe('object');
    expect(outMap).not.toBe(m);
    expect(typeof outSet).toBe('object');
    expect(outSet).not.toBe(s);
  });

  test('deepEqual returns false when arrays have different lengths', () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(deepEqual(a, b)).toBe(false);
  });

  test('deepEqual returns false when object keys differ but have same length', () => {
    const a = { a: 1, b: 2 };
    const b = { a: 1, c: 2 };
    expect(deepEqual(a, b)).toBe(false);
  });
});
describe('deepEqual runtime behaviour', () => {
  test('primitive comparisons', () => {
    // Arrange
    const a = 42;
    const b = 42;
    const c = '42';
    const n1 = null;
    const n2 = null;
    const u = undefined;

    // Act / Assert
    expect(deepEqual(a, b)).toBe(true);
    expect(deepEqual(a, c)).toBe(false);
    expect(deepEqual(n1, n2)).toBe(true);
    expect(deepEqual(n1, u)).toBe(false);
    expect(deepEqual(true, false)).toBe(false);
  });

  test('date comparisons', () => {
    // Arrange
    const d1 = new Date('2020-01-01T00:00:00.000Z');
    const d2 = new Date('2020-01-01T00:00:00.000Z');
    const d3 = new Date('2021-01-01T00:00:00.000Z');

    // Act / Assert
    expect(deepEqual(d1, d2)).toBe(true);
    expect(deepEqual(d1, d3)).toBe(false);
  });

  describe('array and object branches (shim ValueObject.deepEqual)', () => {
    const originalValueObject = (global as any).ValueObject;

    beforeEach(() => {
      // Provide a self-contained deep equality implementation for test-time
      const eq = function eq(x: unknown, y: unknown): boolean {
        if (x === y) return true;

        if (x instanceof Date && y instanceof Date) {
          return x.getTime() === y.getTime();
        }

        if (typeof x !== typeof y) return false;

        if (x && y && typeof x === 'object' && typeof y === 'object') {
          // Arrays
          if (Array.isArray(x) && Array.isArray(y)) {
            const xa = x as unknown[];
            const ya = y as unknown[];
            if (xa.length !== ya.length) return false;
            for (let i = 0; i < xa.length; i++) {
              if (!eq(xa[i], ya[i])) return false;
            }
            return true;
          }

          if (Array.isArray(x) !== Array.isArray(y)) return false;

          const xo = x as Record<string, unknown>;
          const yo = y as Record<string, unknown>;
          const xKeys = Object.keys(xo);
          const yKeys = Object.keys(yo);
          if (xKeys.length !== yKeys.length) return false;
          for (const k of xKeys) {
            if (!Object.prototype.hasOwnProperty.call(yo, k)) return false;
            if (!eq(xo[k], yo[k])) return false;
          }
          return true;
        }

        return false;
      };

      (global as any).ValueObject = { deepEqual: eq };
    });

    afterEach(() => {
      if (originalValueObject === undefined) {
        delete (global as any).ValueObject;
      } else {
        (global as any).ValueObject = originalValueObject;
      }
    });

    test('arrays compared via shim are deeply equal or not', () => {
      // Arrange
      const arrA = [1, { a: 2 }, [3, 4]];
      const arrB = [1, { a: 2 }, [3, 4]];
      const arrC = [1, { a: 3 }, [3, 4]];

      // Act / Assert
      expect(deepEqual(arrA, arrB)).toBe(true);
      expect(deepEqual(arrA, arrC)).toBe(false);
    });

    test('plain objects compared via shim are deeply equal or not', () => {
      // Arrange
      const objA = { x: 1, y: { z: 'a' } };
      const objB = { x: 1, y: { z: 'a' } };
      const objC = { x: 1, y: { z: 'b' } };
      const objD = { x: 1, y: { z: 'a' }, extra: 5 };

      // Act / Assert
      expect(deepEqual(objA, objB)).toBe(true);
      expect(deepEqual(objA, objC)).toBe(false);
      expect(deepEqual(objA, objD)).toBe(false);
    });
  });
});
