/**
 * Base class for exception objects used by this library.
 *
 * Extends the built-in Error to ensure instances have a consistent `name`
 * and to preserve the prototype chain when targeting ES5/ES2015 environments.
 */
export class IntrinsicException extends Error {
  /**
   * Marker property used for type-guarding arbitrary values.
   * Marked readonly to prevent mutation.
   */
  public readonly isIntrinsicException = true;

  /**
   * Construct a new IntrinsicException.
   * @param message - Optional error message.
   */
  constructor(message?: string) {
    message = message || '';
    super(message);
    // Restore prototype chain for proper instanceof checks in transpiled targets.
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture a proper stack trace when available (V8).
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }

    this.initName();
  }

  /**
   * Initialize the `name` property to the concrete class name.
   * Protected so subclasses can call or override when necessary.
   */
  protected initName(): void {
    // Fall back to a stable name if constructor name is unavailable.
    this.name =
      (this.constructor && this.constructor.name) || 'IntrinsicException';
  }
}
