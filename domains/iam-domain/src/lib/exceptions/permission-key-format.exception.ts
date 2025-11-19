import { PermissionKeyInvalidException } from './permission-key-invalid.exception';

export class PermissionKeyFormatException extends PermissionKeyInvalidException {
  constructor(message = 'Permission key format invalid') {
    super(message);
  }
}
