import { AggregateRepository } from './aggregate-repository';

type Agg = { id: string; value: number };

class InMemoryAggregateRepository implements AggregateRepository<Agg> {
  private store = new Map<string, Agg>();

  async load(aggregateId: string): Promise<Agg | null> {
    return this.store.get(aggregateId) ?? null;
  }

  async save(aggregate: Agg, _expectedVersion?: number): Promise<void> {
    this.store.set(aggregate.id, aggregate);
  }
}

describe('aggregateRepository (in-memory)', () => {
  it('saves and loads aggregates', async () => {
    const repo = new InMemoryAggregateRepository();
    const agg: Agg = { id: 'a1', value: 1 };
    await repo.save(agg);
    const loaded = await repo.load('a1');
    expect(loaded).not.toBeNull();
    expect(loaded).toStrictEqual(agg);
  });

  it('returns null for missing aggregate', async () => {
    const repo = new InMemoryAggregateRepository();
    const loaded = await repo.load('missing');
    expect(loaded).toBeNull();
  });
});
