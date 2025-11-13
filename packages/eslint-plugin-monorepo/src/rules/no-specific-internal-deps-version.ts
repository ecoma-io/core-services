import { normalizePath } from '@nx/devkit';
import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';
import type { AST } from 'jsonc-eslint-parser';

/**
 * Rule name exported for tests/consumers.
 */
export const RULE_NAME = 'no-specific-internal-deps-version';

/**
 * ESLint rule enforcing that buildable/internal packages set `version` to "*".
 */
export const rule = ESLintUtils.RuleCreator(() => __filename)({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description: `Ensure buildable packages declare 'version' as '*' in package.json.`,
    },
    fixable: 'code',
    schema: [],
    messages: {
      specificVersion:
        "Buildable packages must declare 'version' as '*' in package.json.",
    },
  },
  defaultOptions: [],
  create(context) {
    const fileName = normalizePath(context.filename ?? context.getFilename());
    // support only package.json
    if (!fileName.endsWith('package.json')) {
      return {};
    }

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

        if (propertyName === 'version' && isRootProperty(node)) {
          const valueNode = node.value as AST.JSONLiteral | undefined;
          if (
            valueNode &&
            valueNode.type === 'JSONLiteral' &&
            typeof valueNode.value === 'string' &&
            valueNode.value !== '*'
          ) {
            context.report({
              node: node.value as unknown as TSESTree.Node,
              messageId: 'specificVersion',
              fix(fixer) {
                // replaceText accepts a Node or Token — cast the json literal
                return fixer.replaceText(
                  node.value as unknown as TSESTree.Node,
                  '"*"'
                );
              },
            });
          }
        }
      },
    };
  },
});

export default rule;
