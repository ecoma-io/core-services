import { RuleTester } from '@typescript-eslint/rule-tester';
import type { RuleTesterConfig } from '@typescript-eslint/rule-tester';
import {
  EnforceScopeRuleOptions,
  MessageIds,
  rule,
  RULE_NAME,
} from './enforce-scope';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require('jsonc-eslint-parser'),
  },
} as RuleTesterConfig);
ruleTester.run<MessageIds, EnforceScopeRuleOptions>(RULE_NAME, rule as any, {
  valid: [
    {
      filename: 'package.json',
      code: '{"name": "@ecoma-io/common"}',
    },
    {
      filename: 'package.json',
      code: '{"name": "@other-org/package"}',
    },
    {
      filename: 'package.json',
      code: '{"name": "@scoped/package-name"}',
    },
    // nested "name" should be allowed
    {
      filename: 'package.json',
      code: '{"scripts": {"name": "something"}}',
    },
    // custom pattern
    {
      filename: 'package.json',
      code: '{"name": "custom-package"}',
      options: [{ pattern: '^custom-.*' }],
    },
  ],
  invalid: [
    {
      filename: 'package.json',
      code: '{"name": "common"}',
      errors: [{ messageId: 'invalidScope' }],
    },
    {
      filename: 'package.json',
      code: '{"name": "pkg"}',
      errors: [{ messageId: 'invalidScope' }],
    },
    {
      filename: 'package.json',
      code: '{"name": "@invalid"}',
      errors: [{ messageId: 'invalidScope' }],
    },
    {
      filename: 'package.json',
      code: '{"name": "no-scope"}',
      options: [{ pattern: '^@ecoma-io/.*' }],
      errors: [{ messageId: 'invalidScope' }],
    },
  ],
});
