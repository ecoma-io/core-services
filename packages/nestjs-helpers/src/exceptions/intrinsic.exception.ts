/**
 * Base class for exception objects used by this library.
 * Extends the built-in Error to ensure instances have a consistent `name`.
 */
export class IntrinsicException extends Error {
  /**
   * Construct a new IntrinsicException.
   * @param message - {string | undefined} Optional error message.
   */
  constructor(message?: string) {
    super(message);
    this.initName();
  }

  /**
   * Initialize the `name` property to the concrete class name.
   * @remarks Protected so subclasses can call or override when necessary.
   */
  protected initName(): void {
    this.name = this.constructor.name;
  }
}
