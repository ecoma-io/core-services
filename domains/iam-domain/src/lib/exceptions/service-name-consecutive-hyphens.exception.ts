import { ServiceNameInvalidException } from './service-name-invalid.exception';

export class ServiceNameConsecutiveHyphensException extends ServiceNameInvalidException {
  constructor(message = 'Service name cannot contain consecutive hyphens') {
    super(message);
  }
}
