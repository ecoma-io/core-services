/**
 * Base Entity class containing an identity and equality helper.
 *
 * Entities are mutable domain objects identified by an id.
 *
 * @remarks
 * Entities provide identity-based equality and a JSON representation.
 */
export abstract class Entity<T> {
  /**
   * Underlying identifier for the entity. May be undefined when not assigned.
   */
  protected readonly _id?: T;

  /**
   * Create a new Entity.
   * @param id - Optional id to assign. If not provided the id remains undefined.
   */
  public constructor(id?: T) {
    this._id = id;
  }

  /**
   * Entity identifier.
   * @returns The entity id or undefined if not assigned.
   */
  public get id(): T | undefined {
    return this._id;
  }

  /**
   * Type guard to determine whether a value is an Entity.
   * @param value - Unknown value to test.
   * @returns True when the value is an instance of Entity.
   */
  public static isEntity(value: unknown): value is Entity<unknown> {
    return (
      typeof value === 'object' && value !== null && value instanceof Entity
    );
  }

  /**
   * Value-based equality by id.
   * @param other - Another Entity to compare with.
   * @returns True when both entities have the same defined id.
   */
  public equals(other?: Entity<T> | null): boolean {
    if (other === null || other === undefined) return false;
    if (this._id === undefined || other._id === undefined) return false;
    return this._id === other._id;
  }

  /**
   * Convert the entity to a plain JSON object.
   * @returns A plain object containing the entity id.
   */
  public toJSON(): Readonly<Record<string, unknown>> {
    return { id: this._id };
  }
}
