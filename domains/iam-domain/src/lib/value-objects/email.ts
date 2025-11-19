import { ValueObject } from '@ecoma-io/domain';
import {
  EmailEmptyException,
  EmailPatternException,
  EmailTooLongException,
} from '../exceptions';

/**
 * Email Value Object with validation.
 *
 * Ensures email format is valid and normalized.
 */
export class Email extends ValueObject<string> {
  private constructor(email: string) {
    const normalized = email.toLowerCase().trim();
    super(normalized);
  }

  /**
   * Create Email from string with validation.
   *
   * @throws {DomainException} if email format is invalid
   */
  static create(email: string): Email {
    if (!email || email.trim().length === 0) {
      throw new EmailEmptyException('Email cannot be empty');
    }

    const normalized = email.toLowerCase().trim();

    // RFC 5322 simplified email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) {
      throw new EmailPatternException(`Invalid email format: ${email}`);
    }

    if (normalized.length > 255) {
      throw new EmailTooLongException('Email cannot exceed 255 characters');
    }

    return new Email(normalized);
  }

  /**
   * Get email value as string.
   */
  toString(): string {
    return this.props;
  }

  /**
   * Check equality with another Email.
   */
  // equals inherited from ValueObject; keep a typed overload for convenience
  equals(other?: ValueObject<string> | Email): boolean {
    return super.equals(other as ValueObject<string> | undefined);
  }
}
