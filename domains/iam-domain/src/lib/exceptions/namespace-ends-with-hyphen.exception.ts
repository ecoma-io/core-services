import { NamespaceInvalidException } from './namespace-invalid.exception';

export class NamespaceEndsWithHyphenException extends NamespaceInvalidException {
  constructor(message = 'Namespace cannot end with hyphen') {
    super(message);
  }
}
