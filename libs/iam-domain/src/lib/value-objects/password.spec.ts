import { Password } from './password';
import { DomainException } from '@ecoma-io/domain';

describe('Password Value Object', () => {
  describe('createFromPlaintext', () => {
    it('should create valid password', () => {
      // Arrange & Act
      const password = Password.createFromPlaintext('StrongP@ss123');

      // Assert
      expect(password).toBeDefined();
      expect(password.toHash()).toBeDefined();
    });

    it('should hash password', () => {
      // Arrange & Act
      const password = Password.createFromPlaintext('StrongP@ss123');

      // Assert
      expect(password.toHash()).not.toBe('StrongP@ss123');
      expect(password.toHash().length).toBe(64); // SHA-256 hex
    });

    it('should throw on empty password', () => {
      // Arrange & Act & Assert
      expect(() => Password.createFromPlaintext('')).toThrow(DomainException);
    });

    it('should throw on password less than 8 characters', () => {
      // Arrange & Act & Assert
      expect(() => Password.createFromPlaintext('Short1!')).toThrow(
        DomainException
      );
    });

    it('should throw on password exceeding 128 characters', () => {
      // Arrange
      const longPassword = 'A1@' + 'a'.repeat(126);

      // Act & Assert
      expect(() => Password.createFromPlaintext(longPassword)).toThrow(
        DomainException
      );
    });

    it('should throw on weak password (less than 3 character types)', () => {
      // Arrange & Act & Assert
      expect(() => Password.createFromPlaintext('alllowercase')).toThrow(
        DomainException
      );
      expect(() => Password.createFromPlaintext('ALLUPPERCASE')).toThrow(
        DomainException
      );
      expect(() => Password.createFromPlaintext('12345678')).toThrow(
        DomainException
      );
      expect(() => Password.createFromPlaintext('lowercase123')).toThrow(
        DomainException
      );
    });

    it('should accept password with 3 character types', () => {
      // Arrange & Act & Assert
      expect(() => Password.createFromPlaintext('LowerUpper123')).not.toThrow();
      expect(() => Password.createFromPlaintext('Lower123!@#')).not.toThrow();
      expect(() => Password.createFromPlaintext('UPPER123!@#')).not.toThrow();
    });

    it('should accept password with all 4 character types', () => {
      // Arrange & Act & Assert
      expect(() =>
        Password.createFromPlaintext('Strong@Pass123')
      ).not.toThrow();
    });
  });

  describe('verify', () => {
    it('should verify correct password', () => {
      // Arrange
      const plaintext = 'StrongP@ss123';
      const password = Password.createFromPlaintext(plaintext);

      // Act & Assert
      expect(password.verify(plaintext)).toBe(true);
    });

    it('should reject incorrect password', () => {
      // Arrange
      const password = Password.createFromPlaintext('StrongP@ss123');

      // Act & Assert
      expect(password.verify('WrongPassword')).toBe(false);
    });
  });

  describe('createFromHash', () => {
    it('should create password from hash', () => {
      // Arrange
      const hash =
        'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3';

      // Act
      const password = Password.createFromHash(hash);

      // Assert
      expect(password.toHash()).toBe(hash);
    });

    it('should throw on empty hash', () => {
      // Arrange & Act & Assert
      expect(() => Password.createFromHash('')).toThrow(DomainException);
    });
  });

  describe('equals', () => {
    it('should return true for equal passwords', () => {
      // Arrange
      const password1 = Password.createFromPlaintext('StrongP@ss123');
      const password2 = Password.createFromPlaintext('StrongP@ss123');

      // Act & Assert
      expect(password1.equals(password2)).toBe(true);
    });

    it('should return false for different passwords', () => {
      // Arrange
      const password1 = Password.createFromPlaintext('StrongP@ss123');
      const password2 = Password.createFromPlaintext('Different@123');

      // Act & Assert
      expect(password1.equals(password2)).toBe(false);
    });
  });
});
