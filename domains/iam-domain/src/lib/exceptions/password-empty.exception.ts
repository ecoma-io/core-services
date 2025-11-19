import { PasswordInvalidException } from './password-invalid.exception';

export class PasswordEmptyException extends PasswordInvalidException {
  constructor(message = 'Password cannot be empty') {
    super(message);
  }
}
