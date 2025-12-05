/**
 * Repository for read-model (projection) access.
 *
 * @typeParam T - Type of the read-model stored by the repository.
 */
export interface IReadModelRepository<T> {
  /**
   * Find a read model by identifier.
   *
   * @param id - Unique identifier of the read model.
   * @returns The read model or `null` if not found.
   */
  findById(id: string): Promise<T | null>;

  /**
   * Search read models using a simple query string.
   *
   * @param query - Free-text search or filter criteria (implementation-defined).
   * @returns An array of matching read models.
   */
  search(query: string): Promise<T[]>;
}
