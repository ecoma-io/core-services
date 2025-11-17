import { v7 as uuidv7 } from 'uuid';

/**
 * Base Entity class containing an identity and equality helper.
 *
 * Entities are mutable domain objects identified by an id.
 */
export abstract class Entity<ID = string> {
  protected _id: ID;

  constructor(id?: ID) {
    // default to uuidv4 when consumer does not provide an id and ID is string
    if (id !== undefined) {
      this._id = id;
    } else {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore allow fallback to uuidv4 for string IDs
      this._id = uuidv7() as unknown as ID;
    }
  }

  get id(): ID {
    return this._id;
  }

  /**
   * Value-based equality by id.
   */
  equals(other?: Entity<ID>): boolean {
    if (!other) return false;
    return this._id === other._id;
  }

  toJSON(): Record<string, unknown> {
    return { id: this._id };
  }
}
