import { NamespaceId } from './namespace-id';
import { DomainException } from '@ecoma-io/domain';

describe('NamespaceId Value Object', () => {
  describe('create', () => {
    it('should create valid namespace', () => {
      // Arrange & Act
      const namespace = NamespaceId.create('my-company');

      // Assert
      expect(namespace.toString()).toBe('my-company');
    });

    it('should normalize to lowercase', () => {
      // Arrange & Act
      const namespace = NamespaceId.create('My-Company');

      // Assert
      expect(namespace.toString()).toBe('my-company');
    });

    it('should accept alphanumeric and hyphens', () => {
      // Arrange & Act & Assert
      expect(() => NamespaceId.create('abc123')).not.toThrow();
      expect(() => NamespaceId.create('my-company-2024')).not.toThrow();
    });

    it('should throw on empty namespace', () => {
      // Arrange & Act & Assert
      expect(() => NamespaceId.create('')).toThrow(DomainException);
    });

    it('should throw on invalid format', () => {
      // Arrange & Act & Assert
      expect(() => NamespaceId.create('123abc')).toThrow(DomainException); // must start with letter
      expect(() => NamespaceId.create('my_company')).toThrow(DomainException); // no underscores
      expect(() => NamespaceId.create('my company')).toThrow(DomainException); // no spaces
      expect(() => NamespaceId.create('my.company')).toThrow(DomainException); // no dots
    });

    it('should throw on namespace less than 3 characters', () => {
      // Arrange & Act & Assert
      expect(() => NamespaceId.create('ab')).toThrow(DomainException);
    });

    it('should throw on namespace exceeding 63 characters', () => {
      // Arrange
      const longNamespace = 'a' + 'b'.repeat(63);

      // Act & Assert
      expect(() => NamespaceId.create(longNamespace)).toThrow(DomainException);
    });

    it('should throw on consecutive hyphens', () => {
      // Arrange & Act & Assert
      expect(() => NamespaceId.create('my--company')).toThrow(DomainException);
    });

    it('should throw on ending with hyphen', () => {
      // Arrange & Act & Assert
      expect(() => NamespaceId.create('my-company-')).toThrow(DomainException);
    });

    it('should throw on reserved namespaces', () => {
      // Arrange & Act & Assert
      expect(() => NamespaceId.create('admin')).toThrow(DomainException);
      expect(() => NamespaceId.create('api')).toThrow(DomainException);
      expect(() => NamespaceId.create('www')).toThrow(DomainException);
      expect(() => NamespaceId.create('app')).toThrow(DomainException);
      expect(() => NamespaceId.create('system')).toThrow(DomainException);
      expect(() => NamespaceId.create('public')).toThrow(DomainException);
    });
  });

  describe('equals', () => {
    it('should return true for equal namespaces', () => {
      // Arrange
      const ns1 = NamespaceId.create('my-company');
      const ns2 = NamespaceId.create('MY-COMPANY');

      // Act & Assert
      expect(ns1.equals(ns2)).toBe(true);
    });

    it('should return false for different namespaces', () => {
      // Arrange
      const ns1 = NamespaceId.create('company-a');
      const ns2 = NamespaceId.create('company-b');

      // Act & Assert
      expect(ns1.equals(ns2)).toBe(false);
    });
  });
});
