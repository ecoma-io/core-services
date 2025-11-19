import { EmailInvalidException } from './email-invalid.exception';

export class EmailEmptyException extends EmailInvalidException {
  constructor(message = 'Email cannot be empty') {
    super(message);
  }
}
