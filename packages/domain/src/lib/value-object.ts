export abstract class ValueObject<T> {
  protected readonly props: T;

  constructor(props: T) {
    this.props = Object.freeze(props); // Ensure immutability
  }

  // Method for structural equality comparison
  public equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }
    if (vo.props === undefined) {
      return false;
    }
    return JSON.stringify(this.props) === JSON.stringify(vo.props); // Simple comparison, can be more sophisticated
  }

  // Optional: Method to get a copy of the props (still immutable)
  public toJSON(): T {
    return { ...this.props };
  }
}
