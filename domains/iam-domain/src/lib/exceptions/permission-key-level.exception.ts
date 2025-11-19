import { PermissionKeyInvalidException } from './permission-key-invalid.exception';

export class PermissionKeyLevelException extends PermissionKeyInvalidException {
  constructor(message = 'Permission key level invalid') {
    super(message);
  }
}
