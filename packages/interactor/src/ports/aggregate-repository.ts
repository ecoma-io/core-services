/**
 * Repository abstraction for loading and persisting aggregates.
 *
 * @typeParam TAggregate - Aggregate root type managed by the repository.
 * @remarks
 * Implementations are responsible for retrieving aggregate state and
 * persisting changes. Expected version can be used to implement optimistic
 * concurrency control.
 */
export interface AggregateRepository<TAggregate> {
  /**
   * Load an aggregate by id.
   *
   * @param aggregateId - The aggregate identifier.
   * @returns The aggregate instance or `null` if not found.
   */
  load(aggregateId: string): Promise<TAggregate | null>;

  /**
   * Persist an aggregate's state.
   *
   * @param aggregate - The aggregate instance to persist.
   * @param expectedVersion - Optional expected version for optimistic concurrency.
   */
  save(aggregate: TAggregate, expectedVersion?: number): Promise<void>;
}
