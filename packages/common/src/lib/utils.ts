export * from './common';

// Runtime helpers (small, framework-agnostic)
/**
 * Checks if a value is a primitive type.
 * @param v - The value to check.
 * @returns {boolean} True if the value is a primitive (string, number, boolean, bigint, symbol, null, or undefined).
 */
export const isPrimitiveValue = (
  v: unknown
): v is string | number | boolean | bigint | symbol | null | undefined => {
  return v === null || (typeof v !== 'object' && typeof v !== 'function');
};

/**
 * Type guard that checks whether a value is a plain object.
 *
 * This function returns true for plain objects (object literals or instances
 * created with the Object constructor) and false for null, arrays, dates,
 * functions, and other non-plain objects.
 *
 * The implementation uses Object.prototype.toString.call to reliably detect
 * the internal [[Class]] of the value.
 *
 * @param {unknown} value - The value to test.
 * @returns {boolean} True if the value is a plain object and can be treated as
 * Record<string, unknown>; otherwise false.
 *
 * @example
 * isObject({}); // true
 * isObject(null); // false
 * isObject([]); // false
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * Simple deep clone that handles primitives, arrays, plain objects and Date.
 * Note: functions, class instances and circular references are not supported.
 * @param input - The value to deep clone.
 * @returns {T} A deep copy of the input value.
 */
export function deepClone<T>(input: T): T {
  if (isPrimitiveValue(input)) return input;
  if (input instanceof Date) return new Date(input.getTime()) as unknown as T;
  if (Array.isArray(input))
    return input.map((i) => deepClone(i)) as unknown as T;
  if (isObject(input)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = deepClone(v as unknown);
    }
    return out as unknown as T;
  }
  // Fallback: attempt JSON clone (may strip functions)
  try {
    return JSON.parse(JSON.stringify(input));
  } catch {
    return input;
  }
}

// Deep equality helper supporting primitives, arrays, plain objects and Date
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!Object.prototype.hasOwnProperty.call(bObj, key)) return false;
      if (!deepEqual(aObj[key], bObj[key])) return false;
    }
    return true;
  }

  return false;
}

/**
 * Pause execution for the specified number of milliseconds.
 * The `ms` argument is required to avoid accidental zero-delay calls.
 * @param ms - The number of milliseconds to sleep.
 * @returns {Promise<void>} A promise that resolves after the specified delay.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
