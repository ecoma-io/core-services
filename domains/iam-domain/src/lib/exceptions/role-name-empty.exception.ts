import { RoleNameInvalidException } from './role-name-invalid.exception';

export class RoleNameEmptyException extends RoleNameInvalidException {
  constructor(message = 'Role name cannot be empty') {
    super(message);
  }
}
