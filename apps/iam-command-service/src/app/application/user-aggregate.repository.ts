import { IAggregateRepository } from '@ecoma-io/interactor';
import { UserAggregate } from '@ecoma-io/iam-domain';
import { EventStoreDbRepository } from '@ecoma-io/iam-infrastructure';

/**
 * Aggregate repository for UserAggregate backed by EventStoreDB.
 * Loads history and rehydrates aggregate; save delegates to EventStoreDB.
 */
export class UserAggregateRepository
  implements IAggregateRepository<UserAggregate>
{
  constructor(private readonly eventStore: EventStoreDbRepository) {}

  async load(aggregateId: string): Promise<UserAggregate | null> {
    const events = await this.eventStore.loadEvents(aggregateId);
    if (!events.length) return null;

    const agg = new UserAggregate(aggregateId);
    // Rehydrate and set current version to last event position
    const last = events[events.length - 1];
    agg.rehydrateFromHistory(events, last.position ?? events.length - 1);
    return agg;
  }

  async save(
    aggregate: UserAggregate,
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
