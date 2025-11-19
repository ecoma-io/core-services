import { ServiceNameInvalidException } from './service-name-invalid.exception';

export class ServiceNameFormatException extends ServiceNameInvalidException {
  constructor(message = 'Invalid service name format') {
    super(message);
  }
}
