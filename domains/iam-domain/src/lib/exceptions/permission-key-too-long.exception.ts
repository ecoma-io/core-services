import { PermissionKeyInvalidException } from './permission-key-invalid.exception';

export class PermissionKeyTooLongException extends PermissionKeyInvalidException {
  constructor(message = 'Permission key cannot exceed 255 characters') {
    super(message);
  }
}
