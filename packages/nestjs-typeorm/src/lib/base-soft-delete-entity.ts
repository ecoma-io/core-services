import {
  ID,
  SoftDeleteEntity,
  SoftDeleteTimestampedEntity,
} from '@ecoma-io/common';
import { BaseEntity } from './base-entity';
import { Column, UpdateDateColumn } from 'typeorm';

/**
 * Abstract base class for entities that support soft deletion.
 * Extends {@link BaseEntity} and implements {@link SoftDeleteEntity}.
 * Provides a `deletedAt` column to track soft deletion timestamps.
 *
 * @template TID - The type of the entity's ID, defaults to `undefined`.
 */
export abstract class BaseSoftDeleteEntity<
    TID extends ID | undefined = undefined,
  >
  extends BaseEntity<TID>
  implements SoftDeleteEntity<TID>
{
  /**
   * Timestamp indicating when the entity was soft deleted.
   * Nullable to allow for non-deleted entities.
   */
  @Column({ type: 'timestamp', nullable: true })
  deletedAt!: Date | null;
}

/**
 * Abstract base class for timestamped entities that support soft deletion.
 * Extends {@link BaseSoftDeleteEntity} and implements {@link SoftDeleteTimestampedEntity}.
 * Adds an `updatedAt` column for tracking update timestamps.
 *
 * @template TID - The type of the entity's ID, defaults to `undefined`.
 */
export abstract class BaseSoftDeleteTimestampedEntity<
    TID extends ID | undefined = undefined,
  >
  extends BaseSoftDeleteEntity<TID>
  implements SoftDeleteTimestampedEntity<TID>
{
  /**
   * Timestamp indicating when the entity was last updated.
   * Automatically managed by TypeORM's `@UpdateDateColumn`.
   */
  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
