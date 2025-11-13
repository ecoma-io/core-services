import { Entity, ID } from '@ecoma-io/common';
import { CreateDateColumn } from 'typeorm';

/**
 * @remarks Abstract base class for database entities, providing common fields like creation timestamp.
 * @typeparam TID The type of the entity's ID, which must extend ID or be undefined.
 */
export abstract class BaseEntity<TID extends ID | undefined = undefined>
  implements Entity<TID>
{
  /**
   * @remarks The date and time when the entity was created, automatically managed by TypeORM.
   */
  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
