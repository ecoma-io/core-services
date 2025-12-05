/**
 * Helper utilities for glob pattern matching.
 *
 * @packageDocumentation
 */

/**
 * Convert a glob pattern to a RegExp.
 *
 * @remarks
 * Supports simple glob semantics: `*` matches any sequence except `/`,
 * and `**` matches any sequence including `/`. Forward-slash paths are assumed.
 *
 * @param glob - The glob pattern string (e.g., `"apps/*\/project.json"`).
 * @returns A RegExp that matches filenames according to the glob pattern.
 *
 * @example
 * ```typescript
 * const regex = globToRegExp('apps/*\/project.json');
 * regex.test('apps/my-app/project.json'); // true
 * regex.test('apps/my-app/nested/project.json'); // false
 *
 * const regex2 = globToRegExp('apps/**\/project.json');
 * regex2.test('apps/my-app/project.json'); // true
 * regex2.test('apps/my-app/nested/project.json'); // true
 * ```
 */
export function globToRegExp(glob: string): RegExp {
  // Normalize separators to forward slashes
  const g = glob.replace(/\\/g, '/');

  // Use placeholders for glob tokens so they aren't escaped
  const DOUBLE = '<<GLOB_DOUBLE_STAR>>';
  const SINGLE = '<<GLOB_SINGLE_STAR>>';

  const withPlaceholders = g.replace(/\*\*/g, DOUBLE).replace(/\*/g, SINGLE);

  // Escape remaining regexp special chars
  const escaped = withPlaceholders.replace(
    /[-/\\^$+?.()|[\]{}]/g,
    (s) => `\\${s}`
  );

  // Restore placeholders to regexp fragments
  const withStars = escaped
    .replace(new RegExp(DOUBLE, 'g'), '.*')
    .replace(new RegExp(SINGLE, 'g'), '[^/]*');

  return new RegExp(`^${withStars}$`);
}
