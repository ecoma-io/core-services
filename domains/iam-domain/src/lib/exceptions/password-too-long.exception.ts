import { PasswordInvalidException } from './password-invalid.exception';

export class PasswordTooLongException extends PasswordInvalidException {
  constructor(message = 'Password cannot exceed 128 characters') {
    super(message);
  }
}
