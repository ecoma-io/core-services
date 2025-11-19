import { RoleName } from './role-name';
import {
  RoleNameEmptyException,
  RoleNameTooShortException,
  RoleNameFormatException,
} from '../exceptions';

describe('RoleName', () => {
  test('creates and trims a valid role name', () => {
    // Arrange
    const raw = '  Admin Role  ';

    // Act
    const rn = RoleName.create(raw);

    // Assert
    expect(rn.toString()).toBe('Admin Role');
  });

  test('throws RoleNameEmptyException when empty', () => {
    // Arrange
    const raw = '';

    // Act & Assert
    try {
      RoleName.create(raw);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(RoleNameEmptyException);
    }
  });

  test('throws RoleNameTooShortException when too short', () => {
    // Arrange
    const raw = 'A';

    // Act & Assert
    try {
      RoleName.create(raw);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(RoleNameTooShortException);
    }
  });

  test('throws RoleNameFormatException for invalid chars', () => {
    // Arrange
    const raw = '!admin';

    // Act & Assert
    try {
      RoleName.create(raw);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(RoleNameFormatException);
    }
  });
});
