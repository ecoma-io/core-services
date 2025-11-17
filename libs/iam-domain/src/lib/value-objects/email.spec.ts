import { Email } from './email';
import { DomainException } from '@ecoma-io/domain';

describe('Email Value Object', () => {
  describe('create', () => {
    it('should create valid email', () => {
      // Arrange & Act
      const email = Email.create('user@example.com');

      // Assert
      expect(email.toString()).toBe('user@example.com');
    });

    it('should normalize email to lowercase', () => {
      // Arrange & Act
      const email = Email.create('User@Example.COM');

      // Assert
      expect(email.toString()).toBe('user@example.com');
    });

    it('should trim whitespace', () => {
      // Arrange & Act
      const email = Email.create('  user@example.com  ');

      // Assert
      expect(email.toString()).toBe('user@example.com');
    });

    it('should throw on empty email', () => {
      // Arrange & Act & Assert
      expect(() => Email.create('')).toThrow(DomainException);
      expect(() => Email.create('   ')).toThrow(DomainException);
    });

    it('should throw on invalid email format', () => {
      // Arrange & Act & Assert
      expect(() => Email.create('invalid')).toThrow(DomainException);
      expect(() => Email.create('@example.com')).toThrow(DomainException);
      expect(() => Email.create('user@')).toThrow(DomainException);
      expect(() => Email.create('user@example')).toThrow(DomainException);
    });

    it('should throw on email exceeding 255 characters', () => {
      // Arrange
      const longEmail = 'a'.repeat(250) + '@example.com';

      // Act & Assert
      expect(() => Email.create(longEmail)).toThrow(DomainException);
    });
  });

  describe('equals', () => {
    it('should return true for equal emails', () => {
      // Arrange
      const email1 = Email.create('user@example.com');
      const email2 = Email.create('USER@example.com');

      // Act & Assert
      expect(email1.equals(email2)).toBe(true);
    });

    it('should return false for different emails', () => {
      // Arrange
      const email1 = Email.create('user1@example.com');
      const email2 = Email.create('user2@example.com');

      // Act & Assert
      expect(email1.equals(email2)).toBe(false);
    });
  });
});
