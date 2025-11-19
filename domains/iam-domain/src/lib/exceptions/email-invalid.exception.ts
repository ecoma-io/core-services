import { DomainException } from '@ecoma-io/domain';

export class EmailInvalidException extends DomainException {
  constructor(message = 'Invalid email') {
    super(message);
  }
}
