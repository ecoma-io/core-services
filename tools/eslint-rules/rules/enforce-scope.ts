import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';
import type { AST } from 'jsonc-eslint-parser';
import { normalizePath } from '@nx/devkit';
import { isRootProperty, getPropertyName, createRegex } from '../helpers';

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

    const regex: RegExp = createRegex(configuredPattern);

    // Track whether a root-level `name` property was encountered so we can
    // report when it's missing from package.json.
    let foundName = false;

    return {
      JSONProperty(node: AST.JSONProperty) {
        const propertyName = getPropertyName(node, context);

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
