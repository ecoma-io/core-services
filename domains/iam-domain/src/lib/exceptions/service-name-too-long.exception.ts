import { ServiceNameInvalidException } from './service-name-invalid.exception';

export class ServiceNameTooLongException extends ServiceNameInvalidException {
  constructor(message = 'Service name cannot exceed 50 characters') {
    super(message);
  }
}
