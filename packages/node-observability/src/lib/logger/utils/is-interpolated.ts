/**
 * Determine whether an object at position `objIndex` should be used for
 * interpolation into a format-style message (e.g. '%s', '%j', '%d', '%o').
 *
 * @param message - Candidate message (usually a string) containing placeholders
 * @param objIndex - Index for the object in the parameters list used as a cutoff
 * @returns True when the object should be used for interpolation; false otherwise
 */
export function isInterpolated(message: unknown, objIndex?: number): boolean {
  if (typeof message !== 'string') {
    return false;
  }

  // Match only valid placeholders (excluding standalone % symbols)
  const numPlaceholders = (message.match(/%[sdjo]/g) || []).length;

  // Use objIndex as a cutoff to determine if obj should be interpolated
  if (objIndex !== undefined) {
    return objIndex < numPlaceholders;
  }

  return numPlaceholders > 0;
}
