import { IntrinsicException } from '@ecoma-io/common';

/**
 * Base exception type for interactor layer errors.
 *
 * Use this as the parent for all interactor-specific exceptions so callers
 * can reliably detect and handle them via the provided type guard.
 */
export abstract class InteractorException extends IntrinsicException {
  /**
   * Marker used by the type guard to identify interactor exceptions.
   */
  public readonly isInteractorException = true;

  /**
   * Create a new InteractorException.
   *
   * @param message - Human readable error message
   */
  constructor(message: string) {
    super(message);
    // Ensure the error name reflects the concrete class for clearer logs/traces
    this.name = this.constructor.name;
  }

  /**
   * Type guard to narrow unknown values to InteractorException.
   *
   * @param value - The unknown value to test.
   * @returns true if the value is an InteractorException
   */
  public static isInteractorException(
    value: unknown
  ): value is InteractorException {
    if (value === null || typeof value !== 'object') {
      return false;
    }

    const record = value as Record<string, unknown>;
    return record.isInteractorException === true;
  }
}
