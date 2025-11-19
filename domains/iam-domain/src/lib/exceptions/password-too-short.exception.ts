import { PasswordInvalidException } from './password-invalid.exception';

export class PasswordTooShortException extends PasswordInvalidException {
  constructor(message = 'Password must be at least 8 characters') {
    super(message);
  }
}
