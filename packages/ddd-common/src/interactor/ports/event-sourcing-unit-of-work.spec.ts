import { IEventSourcingUnitOfWork } from './event-sourcing-unit-of-work';
import { DomainEvent } from '../../domain';

class InMemoryESUoW implements IEventSourcingUnitOfWork {
  private versions = new Map<string, number>();

  async commit(
    aggregateId: string,
    events: ReadonlyArray<DomainEvent>,
    expectedVersion?: number
  ): Promise<number> {
    const current = this.versions.get(aggregateId) ?? 0;
    if (expectedVersion !== undefined && expectedVersion !== current) {
      throw new Error('version mismatch');
    }

    const next = current + events.length;
    this.versions.set(aggregateId, next);
    return next;
  }
}

describe('EventSourcingUnitOfWork (in-memory)', () => {
  it('increments version by number of events', async () => {
    const uow = new InMemoryESUoW();
    const events = [{ type: 'x' } as unknown as DomainEvent];
    const v = await uow.commit('agg1', events);
    expect(v).toBe(1);
    const v2 = await uow.commit('agg1', events);
    expect(v2).toBe(2);
  });

  it('honours expectedVersion', async () => {
    const uow = new InMemoryESUoW();
    const events = [{ type: 'x' } as unknown as DomainEvent];
    await uow.commit('agg2', events);
    await expect(uow.commit('agg2', events, 1)).resolves.toBe(2);
    await expect(uow.commit('agg2', events, 0)).rejects.toThrow(
      'version mismatch'
    );
  });
});
