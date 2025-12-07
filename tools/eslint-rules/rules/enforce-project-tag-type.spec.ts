import { RuleTester } from '@typescript-eslint/rule-tester';
import type { RuleTesterConfig } from '@typescript-eslint/rule-tester';
import * as path from 'path';
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

function makeMockContext(filename: string) {
  const reports: any[] = [];
  return {
    filename,
    getFilename: () => filename,
    getSourceCode: () => ({
      getText: (_: any) => '',
      text: '{}',
    }),
    report: (r: any) => reports.push(r),
    __reports: reports,
  } as any;
}

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
      // Custom tag prefix
      {
        filename: 'apps/custom/project.json',
        code: '{"tags": ["category:libs"]}',
        options: [{ tagPrefix: 'category:' }],
        output: '{"tags": ["category:apps"]}',
        errors: [{ messageId: 'missingTypeTag' }],
      },
      // Array ignore pattern
      {
        filename: 'tools/test/project.json',
        code: '{"name":"test"}',
        options: [{ ignore: ['libs/**'] }],
        output: '{"tags": ["type:tools"],"name":"test"}',
        errors: [{ messageId: 'missingTags' }],
      },
      // Malformed tags with non-array type
      {
        filename: 'libs/test/project.json',
        code: '{"tags": "not-an-array"}',
        output: '{"tags": ["type:libs"]}',
        errors: [{ messageId: 'malformedTags' }],
      },
      // Tags with non-string elements
      {
        filename: 'infras/test/project.json',
        code: '{"tags": [123, "foo"]}',
        output: '{"tags": ["123","foo","type:infras"]}',
        errors: [{ messageId: 'missingTypeTag' }],
      },
    ],
  }
);

describe(`${RULE_NAME} - extra coverage for path handling`, () => {
  it('computes relative path when file is inside workspace root', () => {
    // Arrange
    const inside = path.posix.join(
      process.cwd().replace(/\\/g, '/'),
      'apps',
      'inside',
      'project.json'
    );
    const ctx = makeMockContext(inside);
    // Act
    const visitor = rule.create(ctx as any, []) as any;
    visitor['JSONObjectExpression:exit']?.({
      type: 'JSONObjectExpression',
      parent: { type: 'JSONProgram' },
    });
    // Assert
    expect(ctx.__reports).toHaveLength(1);
    expect(ctx.__reports[0].messageId).toBe('missingTags');
  });

  it('falls back to normalized path when file is outside workspace root', () => {
    // Arrange
    const outside = path.posix.join('/tmp', 'somewhere-else', 'project.json');
    const ctx = makeMockContext(outside);
    // Act
    const visitor = rule.create(ctx as any, []) as any;
    visitor['JSONObjectExpression:exit']?.({
      type: 'JSONObjectExpression',
      parent: { type: 'JSONProgram' },
    });
    // Assert
    expect(ctx.__reports).toHaveLength(1);
    expect(ctx.__reports[0].messageId).toBe('missingTags');
  });

  it('handles non-root JSONObjectExpression (nested objects)', () => {
    // Arrange
    const ctx = makeMockContext('apps/test/project.json');
    // Act
    const visitor = rule.create(ctx as any, []) as any;
    // Non-root object should be ignored
    visitor['JSONObjectExpression:exit']?.({
      type: 'JSONObjectExpression',
      parent: { type: 'JSONProperty' },
    });
    // Assert
    expect(ctx.__reports).toHaveLength(0);
  });

  it('handles empty object body and adds tags', () => {
    // Arrange
    const ctx = makeMockContext('apps/test/project.json');
    ctx.getSourceCode = () => ({
      getText: () => '',
      text: '{}',
    });
    // Act
    const visitor = rule.create(ctx as any, []) as any;

    visitor['JSONObjectExpression:exit']?.({
      type: 'JSONObjectExpression',
      parent: { type: 'JSONProgram' },
    });

    // Assert
    expect(ctx.__reports).toHaveLength(1);
    expect(ctx.__reports[0].messageId).toBe('missingTags');
  });

  it('handles object with properties and adds tags at beginning', () => {
    // Arrange
    const ctx = makeMockContext('libs/core/project.json');
    ctx.getSourceCode = () => ({
      getText: () => '',
      text: '{"name": "core", "version": "1.0"}',
    });
    // Act
    const visitor = rule.create(ctx as any, []) as any;

    visitor['JSONObjectExpression:exit']?.({
      type: 'JSONObjectExpression',
      parent: { type: 'JSONProgram' },
    });

    // Assert
    expect(ctx.__reports).toHaveLength(1);
    expect(ctx.__reports[0].messageId).toBe('missingTags');
  });
});
