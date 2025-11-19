import { PhoneNumberInvalidException } from './phone-number-invalid.exception';

export class PhoneNumberEmptyException extends PhoneNumberInvalidException {
  constructor(message = 'Phone number cannot be empty') {
    super(message);
  }
}
