import { IntrinsicException } from '@ecoma-io/common';

export class InteractorException extends IntrinsicException {
  public readonly isInteractorException = true;

  constructor(message: string) {
    super(message);
  }
}
