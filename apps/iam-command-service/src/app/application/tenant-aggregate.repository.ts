import { IAggregateRepository } from '@ecoma-io/interactor';
import { TenantAggregate } from '@ecoma-io/iam-domain';
import { EventStoreDbRepository } from '@ecoma-io/iam-infrastructure';

export class TenantAggregateRepository
  implements IAggregateRepository<TenantAggregate>
{
  constructor(private readonly eventStore: EventStoreDbRepository) {}

  async load(aggregateId: string): Promise<TenantAggregate | null> {
    const events = await this.eventStore.loadEvents(aggregateId);
    if (!events.length) return null;

    const agg = new TenantAggregate(aggregateId);
    const last = events[events.length - 1];
    agg.rehydrateFromHistory(events, last.position ?? events.length - 1);
    return agg;
  }

  async save(
    aggregate: TenantAggregate,
    expectedVersion?: number
  ): Promise<void> {
    const events = Array.from(aggregate.uncommittedEvents);
    if (!events.length) return;
    await this.eventStore.saveEvents(
      (events[0]?.aggregateId as string) || '',
      events,
      expectedVersion
    );
    aggregate.clearUncommittedEvents();
  }
}
