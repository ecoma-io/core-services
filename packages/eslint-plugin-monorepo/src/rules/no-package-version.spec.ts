import { RuleTester } from '@typescript-eslint/rule-tester';
import type { RuleTesterConfig } from '@typescript-eslint/rule-tester';
import { rule, RULE_NAME } from './no-package-version';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require('jsonc-eslint-parser'),
  },
} as RuleTesterConfig);

ruleTester.run(RULE_NAME, rule as any, {
  valid: [
    {
      filename: 'package.json',
      code: '{"name": "@ecoma-io/common"}',
    },
    // ignored by single-glob option
    {
      filename: 'package.json',
      code: '{"version":"1.2.3"}',
      options: [{ ignore: 'package.json' }],
    },
    // ignored by array of globs (recursive)
    {
      filename: 'packages/foo/package.json',
      code: '{"version":"1.2.3"}',
      options: [{ ignore: ['**/package.json'] }],
    },
    // nested "version" should be allowed
    {
      filename: 'package.json',
      code: '{"scripts": {"version": "1.2.3"}}',
    },
  ],
  invalid: [
    {
      filename: 'package.json',
      code: '{"version": "1.2.3"}',
      errors: [{ messageId: 'noVersion' }],
      output: '{}',
    },
    {
      // version in middle of object
      filename: 'package.json',
      code: '{"name":"pkg","version":"1.2.3","main":"index.js"}',
      errors: [{ messageId: 'noVersion' }],
      // expected output: remove the version property and the surrounding comma
      output: '{"name":"pkg","main":"index.js"}',
    },
    {
      // version as last property
      filename: 'package.json',
      code: '{"name":"pkg","version":"1.2.3"}',
      errors: [{ messageId: 'noVersion' }],
      output: '{"name":"pkg"}',
    },
  ],
});
