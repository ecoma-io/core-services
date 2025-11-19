import { RoleNameInvalidException } from './role-name-invalid.exception';

export class RoleNameFormatException extends RoleNameInvalidException {
  constructor(message = 'Role name format invalid') {
    super(message);
  }
}
