import { NamespaceInvalidException } from './namespace-invalid.exception';

export class NamespaceTooLongException extends NamespaceInvalidException {
  constructor(message = 'Namespace cannot exceed 63 characters') {
    super(message);
  }
}
