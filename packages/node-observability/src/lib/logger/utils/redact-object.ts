import {
  doesPatternMatch,
  isSimplePattern,
  matchesSimplePattern,
} from './pattern-matcher';
import type { RedactOptions } from './redact-object.types';

/**
 * Determines if a key should be redacted based on patterns.
 * @remarks Tests both simple patterns and wildcard patterns against the key path.
 * @param {string[]} fullPath - The path to the parent of the key.
 * @param {string} keyName - The key name to check.
 * @param {string[]} patterns - The list of redaction patterns.
 * @param {boolean} caseInsensitive - Whether to match case-insensitively.
 * @returns {boolean} True if the key should be redacted.
 */
function shouldRedactKey(
  fullPath: readonly string[],
  keyName: string,
  patterns: readonly string[],
  caseInsensitive: boolean
): boolean {
  const path = [...fullPath, keyName];

  for (const pattern of patterns) {
    if (isSimplePattern(pattern)) {
      if (matchesSimplePattern(pattern, keyName, path, caseInsensitive)) {
        return true;
      }
    } else {
      // Complex patterns with wildcards
      if (doesPatternMatch(pattern, path, caseInsensitive)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Recursively redacts values in an object structure.
 * @remarks Handles primitives, arrays, and plain objects with depth limiting.
 * @param {unknown} value - The value to redact.
 * @param {string[]} fullPath - The current path in the object tree.
 * @param {number} depthLeft - Remaining recursion depth.
 * @param {string[]} patterns - Patterns to match for redaction.
 * @param {string} replacement - The replacement string.
 * @param {boolean} caseInsensitive - Whether matching is case-insensitive.
 * @returns {unknown} The redacted value.
 */
function redactValue(
  value: unknown,
  fullPath: readonly string[],
  depthLeft: number,
  patterns: readonly string[],
  replacement: string,
  caseInsensitive: boolean
): unknown {
  // Handle primitives and null
  if (value === null || typeof value !== 'object') {
    return value;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map((item) =>
      redactValue(
        item,
        fullPath,
        depthLeft,
        patterns,
        replacement,
        caseInsensitive
      )
    );
  }

  // Handle objects
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (shouldRedactKey(fullPath, k, patterns, caseInsensitive)) {
      out[k] = replacement;
    } else if (typeof v === 'object' && v !== null) {
      if (depthLeft <= 0) {
        out[k] = v;
      } else {
        out[k] = redactValue(
          v,
          [...fullPath, k],
          depthLeft - 1,
          patterns,
          replacement,
          caseInsensitive
        );
      }
    } else {
      out[k] = v;
    }
  }

  return out;
}

/**
 * Recursively redacts sensitive fields in an object.
 * @remarks Only redacts plain objects and arrays, leaves primitives untouched.
 * Supports simple key matching and wildcard patterns ('*', '**') for flexible redaction rules.
 * @param {T} obj - The object to redact.
 * @param {string[]} keys - The list of keys or patterns to redact.
 * @param {RedactOptions} [options] - Configuration options for redaction behavior.
 * @returns {T} A new object with redacted fields.
 *
 * @example
 * const obj = { user: { password: 'secret', name: 'John' } };
 * redactObject(obj, ['password']); // { user: { password: '***', name: 'John' } }
 * redactObject(obj, ['user.password']); // same result
 * redactObject(obj, ['**.password']); // matches password at any depth
 */
export function redactObject<T>(
  obj: T,
  keys: string[],
  options?: RedactOptions
): T {
  const replacement = options?.replacement ?? '***';
  const caseInsensitive = !!options?.caseInsensitive;
  const maxDepth =
    typeof options?.maxDepth === 'number' ? options.maxDepth : Infinity;

  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  return redactValue(
    obj as unknown,
    [],
    maxDepth,
    keys,
    replacement,
    caseInsensitive
  ) as T;
}
