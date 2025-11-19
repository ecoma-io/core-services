import { PhoneNumberInvalidException } from './phone-number-invalid.exception';

export class PhoneNumberFormatException extends PhoneNumberInvalidException {
  constructor(message = 'Invalid phone number format (E.164 required)') {
    super(message);
  }
}
