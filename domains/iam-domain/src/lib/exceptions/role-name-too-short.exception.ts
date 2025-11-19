import { RoleNameInvalidException } from './role-name-invalid.exception';

export class RoleNameTooShortException extends RoleNameInvalidException {
  constructor(message = 'Role name must be at least 2 characters') {
    super(message);
  }
}
