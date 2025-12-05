import { MaybeAsync } from '@ecoma-io/common';
import { IQuery } from './query';

/**
 * Handler responsible for executing a `IQuery` and returning results.
 *
 * @typeParam Q - Concrete query type handled by the implementation.
 * @typeParam R - Result type returned by the handler.
 * @remarks
 * Query handlers should be side-effect free when possible and return data
 * without mutating domain state.
 */
export interface IQueryHandler<Q extends IQuery, R> {
  /**
   * Execute the provided query and return a result.
   *
   * @param query - The query to execute.
   * @returns A possibly-async result containing the query response.
   */
  execute(query: Q): MaybeAsync<R>;
}
