export * from './common';
/**
 * Checks if a value is a primitive type.
 * @param v - The value to check.
 * @returns {boolean} True if the value is a primitive (string, number, boolean, bigint, symbol, null, or undefined).
 */
export declare const isPrimitiveValue: (v: unknown) => v is string | number | boolean | bigint | symbol | null | undefined;
/**
 * Checks if a value is a plain object (not array, not Date, not null).
 * @param v - The value to check.
 * @returns {boolean} True if the value is a plain object.
 */
export declare const isObjectValue: (v: unknown) => v is Record<string, unknown>;
/**
 * Simple deep clone that handles primitives, arrays, plain objects and Date.
 * Note: functions, class instances and circular references are not supported.
 * @param input - The value to deep clone.
 * @returns {T} A deep copy of the input value.
 */
export declare function deepClone<T>(input: T): T;
/**
 * Pause execution for the specified number of milliseconds.
 * The `ms` argument is required to avoid accidental zero-delay calls.
 * @param ms - The number of milliseconds to sleep.
 * @returns {Promise<void>} A promise that resolves after the specified delay.
 */
export declare function sleep(ms: number): Promise<void>;
