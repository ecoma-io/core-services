import { EmailInvalidException } from './email-invalid.exception';

export class EmailTooLongException extends EmailInvalidException {
  constructor(message = 'Email too long') {
    super(message);
  }
}
