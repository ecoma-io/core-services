import { NamespaceInvalidException } from './namespace-invalid.exception';

export class NamespaceEmptyException extends NamespaceInvalidException {
  constructor(message = 'Namespace cannot be empty') {
    super(message);
  }
}
