/**
 * Unit of Work abstraction for transactional operations.
 *
 * @remarks
 * Implementations coordinate commit/rollback for a set of operations.
 */
export interface IUnitOfWork {
  /**
   * Commit all changes within the unit of work.
   * @returns A promise that resolves when commit completes.
   */
  commit(): Promise<void>;

  /**
   * Roll back changes within the unit of work.
   * @returns A promise that resolves when rollback completes.
   */
  rollback(): Promise<void>;
}
