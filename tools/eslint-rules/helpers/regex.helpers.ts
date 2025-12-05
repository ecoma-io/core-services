/**
 * Helper utilities for regex pattern creation and validation.
 *
 * @packageDocumentation
 */

/**
 * Create a RegExp from a pattern string with fallback to default.
 *
 * @remarks
 * If the provided pattern is invalid, falls back to a default scoped package
 * pattern. This ensures the rule always has a valid regex.
 *
 * @param pattern - The regex pattern string (optional).
 * @returns A RegExp instance created from the pattern or the default fallback.
 *
 * @example
 * ```
 * const regex = createRegex('^@myorg/.*');
 * regex.test('@myorg/package'); // true
 *
 * const fallback = createRegex('[invalid');
 * fallback.test('@scope/name'); // true (uses default)
 * ```
 */
export function createRegex(pattern?: string): RegExp {
  const configuredPattern = pattern ?? '^@.*/.*';
  try {
    return new RegExp(configuredPattern);
  } catch {
    // Fallback to default scoped package pattern
    return new RegExp('^@.*/.*');
  }
}
