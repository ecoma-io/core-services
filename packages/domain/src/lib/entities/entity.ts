import { uuidv7 } from 'uuidv7';

/**
 * Base Entity class containing an identity and equality helper.
 *
 * Entities are mutable domain objects identified by an id.
 *
 * @remarks
 * Entities provide identity-based equality and a JSON representation.
 */
export abstract class Entity {
  protected _id: string;

  /**
   * Create a new Entity.
   * @param id - Optional id to assign. If not provided a new UUIDv7 is generated.
   */
  constructor(id?: string) {
    if (id !== undefined) {
      this._id = id;
    } else {
      this._id = uuidv7();
    }
  }

  /**
   * Entity identifier.
   * @returns The entity id string.
   */
  public get id(): string {
    return this._id;
  }

  /**
   * Value-based equality by id.
   * @param other - Another Entity to compare with.
   * @returns True when both entities have the same id.
   */
  public equals(other?: Entity | null): boolean {
    if (other === null || other === undefined) return false;
    return this._id === other._id;
  }

  /**
   * Convert the entity to a plain JSON object.
   * @returns A plain object containing the entity id.
   */
  public toJSON(): Record<string, unknown> {
    return { id: this._id };
  }
}
