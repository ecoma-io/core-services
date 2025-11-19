import { NamespaceId } from './namespace-id';
import {
  NamespaceEmptyException,
  NamespaceFormatException,
  NamespaceTooShortException,
  NamespaceConsecutiveHyphensException,
  NamespaceReservedException,
} from '../exceptions';

describe('NamespaceId', () => {
  test('creates and normalizes a valid namespace', () => {
    // Arrange
    const raw = '  My-Tenant  ';

    // Act
    const ns = NamespaceId.create(raw);

    // Assert
    expect(ns.toString()).toBe('my-tenant');
  });

  test('throws NamespaceEmptyException when empty', () => {
    // Arrange
    const raw = '';

    // Act & Assert
    try {
      NamespaceId.create(raw);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(NamespaceEmptyException);
    }
  });

  test('throws NamespaceFormatException when does not start with letter', () => {
    // Arrange
    const raw = '1abc';

    // Act & Assert
    try {
      NamespaceId.create(raw);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(NamespaceFormatException);
    }
  });

  test('throws NamespaceTooShortException for too short', () => {
    // Arrange
    const raw = 'ab';

    // Act & Assert
    try {
      NamespaceId.create(raw);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(NamespaceTooShortException);
    }
  });

  test('throws NamespaceConsecutiveHyphensException for consecutive hyphens', () => {
    // Arrange
    const raw = 'ab--cd';

    // Act & Assert
    try {
      NamespaceId.create(raw);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(NamespaceConsecutiveHyphensException);
    }
  });

  test('throws NamespaceReservedException for reserved namespace', () => {
    // Arrange
    const raw = 'admin';

    // Act & Assert
    try {
      NamespaceId.create(raw);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(NamespaceReservedException);
    }
  });
});
