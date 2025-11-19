import { NamespaceInvalidException } from './namespace-invalid.exception';

export class NamespaceTooShortException extends NamespaceInvalidException {
  constructor(message = 'Namespace must be at least 3 characters') {
    super(message);
  }
}
