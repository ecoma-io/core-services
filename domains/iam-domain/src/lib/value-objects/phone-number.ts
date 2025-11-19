import { ValueObject } from '@ecoma-io/domain';
import {
  PhoneNumberEmptyException,
  PhoneNumberFormatException,
} from '../exceptions';

/**
 * PhoneNumber Value Object with international format validation.
 *
 * Uses E.164 format: +[country code][number]
 */
export class PhoneNumber extends ValueObject<string> {
  private constructor(phoneNumber: string) {
    const normalized = phoneNumber;
    super(normalized);
  }

  /**
   * Create PhoneNumber from string with E.164 validation.
   *
   * @throws {DomainException} if phone number format is invalid
   */
  static create(phoneNumber: string): PhoneNumber {
    if (!phoneNumber || phoneNumber.trim().length === 0) {
      throw new PhoneNumberEmptyException('Phone number cannot be empty');
    }

    const normalized = phoneNumber.trim();

    // E.164 format: +[1-3 digit country code][up to 15 digits total]
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(normalized)) {
      throw new PhoneNumberFormatException(
        `Invalid phone number format (E.164 required): ${phoneNumber}`
      );
    }

    return new PhoneNumber(normalized);
  }

  /**
   * Get phone number value as string.
   */
  toString(): string {
    return this.props;
  }

  /**
   * Check equality with another PhoneNumber.
   */
  equals(other?: ValueObject<string> | PhoneNumber): boolean {
    return super.equals(other as ValueObject<string> | undefined);
  }
}
