export function expandEnv(
  config: Record<string, string>
): Record<string, string> {
  // Create a shallow copy so we don't mutate the original input
  const result: Record<string, string> = { ...config };

  // Regex to match ${VAR} or ${VAR:-default value}
  // Use a lazy quantifier `+?` to prevent ReDoS attacks.
  const varRegex = /\$\{([^}]+?)\}/g;

  // Helper to read current value from the result map as string (empty if undefined/null)
  // Try exact key, then uppercased, then lowercased to be more forgiving with env naming.
  const read = (name: string) => {
    const candidates = [name, name.toUpperCase(), name.toLowerCase()];
    for (const candidate of candidates) {
      if (Object.prototype.hasOwnProperty.call(result, candidate)) {
        const v = result[candidate];
        return v === undefined || v === null ? '' : String(v);
      }
    }
    return '';
  };

  // We'll iterate multiple passes across all keys to allow cross-key expansion
  const maxGlobalPasses = 10;

  for (let pass = 0; pass < maxGlobalPasses; pass++) {
    let anyChange = false;

    for (const key of Object.keys(result)) {
      const val = result[key];
      if (typeof val !== 'string') continue;

      const prev = val;
      // Replace all ${...} occurrences in the current value using current result map
      const next = prev.replace(varRegex, (_match, inner) => {
        // Support default syntax ${VAR:-default value}
        const [varName, ...rest] = inner.split(':-');
        const defaultValue = rest.length > 0 ? rest.join(':-') : undefined;

        const replacement = read(varName);
        if (replacement !== '') return replacement;
        if (defaultValue !== undefined) return defaultValue;
        // If not found and no default, replace with empty string (similar to shell behavior)
        return '';
      });

      if (next !== prev) {
        result[key] = next;
        anyChange = true;
      }
    }

    if (!anyChange) break;
  }

  return result;
}
