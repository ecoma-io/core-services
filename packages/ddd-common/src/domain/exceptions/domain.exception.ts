import { IntrinsicException } from '@ecoma-io/common';

/**
 * Base class for domain-specific exceptions.
 *
 * @remarks
 * Domain exceptions extend the repository/framework-level `IntrinsicException`
 * and expose a marker flag for easy runtime checks (e.g. `instanceof`).
 */
export abstract class DomainException extends IntrinsicException {
  /**
   * Marker flag to allow runtime checks that this is a domain-level exception.
   */
  public readonly isDomainException = true;

  /**
   * Create a new DomainException.
   * @param message - Human readable error message.
   */
  constructor(message: string) {
    super(message);
  }
}
