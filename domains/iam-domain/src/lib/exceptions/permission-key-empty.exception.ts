import { PermissionKeyInvalidException } from './permission-key-invalid.exception';

export class PermissionKeyEmptyException extends PermissionKeyInvalidException {
  constructor(message = 'Permission key cannot be empty') {
    super(message);
  }
}
