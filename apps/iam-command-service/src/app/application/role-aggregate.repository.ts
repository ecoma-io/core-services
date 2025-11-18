import { IAggregateRepository } from '@ecoma-io/interactor';
import { RoleAggregate } from '@ecoma-io/iam-domain';
import { EventStoreDbRepository } from '@ecoma-io/iam-infrastructure';

export class RoleAggregateRepository
  implements IAggregateRepository<RoleAggregate>
{
  constructor(private readonly eventStore: EventStoreDbRepository) {}

  async load(aggregateId: string): Promise<RoleAggregate | null> {
    const events = await this.eventStore.loadEvents(aggregateId);
    if (!events.length) return null;

    const agg = new RoleAggregate(aggregateId);
    const last = events[events.length - 1];
    agg.rehydrateFromHistory(events, last.position ?? events.length - 1);
    return agg;
  }

  async save(
    aggregate: RoleAggregate,
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
