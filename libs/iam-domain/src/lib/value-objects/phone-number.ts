import { DomainException } from '@ecoma-io/domain';

/**
 * PhoneNumber Value Object with international format validation.
 *
 * Uses E.164 format: +[country code][number]
 */
export class PhoneNumber {
  private readonly value: string;

  private constructor(phoneNumber: string) {
    this.value = phoneNumber;
  }

  /**
   * Create PhoneNumber from string with E.164 validation.
   *
   * @throws {DomainException} if phone number format is invalid
   */
  static create(phoneNumber: string): PhoneNumber {
    if (!phoneNumber || phoneNumber.trim().length === 0) {
      throw new DomainException('Phone number cannot be empty');
    }

    const normalized = phoneNumber.trim();

    // E.164 format: +[1-3 digit country code][up to 15 digits total]
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(normalized)) {
      throw new DomainException(
        `Invalid phone number format (E.164 required): ${phoneNumber}`
      );
    }

    return new PhoneNumber(normalized);
  }

  /**
   * Get phone number value as string.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Check equality with another PhoneNumber.
   */
  equals(other: PhoneNumber): boolean {
    return this.value === other.value;
  }
}
