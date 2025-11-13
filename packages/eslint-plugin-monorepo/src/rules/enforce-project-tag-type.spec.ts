import { RuleTester } from '@typescript-eslint/rule-tester';
import type { RuleTesterConfig } from '@typescript-eslint/rule-tester';
import rule, {
  RULE_NAME,
  type EnforceProjectTagTypeOptions,
  type MessageIds,
} from './enforce-project-tag-type';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require('jsonc-eslint-parser'),
  },
} as RuleTesterConfig);

ruleTester.run<MessageIds, [EnforceProjectTagTypeOptions]>(
  RULE_NAME,
  rule as any,
  {
    valid: [
      {
        filename: 'apps/my-app/project.json',
        code: '{"name":"my-app","tags":["type:apps"]}',
      },
      {
        filename: 'libs/my-lib/project.json',
        code: '{"name":"my-lib","tags":["foo","type:libs","bar"]}',
      },
      {
        filename: 'packages/util/project.json',
        code: '{"tags":["type:packages"]}',
      },
      {
        filename: 'e2e/suite-a/project.json',
        code: '{"tags":["type:e2e","extra"]}',
      },
      {
        filename: 'apps/ignored/project.json',
        code: '{"name":"x"}',
        options: [{ ignore: 'apps/**/project.json' }],
      },
      // Non-project.json files should be ignored
      {
        filename: 'apps/my-app/package.json',
        code: '{"name":"@scope/pkg"}',
      },
    ],
    invalid: [
      // Missing tags entirely
      {
        filename: 'apps/web/project.json',
        code: '{"name":"web"}',
        output: '{"tags": ["type:apps"],"name":"web"}',
        errors: [{ messageId: 'missingTags' }],
      },
      // Empty object
      {
        filename: 'libs/data/project.json',
        code: '{}',
        output: '{"tags": ["type:libs"]}',
        errors: [{ messageId: 'missingTags' }],
      },
      // Malformed tags
      {
        filename: 'packages/core/project.json',
        code: '{"tags": {}}',
        output: '{"tags": ["type:packages"]}',
        errors: [{ messageId: 'malformedTags' }],
      },
      // Missing required entry -> normalized replacement
      {
        filename: 'infras/stack/project.json',
        code: '{"tags": ["foo"]}',
        output: '{"tags": ["foo","type:infras"]}',
        errors: [{ messageId: 'missingTypeTag' }],
      },
      // Wrong type tags present (apps) should be replaced with e2e only
      {
        filename: 'e2e/suite-b/project.json',
        code: '{"tags": ["type:apps","type:unknown"]}',
        output: '{"tags": ["type:e2e"]}',
        errors: [{ messageId: 'missingTypeTag' }],
      },
      // Multiple wrong type tags plus non-type tag preserved
      {
        filename: 'packages/complex/project.json',
        code: '{"tags": ["custom","type:apps","type:libs","type:packages","type:unknown"]}',
        output: '{"tags": ["custom","type:packages"]}',
        errors: [{ messageId: 'missingTypeTag' }],
      },
    ],
  }
);
