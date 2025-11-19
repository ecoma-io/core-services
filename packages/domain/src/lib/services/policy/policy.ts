/**
 * Generic Policy / Rule evaluator primitives.
 *
 * @remarks
 * Policies are stateless, pure functions or objects that evaluate context and
 * return a decision. They are useful to model domain rules that are not
 * naturally part of an Aggregate.
 */
export type PolicyDecision = { allowed: boolean; reason?: string };

/**
 * Generic policy interface.
 */
export interface IPolicy<TContext = unknown> {
  evaluate(ctx: TContext): PolicyDecision | Promise<PolicyDecision>;
}

/**
 * Combine multiple policies in AND fashion: all must allow.
 */
export function andPolicies<T>(policies: Array<IPolicy<T>>): IPolicy<T> {
  return {
    async evaluate(ctx: T) {
      for (const p of policies) {
        const d = await p.evaluate(ctx);
        if (!d.allowed) return d;
      }
      return { allowed: true };
    },
  };
}

/**
 * Combine multiple policies in OR fashion: any allow.
 */
export function orPolicies<T>(policies: Array<IPolicy<T>>): IPolicy<T> {
  return {
    async evaluate(ctx: T) {
      let last: PolicyDecision = {
        allowed: false,
        reason: 'no policy allowed',
      };
      for (const p of policies) {
        const d = await p.evaluate(ctx);
        if (d.allowed) return d;
        last = d;
      }
      return last;
    },
  };
}
