import { ServiceNameInvalidException } from './service-name-invalid.exception';

export class ServiceNameTooShortException extends ServiceNameInvalidException {
  constructor(message = 'Service name must be at least 3 characters') {
    super(message);
  }
}
