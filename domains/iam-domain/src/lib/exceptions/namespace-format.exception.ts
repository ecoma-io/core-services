import { NamespaceInvalidException } from './namespace-invalid.exception';

export class NamespaceFormatException extends NamespaceInvalidException {
  constructor(message = 'Namespace format invalid') {
    super(message);
  }
}
