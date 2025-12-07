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
    {
      // version as first property
      filename: 'package.json',
      code: '{"version":"1.2.3","name":"pkg"}',
      errors: [{ messageId: 'noVersion' }],
      output: '{"name":"pkg"}',
    },
    {
      // version as only property
      filename: 'package.json',
      code: '{"version":"1.2.3"}',
      errors: [{ messageId: 'noVersion' }],
      output: '{}',
    },
    {
      // Multiple properties, version not first or last
      filename: 'package.json',
      code: '{"name":"test","version":"1.0.0","description":"desc","main":"index.js"}',
      errors: [{ messageId: 'noVersion' }],
      output: '{"name":"test","description":"desc","main":"index.js"}',
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
          return '"version"';
        },
        getTokenAfter: () => null,
        getTokenBefore: () => null,
        text: '',
      }),
      report: (r: any) => reports.push(r),
      __reports: reports,
    } as any;
  }

  it('returns empty visitor for non-package.json files', () => {
    // Arrange
    const ctx = makeMockContext('other.json');
    // Act
    const visitor = rule.create(ctx as any, []) as any;
    // Assert
    expect(Object.keys(visitor)).toHaveLength(0);
  });

  it('handles non-root version properties', () => {
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
      range: [0, 10],
    };

    visitor.JSONProperty?.(nestedProperty);

    // Assert
    expect(ctx.__reports).toHaveLength(0);
  });

  it('handles version property with no commas around it', () => {
    // Arrange
    const ctx = {
      filename: 'package.json',
      getFilename: () => 'package.json',
      getSourceCode: () => ({
        getText: () => '"version"',
        getTokenAfter: () => null,
        getTokenBefore: () => null,
      }),
      report: jest.fn(),
    } as any;

    // Act
    const visitor = rule.create(ctx, []) as any;
    const versionProperty = {
      key: { type: 'JSONIdentifier', name: 'version' },
      value: { type: 'JSONLiteral', value: '1.0.0' },
      parent: { type: 'JSONObjectExpression', parent: { type: 'JSONProgram' } },
      range: [0, 20],
    };

    visitor.JSONProperty?.(versionProperty);

    // Assert
    expect(ctx.report).toHaveBeenCalled();
  });

  it('handles version with comma after', () => {
    // Arrange
    const ctx = {
      filename: 'package.json',
      getFilename: () => 'package.json',
      getSourceCode: () => ({
        getText: () => '"version"',
        getTokenAfter: (node: any, pred: any) => {
          if (pred && pred({ value: ',' })) {
            return { range: [20, 21], value: ',' };
          }
          return null;
        },
        getTokenBefore: () => null,
      }),
      report: jest.fn(),
    } as any;

    // Act
    const visitor = rule.create(ctx, []) as any;
    const versionProperty = {
      key: { type: 'JSONIdentifier', name: 'version' },
      value: { type: 'JSONLiteral', value: '1.0.0' },
      parent: { type: 'JSONObjectExpression', parent: { type: 'JSONProgram' } },
      range: [0, 20],
    };

    visitor.JSONProperty?.(versionProperty);

    // Assert
    expect(ctx.report).toHaveBeenCalled();
  });

  it('handles version with comma before', () => {
    // Arrange
    const ctx = {
      filename: 'package.json',
      getFilename: () => 'package.json',
      getSourceCode: () => ({
        getText: () => '"version"',
        getTokenAfter: () => null,
        getTokenBefore: (node: any, pred: any) => {
          if (pred && pred({ value: ',' })) {
            return { range: [-1, 0], value: ',' };
          }
          return null;
        },
      }),
      report: jest.fn(),
    } as any;

    // Act
    const visitor = rule.create(ctx, []) as any;
    const versionProperty = {
      key: { type: 'JSONIdentifier', name: 'version' },
      value: { type: 'JSONLiteral', value: '1.0.0' },
      parent: { type: 'JSONObjectExpression', parent: { type: 'JSONProgram' } },
      range: [0, 20],
    };

    visitor.JSONProperty?.(versionProperty);

    // Assert
    expect(ctx.report).toHaveBeenCalled();
  });

  it('handles version with commas before and after', () => {
    // Arrange
    const ctx = {
      filename: 'package.json',
      getFilename: () => 'package.json',
      getSourceCode: () => ({
        getText: () => '"version"',
        getTokenAfter: (node: any, pred: any) => {
          if (pred && pred({ value: ',' })) {
            return { range: [20, 21], value: ',' };
          }
          return null;
        },
        getTokenBefore: (node: any, pred: any) => {
          if (pred && pred({ value: ',' })) {
            return { range: [-1, 0], value: ',' };
          }
          return null;
        },
      }),
      report: jest.fn(),
    } as any;

    // Act
    const visitor = rule.create(ctx, []) as any;
    const versionProperty = {
      key: { type: 'JSONIdentifier', name: 'version' },
      value: { type: 'JSONLiteral', value: '1.0.0' },
      parent: { type: 'JSONObjectExpression', parent: { type: 'JSONProgram' } },
      range: [0, 20],
    };

    visitor.JSONProperty?.(versionProperty);

    // Assert
    expect(ctx.report).toHaveBeenCalled();
  });
});
