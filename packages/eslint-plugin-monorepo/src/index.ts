/**
 * ESLint plugin entrypoint for the monorepo.
 *
 * @remarks
 * This module aggregates and exposes ESLint rules implemented in this package.
 * It exports a typed `rules` object compatible with TypeScript consumers and
 * also assigns the same object to `module.exports` for CommonJS consumers
 * (ESLint expects CommonJS plugin shape at runtime).
 *
 * @packageDocumentation
 */

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
 * Mapping of rule name to its ESLint RuleModule implementation.
 *
 * @remarks
 * Each key is the canonical rule name exposed by this plugin and the value
 * implements the ESLint RuleModule interface.
 *
 * @type {Record<string, import('eslint').Rule.RuleModule>}
 */
export const rules = {
  [enforceProjectTagTypeName]: enforceProjectTagType,
  [noPackageVersionName]: noPackageVersion,
  [enforceScopeName]: enforceScope,
  [noSpecificVersionName]: noSpecificVersion,
};

/**
 * CommonJS export for ESLint (keeps runtime compatibility).
 *
 * @remarks
 * Some consumers (including the ESLint CLI) load plugins via CommonJS, so we
 * mirror the exported shape on module.exports while keeping a typed ES export.
 *
 * @returns {{ rules: Record<string, import('eslint').Rule.RuleModule> }}
 */
module.exports = {
  rules,
};
