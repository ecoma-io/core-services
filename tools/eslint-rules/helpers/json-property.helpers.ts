/**
 * Helper utilities for working with JSON AST property nodes.
 *
 * @packageDocumentation
 */

import type { AST } from 'jsonc-eslint-parser';
import type { TSESTree } from '@typescript-eslint/utils';

/**
 * Determine whether a JSONProperty node is a root-level property in a JSON file.
 *
 * @remarks
 * A root-level property is one that is directly under the top-level JSON program
 * or expression statement, not nested within other objects or arrays.
 *
 * @param node - The AST JSONProperty node to check.
 * @returns True when the property is at the root level of the JSON document.
 *
 * @example
 * ```typescript
 * // For JSON: { "name": "foo", "nested": { "prop": "bar" } }
 * // isRootProperty("name") -> true
 * // isRootProperty("nested") -> true
 * // isRootProperty("prop") -> false
 * ```
 */
export function isRootProperty(node: AST.JSONProperty): boolean {
  const parent = node.parent as { type?: string; parent?: unknown } | undefined;
  if (!parent || parent.type !== 'JSONObjectExpression') {
    return false;
  }

  const grandParent = parent.parent as { type?: string } | undefined;
  return (
    !!grandParent &&
    (grandParent.type === 'JSONProgram' ||
      grandParent.type === 'JSONExpressionStatement')
  );
}

/**
 * Safely extract a property name from a JSON property key node.
 *
 * @remarks
 * Handles both JSONIdentifier and JSONLiteral key types. Falls back to reading
 * the raw source text when the context is available.
 *
 * @param property - The JSONProperty node whose key should be read.
 * @param context - Optional ESLint context for fallback source text reading.
 * @returns The extracted property name or null if it cannot be determined.
 *
 * @example
 * ```typescript
 * const name = getPropertyName(propertyNode, context);
 * if (name === 'version') {
 *   // handle version property
 * }
 * ```
 */
export function getPropertyName(
  property: AST.JSONProperty,
  context?: { getSourceCode: () => { getText: (node: any) => string } }
): string | null {
  const key = property.key as AST.JSONIdentifier | AST.JSONLiteral | undefined;

  if (!key) {
    return null;
  }

  if (
    key.type === 'JSONIdentifier' &&
    typeof (key as AST.JSONIdentifier).name === 'string'
  ) {
    return (key as AST.JSONIdentifier).name;
  }

  if (
    key.type === 'JSONLiteral' &&
    typeof (key as AST.JSONLiteral).value === 'string'
  ) {
    return String((key as AST.JSONLiteral).value);
  }

  // Fallback: attempt to read raw text from source (best-effort).
  if (!context) {
    return null;
  }

  try {
    const sourceText = context
      .getSourceCode()
      .getText(property.key as unknown as TSESTree.Node | TSESTree.Token);
    return sourceText.replace(/^['"]|['"]$/g, '') || null;
  } catch {
    return null;
  }
}
