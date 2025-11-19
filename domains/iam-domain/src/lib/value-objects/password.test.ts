import { Password } from './password';
import {
  PasswordEmptyException,
  PasswordTooShortException,
  PasswordWeakException,
  PasswordHashEmptyException,
} from '../exceptions';

describe('Password', () => {
  test('creates from plaintext and verifies', () => {
    // Arrange
    const plain = 'Aa1!aaaa';

    // Act
    const pw = Password.createFromPlaintext(plain);

    // Assert
    expect(pw.verify(plain)).toBe(true);
    expect(pw.toHash().length).toBeGreaterThan(0);
  });

  test('createFromHash and verify works', () => {
    // Arrange
    const plain = 'Aa1!bbbb';
    const created = Password.createFromPlaintext(plain);

    // Act
    const fromHash = Password.createFromHash(created.toHash());

    // Assert
    expect(fromHash.verify(plain)).toBe(true);
  });

  test('verify returns false for wrong plaintext', () => {
    // Arrange
    const plain = 'Aa1!cccc';
    const pw = Password.createFromPlaintext(plain);

    // Act & Assert
    expect(pw.verify('wrongpassword')).toBe(false);
  });

  test('throws PasswordEmptyException when empty', () => {
    // Arrange
    const empty = '';

    // Act & Assert
    try {
      Password.createFromPlaintext(empty);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PasswordEmptyException);
    }
  });

  test('throws PasswordTooShortException for short password', () => {
    // Arrange
    const short = 'Aa1!a';

    // Act & Assert
    try {
      Password.createFromPlaintext(short);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PasswordTooShortException);
    }
  });

  test('throws PasswordWeakException for weak password', () => {
    // Arrange
    const weak = 'aaaaaaaa';

    // Act & Assert
    try {
      Password.createFromPlaintext(weak);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PasswordWeakException);
    }
  });

  test('throws PasswordHashEmptyException when creating from empty hash', () => {
    // Arrange
    const emptyHash = '';

    // Act & Assert
    try {
      Password.createFromHash(emptyHash);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PasswordHashEmptyException);
    }
  });
});
