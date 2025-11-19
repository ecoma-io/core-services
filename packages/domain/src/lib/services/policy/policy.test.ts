import { andPolicies, orPolicies, IPolicy, PolicyDecision } from './policy';

describe('policy combinators', () => {
  const allowPolicy = (reason?: string): IPolicy<number> => ({
    evaluate: (ctx: number) => ({ allowed: true, reason }),
  });

  const denyPolicy = (reason?: string): IPolicy<number> => ({
    evaluate: (ctx: number) => ({ allowed: false, reason }),
  });

  test('andPolicies returns allowed when all policies allow', async () => {
    const p = andPolicies([allowPolicy(), allowPolicy('a')]);
    const d = await p.evaluate(1);
    expect(d.allowed).toBe(true);
  });

  test('andPolicies short-circuits on first deny and returns that decision', async () => {
    const first = denyPolicy('first-deny');
    const second = allowPolicy('second-allow');
    const p = andPolicies([first, second]);
    const d = await p.evaluate(2);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('first-deny');
  });

  test('orPolicies returns allowed when any policy allows', async () => {
    const p = orPolicies([denyPolicy('d1'), allowPolicy('ok')]);
    const d = await p.evaluate(3);
    expect(d.allowed).toBe(true);
    expect(d.reason).toBe('ok');
  });

  test('orPolicies returns last denial reason when none allow', async () => {
    const p = orPolicies([denyPolicy('d1'), denyPolicy('d2')]);
    const d = await p.evaluate(4);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('d2');
  });

  test('combinators work with async policies', async () => {
    const asyncAllow: IPolicy<number> = {
      evaluate: async (c) => ({ allowed: c > 0 }),
    };
    const p = andPolicies([asyncAllow, allowPolicy()]);
    const d = await p.evaluate(1);
    expect(d.allowed).toBe(true);
  });
});
