import { ServiceDefinitionAggregate } from '@ecoma-io/iam-domain';
import { EventStoreDbRepository } from '@ecoma-io/iam-infrastructure';

/**
 * ServiceDefinitionAggregateRepository - EventStoreDB repository for ServiceDefinition aggregates.
 *
 * Handles loading and saving ServiceDefinitionAggregate to/from EventStoreDB streams.
 * Stream naming: `ServiceDefinition-{serviceId}`
 */
export class ServiceDefinitionAggregateRepository {
  constructor(private readonly eventStoreRepo: EventStoreDbRepository) {}

  /**
   * Load ServiceDefinitionAggregate from EventStoreDB stream.
   *
   * @param serviceId - Service ID (used as stream name)
   * @returns Rehydrated ServiceDefinitionAggregate
   */
  async load(serviceId: string): Promise<ServiceDefinitionAggregate> {
    // Stream name is just the serviceId (same as other aggregates)
    const events = await this.eventStoreRepo.loadEvents(serviceId);

    if (!events.length) {
      throw new Error(`ServiceDefinition aggregate ${serviceId} not found`);
    }

    const aggregate = new ServiceDefinitionAggregate(serviceId);
    const lastEvent = events[events.length - 1];
    aggregate.rehydrateFromHistory(
      events,
      lastEvent.position ?? events.length - 1
    );

    return aggregate;
  }

  /**
   * Save ServiceDefinitionAggregate to EventStoreDB.
   *
   * This method is not used in the current implementation because
   * the handler uses UnitOfWork directly. Kept for interface compliance.
   *
   * @param aggregate - ServiceDefinitionAggregate with uncommitted events
   * @returns Object with streamVersion
   */
  async save(
    aggregate: ServiceDefinitionAggregate
  ): Promise<{ streamVersion: number }> {
    const events = Array.from(aggregate.uncommittedEvents);

    if (events.length === 0) {
      return { streamVersion: aggregate.version };
    }

    // Get serviceId from first event's aggregateId
    const serviceId = events[0].aggregateId;
    if (!serviceId) {
      throw new Error(
        'ServiceDefinition aggregate must have serviceId in event'
      );
    }

    // Stream name is just the serviceId
    // Determine expectedVersion for optimistic locking
    const expectedVersion =
      aggregate.version === 0 ? -1 : aggregate.version - 1;

    // Save events to EventStoreDB
    await this.eventStoreRepo.saveEvents(serviceId, events, expectedVersion);

    // Return new stream version (0-based indexing)
    return { streamVersion: aggregate.version + events.length - 1 };
  }
}
