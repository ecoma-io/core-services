import { Email } from './email';
import {
  EmailEmptyException,
  EmailPatternException,
  EmailTooLongException,
} from '../exceptions';

describe('Email', () => {
  test('creates and normalizes a valid email', () => {
    // Arrange
    const raw = '  User@Example.COM  ';

    // Act
    const email = Email.create(raw);

    // Assert
    expect(email.toString()).toBe('user@example.com');
  });

  test('throws EmailEmptyException when empty', () => {
    // Arrange
    const raw = '   ';

    // Act & Assert
    try {
      Email.create(raw);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EmailEmptyException);
    }
  });

  test('throws EmailPatternException for invalid format', () => {
    // Arrange
    const bad = 'not-an-email';

    // Act & Assert
    try {
      Email.create(bad);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EmailPatternException);
    }
  });

  test('throws EmailTooLongException for overly long email', () => {
    // Arrange
    const local = 'a'.repeat(250);
    const long = `${local}@x.com`;

    // Act & Assert
    try {
      Email.create(long);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EmailTooLongException);
    }
  });
});
