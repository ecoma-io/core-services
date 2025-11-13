import { ID } from '../utils';
import { Entity } from './entity.interface';

/**
 * Represents an entity with timestamp information.
 * Extends the base Entity interface to include an update timestamp.
 * @template TID - The type of the entity ID, defaults to undefined if not specified.
 */
export interface TimestampedEntity<TID extends ID | undefined = undefined>
  extends Entity<TID> {
  /**
   * The date and time when the entity was last updated.
   */
  updatedAt: Date;
}
