import { PhoneNumber } from './phone-number';
import {
  PhoneNumberEmptyException,
  PhoneNumberFormatException,
} from '../exceptions';

describe('PhoneNumber', () => {
  test('creates a valid E.164 phone number', () => {
    // Arrange
    const raw = '+12345678901';

    // Act
    const pn = PhoneNumber.create(raw);

    // Assert
    expect(pn.toString()).toBe('+12345678901');
  });

  test('throws PhoneNumberEmptyException when empty', () => {
    // Arrange
    const raw = '';

    // Act & Assert
    try {
      PhoneNumber.create(raw);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PhoneNumberEmptyException);
    }
  });

  test('throws PhoneNumberFormatException for invalid format', () => {
    // Arrange
    const bad = '12345';

    // Act & Assert
    try {
      PhoneNumber.create(bad);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PhoneNumberFormatException);
    }
  });
});
