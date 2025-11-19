import { PasswordInvalidException } from './password-invalid.exception';

export class PasswordHashEmptyException extends PasswordInvalidException {
  constructor(message = 'Password hash cannot be empty') {
    super(message);
  }
}
