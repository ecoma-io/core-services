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
    // non-string version values should be ignored (no report)
    {
      filename: 'package.json',
      code: '{"version": 123}',
    },
    // version present as an object (non-literal string) should be ignored
    {
      filename: 'package.json',
      code: '{"version": {"major":1}}',
    },
    // non-package.json files should be ignored
    {
      filename: 'other.json',
      code: '{"version": "1.2.3"}',
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
    {
      // version as first property
      filename: 'package.json',
      code: '{"version":"1.2.3","name":"pkg"}',
      errors: [{ messageId: 'specificVersion' }],
      output: '{"version":"*","name":"pkg"}',
    },
  ],
});

describe(`${RULE_NAME} - extra coverage`, () => {
  function makeMockContext(filename: string) {
    const reports: any[] = [];
    return {
      filename,
      getFilename: () => filename,
      getSourceCode: () => ({
        getText: (node: any) => {
          if (node && typeof node.raw === 'string') return node.raw;
          return JSON.stringify(node);
        },
        text: '',
      }),
      report: (r: any) => reports.push(r),
      __reports: reports,
    } as any;
  }

  it('returns empty visitor for non-package.json files', () => {
    // Arrange
    const ctx = makeMockContext('some-file.json');
    // Act
    const visitor = rule.create(ctx as any, []) as any;
    // Assert
    expect(Object.keys(visitor).length).toBe(0);
  });

  it('reports when version is specific via mocked property with fallback key type', () => {
    // Arrange
    const ctx = makeMockContext('package.json');
    // Act
    const visitor = rule.create(ctx as any, []) as any;

    const fakeProperty = {
      key: { type: 'CustomKey', raw: '"version"' },
      value: { type: 'JSONLiteral', value: '1.2.3' },
      parent: { type: 'JSONObjectExpression', parent: { type: 'JSONProgram' } },
    };

    visitor.JSONProperty?.(fakeProperty);

    // Assert
    expect(ctx.__reports.length).toBe(1);
    expect(ctx.__reports[0].messageId).toBe('specificVersion');
  });

  it('ignores non-root version properties', () => {
    // Arrange
    const ctx = makeMockContext('package.json');
    // Act
    const visitor = rule.create(ctx as any, []) as any;

    const nestedProperty = {
      key: { type: 'JSONIdentifier', name: 'version' },
      value: { type: 'JSONLiteral', value: '1.0.0' },
      parent: {
        type: 'JSONObjectExpression',
        parent: { type: 'JSONProperty' },
      },
    };

    visitor.JSONProperty?.(nestedProperty);

    // Assert
    expect(ctx.__reports.length).toBe(0);
  });

  it('ignores version with value "*"', () => {
    // Arrange
    const ctx = makeMockContext('package.json');
    // Act
    const visitor = rule.create(ctx as any, []) as any;

    const starProperty = {
      key: { type: 'JSONIdentifier', name: 'version' },
      value: { type: 'JSONLiteral', value: '*' },
      parent: { type: 'JSONObjectExpression', parent: { type: 'JSONProgram' } },
    };

    visitor.JSONProperty?.(starProperty);

    // Assert
    expect(ctx.__reports.length).toBe(0);
  });
});
