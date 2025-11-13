import { normalizePath } from '@nx/devkit';
import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import type { AST } from 'jsonc-eslint-parser';

/**
 * Rule name exported for consumers/tests
 */
export const RULE_NAME = 'no-package-version';

/**
 * Options shape for this rule.
 */
export type NoPackageVersionOptions = Readonly<{
  /**
   * One or more glob patterns (forward-slash separated) to ignore. If the
   * current filename matches any glob, the rule will be skipped for that file.
   * Example: 'packages/*\\/package.json' or ['**\\/package.json'].
   */
  readonly ignore?: string | readonly string[];
}>;

/**
 * Message IDs used by this rule.
 */
export type MessageIds = 'noVersion';

/**
 * ESLint rule that reports and fixes root-level `version` properties in package.json
 * (versions are managed externally in this monorepo).
 *
 * @remarks
 * Supports an optional `ignore` option (string or array of strings) with glob
 * patterns that will skip the rule for matching filenames.
 */
export const rule = ESLintUtils.RuleCreator(() => __filename)<
  [NoPackageVersionOptions],
  MessageIds
>({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description: `Disallow the 'version' field in package.json files; versions are managed externally.`,
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
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noVersion:
        "Do not declare 'version' in package.json — versions are managed externally.",
    },
  },
  defaultOptions: [{} as NoPackageVersionOptions],
  create(context, [options]) {
    const fileName = normalizePath(context.filename ?? context.getFilename());

    // Helper: convert a glob (simple glob semantics) to a RegExp.
    // Supports '*', '**' and literal path segments. Uses forward-slash paths.
    function globToRegExp(glob: string): RegExp {
      // Normalize separators
      const g = glob.replace(/\\/g, '/');
      // Use placeholders for glob tokens so they aren't escaped.
      const DOUBLE = '<<GLOB_DOUBLE_STAR>>';
      const SINGLE = '<<GLOB_SINGLE_STAR>>';

      const withPlaceholders = g
        .replace(/\*\*/g, DOUBLE)
        .replace(/\*/g, SINGLE);

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

    // Normalize options.ignore to an array of regexps
    const rawIgnore = options?.ignore;
    const ignorePatternsRaw: readonly string[] = Array.isArray(rawIgnore)
      ? rawIgnore
      : typeof rawIgnore === 'string'
        ? [rawIgnore]
        : [];

    const ignoreRegexps = ignorePatternsRaw.map((p) => globToRegExp(p));

    // If any ignore pattern matches the filename, do not run the rule
    if (ignoreRegexps.some((r) => r.test(fileName))) {
      return {};
    }

    // Only run on package.json files
    if (!fileName.endsWith('package.json')) {
      return {};
    }

    function isRootProperty(node: AST.JSONProperty): boolean {
      const parent = node.parent as unknown as
        | { type?: string; parent?: unknown }
        | undefined;
      if (!parent || parent.type !== 'JSONObjectExpression') return false;
      const grandParent = parent.parent as unknown as
        | { type?: string }
        | undefined;
      return (
        grandParent &&
        (grandParent.type === 'JSONProgram' ||
          grandParent.type === 'JSONExpressionStatement')
      );
    }

    return {
      JSONProperty(node: AST.JSONProperty) {
        const sourceCode = context.getSourceCode();
        const rawKeyText = sourceCode.getText(
          // getText accepts a Node or Token — cast the JSON key to a Node
          node.key as unknown as TSESTree.Node
        );
        const propertyName =
          (rawKeyText || '').replace(/^['"]|['"]$/g, '') || null;

        if (propertyName === 'version' && isRootProperty(node)) {
          context.report({
            // report anchored on the property node
            node: node as unknown as TSESTree.Node,
            messageId: 'noVersion',
            fix(fixer) {
              const sourceCode = context.getSourceCode();

              const commaAfter = sourceCode.getTokenAfter(
                // getTokenAfter accepts a Node or Token
                node as unknown as TSESTree.Node,
                (token) => token.value === ','
              );
              const commaBefore = sourceCode.getTokenBefore(
                node as unknown as TSESTree.Node,
                (token) => token.value === ','
              );

              // node.range is present on the jsonc AST nodes; cast to access it
              const nodeRange = (node as unknown as { range: [number, number] })
                .range;
              if (commaBefore && commaAfter) {
                // middle property: remove from previous comma to end of property
                return fixer.removeRange([commaBefore.range[0], nodeRange[1]]);
              } else if (commaBefore) {
                // last property
                return fixer.removeRange([commaBefore.range[0], nodeRange[1]]);
              } else if (commaAfter) {
                // first property
                return fixer.removeRange([nodeRange[0], commaAfter.range[1]]);
              } else {
                // only property
                return fixer.removeRange(nodeRange);
              }
            },
          });
        }
      },
    };
  },
});

export default rule;
