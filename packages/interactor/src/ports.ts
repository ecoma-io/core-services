import { DomainEventEnvelope } from '@ecoma-io/domain';

export interface IAggregateRepository<TAggregate> {
  load(aggregateId: string): Promise<TAggregate | null>;
  save(aggregate: TAggregate, expectedVersion?: number): Promise<void>;
}

export interface IUnitOfWork {
  /**
   * Persist events and publish them atomically from application perspective.
   * Implementations handle EventStore + Publisher coordination.
   */
  commit(
    aggregateId: string,
    events: DomainEventEnvelope[],
    expectedVersion?: number
  ): Promise<number>;
}

export interface IReadModelRepository<T> {
  findById(id: string): Promise<T | null>;
  search(query: string): Promise<T[]>;
}
