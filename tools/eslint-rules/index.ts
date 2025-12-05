import {
  RULE_NAME as noPackageVersionName,
  rule as noPackageVersion,
} from './rules/no-package-version';
import {
  RULE_NAME as enforceScopeName,
  rule as enforceScope,
} from './rules/enforce-scope';
import {
  RULE_NAME as noSpecificVersionName,
  rule as noSpecificVersion,
} from './rules/no-specific-internal-deps-version';
import {
  RULE_NAME as enforceProjectTagTypeName,
  rule as enforceProjectTagType,
} from './rules/enforce-project-tag-type';

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
    [enforceProjectTagTypeName]: enforceProjectTagType,
    [noPackageVersionName]: noPackageVersion,
    [enforceScopeName]: enforceScope,
    [noSpecificVersionName]: noSpecificVersion,
  },
};
