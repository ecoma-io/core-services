import { NamespaceInvalidException } from './namespace-invalid.exception';

export class NamespaceConsecutiveHyphensException extends NamespaceInvalidException {
  constructor(message = 'Namespace cannot contain consecutive hyphens') {
    super(message);
  }
}
