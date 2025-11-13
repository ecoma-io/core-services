import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';
import type { AST } from 'jsonc-eslint-parser';
import { normalizePath } from '@nx/devkit';

export const RULE_NAME = 'enforce-scope' as const;

/**
 * @description
 * JSON Schema for the rule options.
 *
 * @remarks
 * This rule accepts a single option object with a `pattern` string property.
 */
const schema = [
  {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The regex pattern the package name must match.',
      },
    },
    additionalProperties: false,
  },
] as const;

export type EnforceScopeRuleOptions = [{ pattern: string }];
export type MessageIds = 'invalidScope' | 'missingName';

/**
 * @description
 * ESLint rule that enforces package names to match a scoped pattern.
 *
 * @remarks
 * Rule reports when the root-level "name" property in a package JSON-like file
 * does not match the configured pattern. The default pattern enforces a scoped
 * package name like `@scope/name`.
 */
export const rule = ESLintUtils.RuleCreator(() => __filename)<
  EnforceScopeRuleOptions,
  MessageIds
>({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce package names to match a scoped pattern.',
    },
    schema,
    messages: {
      invalidScope:
        "Package name '{{packageName}}' must match the pattern '{{pattern}}'. Please use a scoped package name.",
      missingName:
        "The root 'name' property is missing or empty. All packages must have a name defined.",
    },
  },
  defaultOptions: [{ pattern: '^@.*/.*' }],

  create(context, [options]) {
    const fileName = normalizePath(context.filename ?? context.getFilename());
    // support only package.json
    if (!fileName.endsWith('package.json')) {
      return {};
    }

    const configuredPattern = options?.pattern ?? '^@.*/.*';

    let regex: RegExp;
    try {
      regex = new RegExp(configuredPattern);
    } catch {
      // If the provided pattern is invalid, fall back to the default scoped pattern.
      regex = new RegExp('^@.*/.*');
    }

    // Track whether a root-level `name` property was encountered so we can
    // report when it's missing from package.json.
    let foundName = false;

    /**
     * @description
     * Determine whether a JSONProperty node is a root-level property in a JSON file.
     *
     * @param {AST.JSONProperty} node
     *   The AST JSONProperty node to check.
     *
     * @returns {boolean}
     *   True when the property is directly under the top-level JSON program/expression.
     */
    function isRootProperty(node: AST.JSONProperty): boolean {
      const parent = node.parent as
        | { type?: string; parent?: unknown }
        | undefined;
      if (!parent || parent.type !== 'JSONObjectExpression') return false;

      const grandParent = parent.parent as { type?: string } | undefined;
      return (
        !!grandParent &&
        (grandParent.type === 'JSONProgram' ||
          grandParent.type === 'JSONExpressionStatement')
      );
    }

    /**
     * @description
     * Safely extract a property name from the property key node.
     *
     * @param {AST.JSONProperty} property
     *   The JSONProperty node whose key should be read.
     *
     * @returns {string | null}
     *   The extracted property name or null if it cannot be determined.
     */
    function getPropertyName(property: AST.JSONProperty): string | null {
      const key = property.key as
        | AST.JSONIdentifier
        | AST.JSONLiteral
        | undefined;

      if (!key) return null;

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
      try {
        const sourceText = context
          .getSourceCode()
          .getText(property.key as unknown as TSESTree.Node | TSESTree.Token);
        return sourceText.replace(/^['"]|['"]$/g, '') || null;
      } catch {
        return null;
      }
    }

    return {
      JSONProperty(node: AST.JSONProperty) {
        const propertyName = getPropertyName(node);

        // Only analyze root-level "name" property
        if (propertyName !== 'name' || !isRootProperty(node)) {
          return;
        }

        foundName = true;

        const valueNode = node.value as AST.JSONLiteral | undefined;
        if (!valueNode || valueNode.type !== 'JSONLiteral') {
          // The 'name' property exists but is not a literal string — ignore.
          return;
        }

        if (typeof valueNode.value !== 'string') {
          // Not a string value — nothing to validate here.
          return;
        }

        const packageName = valueNode.value;

        if (!regex.test(packageName)) {
          context.report({
            // Anchor the report on the literal value node. Cast via unknown to
            // the TSESTree.Node shape used by ESLint's reporting API to avoid
            // using `any` while keeping a safe structural cast.
            node: node.value as unknown as TSESTree.Node,
            messageId: 'invalidScope',
            data: {
              packageName,
              pattern: configuredPattern,
            },
            fix: null,
          });
        }
      },

      // At the end of the JSONProgram traversal, if no root `name` property
      // was found, report the missingName problem so users get a clear error
      // when a package.json has no name defined.
      JSONProgram(node: AST.JSONProgram) {
        if (!foundName) {
          // Report on the program node (fallback anchor) so the error is visible
          context.report({
            node: node as unknown as TSESTree.Node,
            messageId: 'missingName',
          });
        }
      },
    };
  },
});

export default rule;
