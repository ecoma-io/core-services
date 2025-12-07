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
    // non-string name values should be ignored (no report)
    {
      filename: 'package.json',
      code: '{"name": 123}',
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
    // invalid configured regex should fall back to default and still report
    {
      filename: 'package.json',
      code: '{"name": "common"}',
      // invalid pattern will cause RegExp constructor to throw and trigger fallback
      options: [{ pattern: '[' } as any],
      errors: [{ messageId: 'invalidScope' }],
    },
  ],
});

describe(`${RULE_NAME} - extra coverage`, () => {
  it('returns empty visitor for non-package.json files', () => {
    // Arrange
    const ctx = makeMockContext('not-a-file.json');
    // Act
    const visitor = rule.create(ctx as any, []) as any;
    // Assert
    expect(Object.keys(visitor)).toHaveLength(0);
  });

  it('reports missingName via JSONProgram when no name property present', () => {
    // Arrange
    const ctx = makeMockContext('package.json');
    // Act
    const visitor = rule.create(ctx as any, []) as any;
    visitor.JSONProgram?.({ type: 'JSONProgram' });
    // Assert
    expect(ctx.__reports).toHaveLength(1);
    expect(ctx.__reports[0].messageId).toBe('missingName');
  });

  it('falls back to getSourceCode.getText when key type is unknown and still reports invalidScope', () => {
    // Arrange
    const ctx = makeMockContext('package.json');
    // Act
    const visitor = rule.create(ctx as any, []) as any;

    const fakeProperty = {
      key: { type: 'CustomKey', raw: '"name"' },
      value: { type: 'JSONLiteral', value: 'common' },
      parent: { type: 'JSONObjectExpression', parent: { type: 'JSONProgram' } },
    };

    visitor.JSONProperty?.(fakeProperty);

    // Assert
    expect(ctx.__reports).toHaveLength(1);
    expect(ctx.__reports[0].messageId).toBe('invalidScope');
  });

  it('ignores non-root name properties', () => {
    // Arrange
    const ctx = makeMockContext('package.json');
    // Act
    const visitor = rule.create(ctx as any, []) as any;

    const nestedProperty = {
      key: { type: 'JSONIdentifier', name: 'name' },
      value: { type: 'JSONLiteral', value: 'nested' },
      parent: {
        type: 'JSONObjectExpression',
        parent: { type: 'JSONProperty' },
      },
    };

    visitor.JSONProperty?.(nestedProperty);

    // Assert
    expect(ctx.__reports).toHaveLength(0);
  });

  it('reports missingName when name property is missing', () => {
    // Arrange
    const ctx = makeMockContext('package.json');
    // Act
    const visitor = rule.create(ctx as any, []) as any;

    visitor.JSONProgram?.({ type: 'JSONProgram' });

    // Assert
    expect(ctx.__reports).toHaveLength(1);
    expect(ctx.__reports[0].messageId).toBe('missingName');
  });

  it('ignores non-literal name values', () => {
    // Arrange
    const ctx = makeMockContext('package.json');
    // Act
    const visitor = rule.create(ctx as any, []) as any;

    const arrayProperty = {
      key: { type: 'JSONIdentifier', name: 'name' },
      value: { type: 'JSONArrayExpression' },
      parent: { type: 'JSONObjectExpression', parent: { type: 'JSONProgram' } },
    };

    visitor.JSONProperty?.(arrayProperty);

    // Assert
    expect(ctx.__reports).toHaveLength(0);
  });

  it('ignores non-string name values (number)', () => {
    // Arrange
    const ctx = makeMockContext('package.json');
    // Act
    const visitor = rule.create(ctx as any, []) as any;

    const numberProperty = {
      key: { type: 'JSONIdentifier', name: 'name' },
      value: { type: 'JSONLiteral', value: 123 },
      parent: { type: 'JSONObjectExpression', parent: { type: 'JSONProgram' } },
    };

    visitor.JSONProperty?.(numberProperty);

    // Assert
    expect(ctx.__reports).toHaveLength(0);
  });
});
