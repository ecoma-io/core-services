import { EmailInvalidException } from './email-invalid.exception';

export class EmailPatternException extends EmailInvalidException {
  constructor(message = 'Email pattern invalid') {
    super(message);
  }
}
