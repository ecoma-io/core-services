import { ServiceNameInvalidException } from './service-name-invalid.exception';

export class ServiceNameEmptyException extends ServiceNameInvalidException {
  constructor(message = 'Service name cannot be empty') {
    super(message);
  }
}
