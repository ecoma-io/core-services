import { IntrinsicException } from '@ecoma-io/common';

/**
 * Base class for adapter-specific exceptions.
 *
 * @remarks
 * Adapter exceptions extend the repository/framework-level `IntrinsicException`
 * and expose a marker flag for easy runtime checks (e.g. `instanceof`).
 */
export abstract class AdapterException extends IntrinsicException {
  /**
   * Marker flag to allow runtime checks that this is an adapter-level exception.
   */
  public readonly isAdapterException = true;

  /**
   * Create a new AdapterException.
   * @param message - Human readable error message.
   */
  constructor(message: string) {
    super(message);
  }
}
