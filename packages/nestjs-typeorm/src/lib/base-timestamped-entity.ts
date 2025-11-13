import { ID, TimestampedEntity } from '@ecoma-io/common';
import { UpdateDateColumn } from 'typeorm';
import { BaseEntity } from './base-entity';

/**
 * Abstract base class for entities that require timestamp tracking.
 * Extends {@link BaseEntity} and implements {@link TimestampedEntity} to provide an `updatedAt` field.
 * @template TID - The type of the entity's ID, constrained to {@link ID} or `undefined`.
 */
export abstract class BaseTimestampedEntity<
    TID extends ID | undefined = undefined,
  >
  extends BaseEntity<TID>
  implements TimestampedEntity<TID>
{
  /**
   * The timestamp when the entity was last updated.
   * Automatically managed by TypeORM's {@link UpdateDateColumn} decorator.
   */
  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
