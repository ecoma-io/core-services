import { IntrinsicException } from '@ecoma-io/common';

export class DomainException extends IntrinsicException {
  // Flag để dễ dàng kiểm tra "instanceof DomainException" ở Interactor
  public readonly isDomainException = true;

  constructor(message: string) {
    super(message);
  }
}
