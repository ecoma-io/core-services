import { deepEqual } from '@ecoma-io/common';

/**
 * Base Value Object providing structural equality semantics.
 *
 * @remarks
 * Value objects should be immutable. The constructor freezes the provided props
 * to discourage mutation. Equality is performed using a deep equality helper.
 */
export abstract class ValueObject<T> {
  protected readonly props: T;

  /**
   * Create a new ValueObject.
   * @param props - The immutable properties of the value object.
   */
  public constructor(props: T) {
    this.props = Object.freeze(props);
  }

  /**
   * Structural equality comparison.
   * @param vo - Another value object to compare with.
   * @returns True when the structures are deeply equal.
   */
  public equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) return false;
    // Use the public `toJSON` to obtain a plain copy of the other VO's props
    const other = vo.toJSON();
    if (other === undefined) return false;
    return deepEqual(this.props, other as unknown as T);
  }

  /**
   * Convert to a plain object copy.
   * @returns A shallow copy of the props.
   */
  public toJSON(): T {
    return { ...this.props } as T;
  }
}
