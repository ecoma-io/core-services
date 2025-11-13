// export * from '@ecoma-io/eslint-plugin-monorepo';

const moduleExports = require('@ecoma-io/eslint-plugin-monorepo');

/**
 * Import your custom workspace rules at the top of this file.
 *
 * For example:
 *
 * import { RULE_NAME as myCustomRuleName, rule as myCustomRule } from './rules/my-custom-rule';
 *
 * In order to quickly get started with writing rules you can use the
 * following generator command and provide your desired rule name:
 *
 * ```sh
 * npx nx g @nx/eslint:workspace-rule {{ NEW_RULE_NAME }}
 * ```
 */
module.exports = {
  rules: {
    ...moduleExports.rules,
  },
};
