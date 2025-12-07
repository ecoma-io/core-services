import { rule as ruleNoSpecific } from './no-specific-internal-deps-version';
import { rule as ruleNoVersion } from './no-package-version';
import { rule as ruleProjectTag } from './enforce-project-tag-type';

function makeCtx(filename: string, sourceText = '{}') {
  const reports: any[] = [];
  return {
    filename,
    getFilename: () => filename,
    getSourceCode: () => ({
      getText: (node: any) => {
        if (!node) return '';
        if (typeof node.raw === 'string') return node.raw;
        if (typeof node.name === 'string') return node.name;
        return JSON.stringify(node);
      },
      text: sourceText,
      getTokenAfter: () => undefined,
      getTokenBefore: () => undefined,
    }),
    report: (r: any) => reports.push(r),
    __reports: reports,
  } as any;
}

describe('execute fixer bodies to increase coverage', () => {
  it('executes fix for no-specific-internal-deps-version', () => {
    // Arrange
    const ctx = makeCtx('package.json');
    // Act
    const visitor = ruleNoSpecific.create(ctx as any, []) as any;
    const fakeProperty = {
      key: { type: 'CustomKey', raw: '"version"' },
      value: { type: 'JSONLiteral', value: '1.2.3' },
      parent: { type: 'JSONObjectExpression', parent: { type: 'JSONProgram' } },
    };
    visitor.JSONProperty?.(fakeProperty);

    // Assert
    expect(ctx.__reports).toHaveLength(1);
    const fixFn = ctx.__reports[0].fix as (f: any) => any;
    const res = fixFn({
      replaceText: (_node: any, text: string) => ({ replaced: text }),
    });
    expect(res.replaced).toBe('"*"');
  });

  it('executes fix for no-package-version removing only-property', () => {
    // Arrange
    const ctx = makeCtx('package.json', '{"version":"1.0.0"}');
    // Provide sourceCode tokens behavior via getSourceCode in makeCtx: no tokens
    // Act
    const visitor = ruleNoVersion.create(ctx as any, []) as any;
    const fakeProperty = {
      key: { type: 'JSONIdentifier', name: 'version' },
      value: { type: 'JSONLiteral', value: '1.0.0' },
      parent: { type: 'JSONObjectExpression', parent: { type: 'JSONProgram' } },
      range: [0, 18],
    } as any;
    visitor.JSONProperty?.(fakeProperty);

    // Assert
    expect(ctx.__reports).toHaveLength(1);
    const fixFn = ctx.__reports[0].fix as (f: any) => any;
    const res = fixFn({ removeRange: (r: any[]) => ({ removed: r }) });
    expect(res.removed).toEqual([0, 18]);
  });

  it('executes fix for enforce-project-tag-type missingTags (empty object)', () => {
    // Arrange
    const inside = 'apps/example/project.json';
    const ctx = makeCtx(inside, '{}');
    // Act
    const visitor = ruleProjectTag.create(ctx as any, []) as any;
    visitor['JSONObjectExpression:exit']?.({
      type: 'JSONObjectExpression',
      parent: { type: 'JSONProgram' },
    });
    // Assert
    expect(ctx.__reports).toHaveLength(1);
    const fixFn = ctx.__reports[0].fix as (f: any) => any;
    const res = fixFn({
      replaceTextRange: (_r: any[], txt: string) => ({ text: txt }),
    });
    expect(typeof res.text).toBe('string');
  });
});
