import { IUnitOfWork } from '@ecoma-io/interactor';
import { DomainEventEnvelope } from '@ecoma-io/domain';
import { EventStoreDbRepository } from '@ecoma-io/iam-infrastructure';
import { RabbitMQEventPublisher } from '@ecoma-io/iam-infrastructure';

/**
 * Application UnitOfWork: persists domain events to EventStoreDB then publishes to RabbitMQ.
 * Returns the resulting stream version for RYOW polling.
 */
export class AppUnitOfWork implements IUnitOfWork {
  constructor(
    private readonly eventStore: EventStoreDbRepository,
    private readonly publisher: RabbitMQEventPublisher
  ) {}

  async commit(
    aggregateId: string,
    events: DomainEventEnvelope[],
    expectedVersion?: number
  ): Promise<number> {
    if (!events || events.length === 0)
      return (await this.eventStore.loadStreamVersion(aggregateId)) ?? -1;

    // 1) Persist events
    // For new streams (expectedVersion = -1 or 0), pass -1 so ESDB maps to 'no_stream'.
    // For existing streams, subtract 1 to convert aggregate version to zero-based revision.
    const expectedRevision =
      typeof expectedVersion === 'number' && expectedVersion > 0
        ? expectedVersion - 1
        : -1; // Normalize 0, -1, undefined to -1 (new stream sentinel)
    await this.eventStore.saveEvents(aggregateId, events, expectedRevision);

    // 2) Publish events
    await this.publisher.publish(events);

    // 3) Return latest version
    const version = await this.eventStore.loadStreamVersion(aggregateId);
    return version ?? -1;
  }
}
