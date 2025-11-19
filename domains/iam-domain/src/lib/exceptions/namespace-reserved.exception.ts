import { NamespaceInvalidException } from './namespace-invalid.exception';

export class NamespaceReservedException extends NamespaceInvalidException {
  constructor(message = 'Namespace is reserved') {
    super(message);
  }
}
