import { PasswordInvalidException } from './password-invalid.exception';

export class PasswordWeakException extends PasswordInvalidException {
  constructor(message = 'Password too weak') {
    super(message);
  }
}
