import { normalizePath } from '@nx/devkit';
import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';
import type { AST } from 'jsonc-eslint-parser';
import { isRootProperty, getPropertyName } from '../helpers';

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

    return {
      JSONProperty(node: AST.JSONProperty) {
        const propertyName = getPropertyName(node, context);

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
