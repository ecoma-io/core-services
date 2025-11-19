import { PermissionKey } from './permission-key';
import {
  PermissionKeyEmptyException,
  PermissionKeyFormatException,
  PermissionKeyLevelException,
} from '../exceptions';

describe('PermissionKey', () => {
  test('creates and provides resource/action parts', () => {
    // Arrange
    const raw = 'Users:Read';

    // Act
    const key = PermissionKey.create(raw);

    // Assert
    expect(key.toString()).toBe('users:read');
    expect(key.getResource()).toBe('users');
    expect(key.getAction()).toBe('read');
    expect(key.matches('users:*')).toBe(true);
    expect(key.matches('users:read')).toBe(true);
    expect(key.matches('admin:*')).toBe(false);
  });

  test('throws PermissionKeyEmptyException when empty', () => {
    // Arrange
    const raw = '';

    // Act & Assert
    try {
      PermissionKey.create(raw);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PermissionKeyEmptyException);
    }
  });

  test('throws PermissionKeyFormatException for bad format', () => {
    // Arrange
    const raw = 'users::read';

    // Act & Assert
    try {
      PermissionKey.create(raw);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PermissionKeyFormatException);
    }
  });

  test('throws PermissionKeyLevelException for too few or too many parts', () => {
    // too few
    try {
      PermissionKey.create('users');
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PermissionKeyLevelException);
    }

    // too many
    try {
      PermissionKey.create('a:b:c:d:e:f');
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PermissionKeyLevelException);
    }
  });
});
