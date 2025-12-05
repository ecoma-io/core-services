import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';
import type { AST } from 'jsonc-eslint-parser';
import { normalizePath } from '@nx/devkit';
import { globToRegExp, computeRequiredTag } from '../helpers';
export const RULE_NAME = 'enforce-project-tag-type' as const;

/** No shared schema variable; inline schema below to preserve literal types. */

export type EnforceProjectTagTypeOptions = Readonly<{
  readonly ignore?: string | readonly string[];
  readonly tagPrefix?: string; // default: 'type:'
}>;

export type MessageIds = 'missingTags' | 'missingTypeTag' | 'malformedTags';

/**
 * ESLint rule ensuring each Nx `project.json` has a type tag based on its parent folder.
 *
 * parentFolder/apps/my-app/project.json -> required tag: type:apps
 * parentFolder/libs/data/project.json -> required tag: type:libs
 *
 * @remarks
 * The parent folder is determined by the directory directly under the repo root
 * (e.g. `apps/xyz/project.json`, `libs/abc/project.json`, `packages/foo/project.json`).
 * The rule auto-fixes by inserting or updating the `tags` array. Supports an `ignore` option.
 */
export const rule = ESLintUtils.RuleCreator(() => __filename)<
  [EnforceProjectTagTypeOptions],
  MessageIds
>({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require Nx project.json files to include a correct type:[segment] tag derived from the top-level folder.',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          ignore: {
            anyOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } },
            ],
          },
          tagPrefix: {
            type: 'string',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingTags:
        "project.json must contain a 'tags' array including the required type tag.",
      malformedTags:
        'The \'tags\' property must be an array of string literals (e.g. ["type:apps"]).',
      missingTypeTag:
        "The 'tags' array must include the required tag '{{requiredTag}}'.",
    },
  },
  defaultOptions: [{}],
  create(context, [options]) {
    const fileName = normalizePath(context.filename ?? context.getFilename());

    if (!fileName.endsWith('project.json')) {
      return {};
    }

    const rawIgnore = options?.ignore;
    const ignorePatterns: readonly string[] = Array.isArray(rawIgnore)
      ? rawIgnore
      : typeof rawIgnore === 'string'
        ? [rawIgnore]
        : [];
    const ignoreRegexps = ignorePatterns.map(globToRegExp);
    if (ignoreRegexps.some((r) => r.test(fileName))) {
      return {};
    }

    // Derive required tag from top-level directory under repo root
    const requiredTag = computeRequiredTag(fileName, {
      tagPrefix: options?.tagPrefix,
    });

    let foundTagsNode: AST.JSONProperty | null = null;
    let containsRequiredTag = false;

    function isRootProperty(node: AST.JSONProperty): boolean {
      const parent = node.parent as
        | { type?: string; parent?: unknown }
        | undefined;
      if (!parent || parent.type !== 'JSONObjectExpression') return false;
      const grand = parent.parent as { type?: string } | undefined;
      return (
        !!grand &&
        (grand.type === 'JSONProgram' ||
          grand.type === 'JSONExpressionStatement')
      );
    }

    return {
      JSONProperty(node: AST.JSONProperty) {
        if (!isRootProperty(node)) return;
        const sourceCode = context.getSourceCode();
        const rawKey = sourceCode
          .getText(node.key as unknown as TSESTree.Node)
          .replace(/^['"]|['"]$/g, '');
        if (rawKey !== 'tags') return;

        foundTagsNode = node;
        if (node.value.type !== 'JSONArrayExpression') {
          // malformed tags property
          context.report({
            node: node.value as unknown as TSESTree.Node,
            messageId: 'malformedTags',
            fix(fixer) {
              return fixer.replaceText(
                node.value as unknown as TSESTree.Node,
                `["${requiredTag}"]`
              );
            },
          });
          return;
        }

        const elements = node.value.elements as readonly (
          | AST.JSONLiteral
          | AST.JSONIdentifier
          | AST.JSONArrayExpression
          | AST.JSONObjectExpression
          | null
        )[];
        const stringValues = elements
          .map((el) =>
            el && el.type === 'JSONLiteral' ? String(el.value) : null
          )
          .filter((v): v is string => typeof v === 'string');

        containsRequiredTag = stringValues.includes(requiredTag);

        const typePrefix = options?.tagPrefix ?? 'type:';
        const wrongTypeTags = stringValues.filter(
          (t) => t.startsWith(typePrefix) && t !== requiredTag
        );

        if (!containsRequiredTag || wrongTypeTags.length > 0) {
          context.report({
            node: node.value as unknown as TSESTree.Node,
            messageId: 'missingTypeTag',
            data: { requiredTag },
            fix(fixer) {
              // Normalize tags: keep only non-type tags + requiredTag (unique)
              const nonType = stringValues.filter(
                (t) => !t.startsWith(typePrefix)
              );
              const dedup = Array.from(new Set([...nonType, requiredTag]));
              const replacement = JSON.stringify(dedup);
              return fixer.replaceText(
                node.value as unknown as TSESTree.Node,
                replacement
              );
            },
          });
        }
      },
      'JSONObjectExpression:exit'(node: AST.JSONObjectExpression) {
        // Only consider root object
        const parent = node.parent as { type?: string } | undefined;
        const isRootObject =
          !!parent &&
          (parent.type === 'JSONProgram' ||
            parent.type === 'JSONExpressionStatement');
        if (!isRootObject) return;
        if (foundTagsNode) return; // tags already present
        context.report({
          node: node as unknown as TSESTree.Node,
          messageId: 'missingTags',
          fix(fixer) {
            const sourceCode = context.getSourceCode();
            const original = sourceCode.text;
            const braceIndex = original.indexOf('{');
            if (braceIndex === -1) return null;
            let i = braceIndex + 1;
            while (i < original.length && /\s/.test(original[i])) i++;
            const isEmptyObject = original[i] === '}';
            const injected = isEmptyObject
              ? `{"tags": ["${requiredTag}"]`
              : `{"tags": ["${requiredTag}"],`;
            const newText = injected + original.slice(braceIndex + 1);
            return fixer.replaceTextRange([0, original.length], newText);
          },
        });
      },
    };
  },
});

export default rule;
