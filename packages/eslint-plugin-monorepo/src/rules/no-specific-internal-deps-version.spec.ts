import { RuleTester } from '@typescript-eslint/rule-tester';
import type { RuleTesterConfig } from '@typescript-eslint/rule-tester';
import { rule, RULE_NAME } from './no-specific-internal-deps-version';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require('jsonc-eslint-parser'),
  },
} as RuleTesterConfig);

ruleTester.run(RULE_NAME, rule as any, {
  valid: [
    {
      filename: 'package.json',
      code: '{"name": "@ecoma-io/common", "version": "*"}',
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
      errors: [{ messageId: 'specificVersion' }],
      output: '{"version": "*"}',
    },
    {
      // version in middle of object
      filename: 'package.json',
      code: '{"name":"pkg","version":"1.0.0","main":"index.js"}',
      errors: [{ messageId: 'specificVersion' }],
      output: '{"name":"pkg","version":"*","main":"index.js"}',
    },
    {
      // version as last property
      filename: 'package.json',
      code: '{"name":"pkg","version":"2.0.0"}',
      errors: [{ messageId: 'specificVersion' }],
      output: '{"name":"pkg","version":"*"}',
    },
  ],
});
