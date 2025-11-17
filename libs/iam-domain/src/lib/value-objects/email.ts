import { DomainException } from '@ecoma-io/domain';

/**
 * Email Value Object with validation.
 *
 * Ensures email format is valid and normalized.
 */
export class Email {
  private readonly value: string;

  private constructor(email: string) {
    this.value = email.toLowerCase().trim();
  }

  /**
   * Create Email from string with validation.
   *
   * @throws {DomainException} if email format is invalid
   */
  static create(email: string): Email {
    if (!email || email.trim().length === 0) {
      throw new DomainException('Email cannot be empty');
    }

    const normalized = email.toLowerCase().trim();

    // RFC 5322 simplified email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) {
      throw new DomainException(`Invalid email format: ${email}`);
    }

    if (normalized.length > 255) {
      throw new DomainException('Email cannot exceed 255 characters');
    }

    return new Email(normalized);
  }

  /**
   * Get email value as string.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Check equality with another Email.
   */
  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
