import { PermissionKey } from './permission-key';
import { DomainException } from '@ecoma-io/domain';

describe('PermissionKey Value Object', () => {
  describe('create', () => {
    it('should create valid permission key', () => {
      // Arrange & Act
      const key = PermissionKey.create('users:read');

      // Assert
      expect(key.toString()).toBe('users:read');
    });

    it('should normalize to lowercase', () => {
      // Arrange & Act
      const key = PermissionKey.create('Users:Read');

      // Assert
      expect(key.toString()).toBe('users:read');
    });

    it('should accept multi-level keys', () => {
      // Arrange & Act
      const key = PermissionKey.create('tenants:admin:write');

      // Assert
      expect(key.toString()).toBe('tenants:admin:write');
    });

    it('should throw on empty key', () => {
      // Arrange & Act & Assert
      expect(() => PermissionKey.create('')).toThrow(DomainException);
    });

    it('should throw on invalid format', () => {
      // Arrange & Act & Assert
      expect(() => PermissionKey.create('invalid')).toThrow(DomainException);
      expect(() => PermissionKey.create(':read')).toThrow(DomainException);
      expect(() => PermissionKey.create('users:')).toThrow(DomainException);
      expect(() => PermissionKey.create('users::read')).toThrow(
        DomainException
      );
    });

    it('should throw on key with less than 2 parts', () => {
      // Arrange & Act & Assert
      expect(() => PermissionKey.create('users')).toThrow(DomainException);
    });

    it('should throw on key exceeding 5 levels', () => {
      // Arrange & Act & Assert
      expect(() => PermissionKey.create('a:b:c:d:e:f')).toThrow(
        DomainException
      );
    });

    it('should throw on key exceeding 255 characters', () => {
      // Arrange - create a long key that exceeds 255 chars (256 total)
      const longResource = 'a'.repeat(251);
      const longKey = `${longResource}:read`;

      // Act & Assert
      expect(() => PermissionKey.create(longKey)).toThrow(DomainException);
    });
  });

  describe('matches', () => {
    it('should match exact pattern', () => {
      // Arrange
      const key = PermissionKey.create('users:read');

      // Act & Assert
      expect(key.matches('users:read')).toBe(true);
    });

    it('should match wildcard pattern', () => {
      // Arrange
      const key = PermissionKey.create('users:read');

      // Act & Assert
      expect(key.matches('users:*')).toBe(true);
      expect(key.matches('*:read')).toBe(true);
      expect(key.matches('*:*')).toBe(true);
    });

    it('should not match different pattern', () => {
      // Arrange
      const key = PermissionKey.create('users:read');

      // Act & Assert
      expect(key.matches('users:write')).toBe(false);
      expect(key.matches('tenants:read')).toBe(false);
    });

    it('should not match pattern with different length', () => {
      // Arrange
      const key = PermissionKey.create('users:admin:read');

      // Act & Assert
      expect(key.matches('users:read')).toBe(false);
      expect(key.matches('users:*')).toBe(false);
    });
  });

  describe('getResource', () => {
    it('should return resource part', () => {
      // Arrange
      const key = PermissionKey.create('users:read');

      // Act & Assert
      expect(key.getResource()).toBe('users');
    });

    it('should return first segment for multi-level keys', () => {
      // Arrange
      const key = PermissionKey.create('tenants:admin:write');

      // Act & Assert
      expect(key.getResource()).toBe('tenants');
    });
  });

  describe('getAction', () => {
    it('should return action part', () => {
      // Arrange
      const key = PermissionKey.create('users:read');

      // Act & Assert
      expect(key.getAction()).toBe('read');
    });

    it('should return last segment for multi-level keys', () => {
      // Arrange
      const key = PermissionKey.create('tenants:admin:write');

      // Act & Assert
      expect(key.getAction()).toBe('write');
    });
  });

  describe('equals', () => {
    it('should return true for equal keys', () => {
      // Arrange
      const key1 = PermissionKey.create('users:read');
      const key2 = PermissionKey.create('USERS:READ');

      // Act & Assert
      expect(key1.equals(key2)).toBe(true);
    });

    it('should return false for different keys', () => {
      // Arrange
      const key1 = PermissionKey.create('users:read');
      const key2 = PermissionKey.create('users:write');

      // Act & Assert
      expect(key1.equals(key2)).toBe(false);
    });
  });
});
