import { ID } from '../utils';
import { Entity } from './entity.interface';
import { TimestampedEntity } from './timestamped-entity.interface';
/**
 * @description Interface for entities that support soft deletion.
 * @remarks This interface extends `Entity<TID>` and adds an optional `deletedAt` field to mark entities as deleted without physically removing them from the database. The `deletedAt` field can be a `Date` or `null`.
 * @template TID - The type of the entity's ID, extending `ID | undefined`.
 */
export interface SoftDeleteEntity<TID extends ID | undefined = undefined> extends Entity<TID> {
    /**
     * The date and time when the entity was soft deleted, or null if not deleted.
     */
    deletedAt: Date | null;
}
/**
 * @description Interface combining soft delete and timestamped entity features.
 * @remarks Extends both `SoftDeleteEntity<TID>` and `TimestampedEntity<TID>` for entities that require creation and update timestamps along with soft delete capability.
 * @template TID - The type of the entity's ID, extending `ID | undefined`.
 */
export interface SoftDeleteTimestampedEntity<TID extends ID | undefined = undefined> extends SoftDeleteEntity<TID>, TimestampedEntity<TID> {
}
