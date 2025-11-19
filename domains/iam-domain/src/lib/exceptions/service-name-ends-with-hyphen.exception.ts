import { ServiceNameInvalidException } from './service-name-invalid.exception';

export class ServiceNameEndsWithHyphenException extends ServiceNameInvalidException {
  constructor(message = 'Service name cannot end with hyphen') {
    super(message);
  }
}
