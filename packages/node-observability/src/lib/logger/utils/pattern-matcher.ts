/**
 * Checks if a pattern is a simple key name without wildcards or dots.
 * @remarks Simple patterns match against key names directly without path matching.
 * @param {string} pattern - The pattern to check.
 * @returns {boolean} True if the pattern is simple (no wildcards or dots).
 */
export function isSimplePattern(pattern: string): boolean {
  return (
    !pattern.includes('.') &&
    !pattern.includes('*') &&
    !pattern.includes('?') &&
    !pattern.includes('**')
  );
}

/**
 * Creates a normalizer function based on case sensitivity option.
 * @remarks Returns a function that optionally lowercases strings.
 * @param {boolean} caseInsensitive - Whether to normalize to lowercase.
 * @returns {(s: string) => string} Normalizer function.
 */
export function createNormalizer(
  caseInsensitive: boolean
): (s: string) => string {
  return caseInsensitive ? (s: string) => s.toLowerCase() : (s: string) => s;
}

/**
 * Matches a wildcard pattern against a path using recursive backtracking.
 * @remarks Supports '*' (single segment) and '**' (zero or more segments) wildcards.
 * @param {string[]} patternSegments - The pattern split by dots and normalized.
 * @param {string[]} pathSegments - The path to match against, normalized.
 * @returns {boolean} True if the pattern matches the path.
 */
export function matchWildcardPattern(
  patternSegments: readonly string[],
  pathSegments: readonly string[]
): boolean {
  const matchFrom = (pi: number, xi: number): boolean => {
    // Both pattern and path consumed - success
    if (pi === patternSegments.length && xi === pathSegments.length) {
      return true;
    }
    // Pattern consumed but path remains - failure
    if (pi === patternSegments.length) {
      return false;
    }

    const p = patternSegments[pi];

    // Handle '**' wildcard (matches zero or more segments)
    if (p === '**') {
      // Trailing '**' matches rest of path
      if (pi + 1 === patternSegments.length) {
        return true;
      }
      // Try matching with different numbers of skipped segments
      for (let skip = xi; skip <= pathSegments.length; skip++) {
        if (matchFrom(pi + 1, skip)) {
          return true;
        }
      }
      return false;
    }

    // Path exhausted but pattern remains
    if (xi >= pathSegments.length) {
      return false;
    }

    // Handle '*' (single segment wildcard) or exact match
    if (p === '*' || p === pathSegments[xi]) {
      return matchFrom(pi + 1, xi + 1);
    }

    return false;
  };

  return matchFrom(0, 0);
}

/**
 * Checks if a pattern matches a given path.
 * @remarks Handles both simple patterns (exact key match) and complex patterns (with wildcards).
 * @param {string} pattern - The pattern to match.
 * @param {string[]} path - The full path segments.
 * @param {boolean} caseInsensitive - Whether to match case-insensitively.
 * @returns {boolean} True if the pattern matches the path.
 */
export function doesPatternMatch(
  pattern: string,
  path: readonly string[],
  caseInsensitive: boolean
): boolean {
  const normalize = createNormalizer(caseInsensitive);
  const patternSegments = pattern.split('.').map(normalize);
  const normalizedPath = path.map(normalize);

  return matchWildcardPattern(patternSegments, normalizedPath);
}

/**
 * Checks if a simple pattern (no wildcards) matches the key name.
 * @remarks Matches against the key itself or the last segment of the path.
 * @param {string} pattern - The simple pattern.
 * @param {string} keyName - The key to check.
 * @param {string[]} fullPath - The complete path including the key.
 * @param {boolean} caseInsensitive - Whether to match case-insensitively.
 * @returns {boolean} True if the simple pattern matches.
 */
export function matchesSimplePattern(
  pattern: string,
  keyName: string,
  fullPath: readonly string[],
  caseInsensitive: boolean
): boolean {
  const normalize = createNormalizer(caseInsensitive);
  const keyToCompare = normalize(keyName);
  const patternNorm = normalize(pattern);

  // Direct key match
  if (keyToCompare === patternNorm) {
    return true;
  }

  // Match by full path last segment
  const lastSeg = normalize(fullPath[fullPath.length - 1]);
  return lastSeg === patternNorm;
}
