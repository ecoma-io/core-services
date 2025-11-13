import { ID } from '../utils';

/**
 * Represents a basic entity with a creation timestamp.
 * @description This interface defines the structure for entities that have an optional unique identifier and a mandatory creation date.
 * @template TID The type of the entity's ID, defaults to undefined if no ID is present.
 */
export interface Entity<TID extends ID | undefined = undefined> {
  /**
   * The unique identifier of the entity.
   * @description A unique value that identifies the entity instance, or undefined if not yet assigned.
   */
  id?: TID;
  /**
   * The date and time when the entity was created.
   * @description Represents the timestamp of entity creation, stored as a Date object.
   */
  createdAt: Date;
}
