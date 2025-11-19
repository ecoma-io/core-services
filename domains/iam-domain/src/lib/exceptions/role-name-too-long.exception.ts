import { RoleNameInvalidException } from './role-name-invalid.exception';

export class RoleNameTooLongException extends RoleNameInvalidException {
  constructor(message = 'Role name cannot exceed 100 characters') {
    super(message);
  }
}
