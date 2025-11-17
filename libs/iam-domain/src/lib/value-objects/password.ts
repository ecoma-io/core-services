import { DomainException } from '@ecoma-io/domain';
import * as crypto from 'crypto';

/**
 * Password Value Object with hashing and validation.
 *
 * Never stores plaintext passwords.
 */
export class Password {
  private readonly hashedValue: string;

  private constructor(hashed: string) {
    this.hashedValue = hashed;
  }

  /**
   * Create Password from plaintext with validation and hashing.
   *
   * @throws {DomainException} if password doesn't meet requirements
   */
  static createFromPlaintext(plaintext: string): Password {
    if (!plaintext || plaintext.length === 0) {
      throw new DomainException('Password cannot be empty');
    }

    if (plaintext.length < 8) {
      throw new DomainException('Password must be at least 8 characters');
    }

    if (plaintext.length > 128) {
      throw new DomainException('Password cannot exceed 128 characters');
    }

    // Validate password strength (at least 3 of 4 character types)
    const hasLower = /[a-z]/.test(plaintext);
    const hasUpper = /[A-Z]/.test(plaintext);
    const hasDigit = /[0-9]/.test(plaintext);
    const hasSpecial = /[^a-zA-Z0-9]/.test(plaintext);

    const strengthScore = [hasLower, hasUpper, hasDigit, hasSpecial].filter(
      Boolean
    ).length;

    if (strengthScore < 3) {
      throw new DomainException(
        'Password must contain at least 3 of: lowercase, uppercase, digit, special character'
      );
    }

    // Hash password with SHA-256 (in production, use bcrypt or argon2)
    const hashed = crypto.createHash('sha256').update(plaintext).digest('hex');

    return new Password(hashed);
  }

  /**
   * Create Password from already-hashed value.
   *
   * Use this when loading from storage.
   */
  static createFromHash(hashed: string): Password {
    if (!hashed || hashed.length === 0) {
      throw new DomainException('Password hash cannot be empty');
    }

    return new Password(hashed);
  }

  /**
   * Verify plaintext password against this hash.
   */
  verify(plaintext: string): boolean {
    const hashed = crypto.createHash('sha256').update(plaintext).digest('hex');
    return hashed === this.hashedValue;
  }

  /**
   * Get hashed value (for storage).
   */
  toHash(): string {
    return this.hashedValue;
  }

  /**
   * Check equality with another Password.
   */
  equals(other: Password): boolean {
    return this.hashedValue === other.hashedValue;
  }
}
