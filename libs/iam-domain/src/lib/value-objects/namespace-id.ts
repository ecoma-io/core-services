import { DomainException } from '@ecoma-io/domain';

/**
 * NamespaceId Value Object.
 *
 * Represents a tenant namespace (URL-safe identifier).
 */
export class NamespaceId {
  private readonly value: string;

  private constructor(namespace: string) {
    this.value = namespace;
  }

  /**
   * Create NamespaceId from string with validation.
   *
   * Format: lowercase alphanumeric and hyphens, starts with letter.
   *
   * @throws {DomainException} if namespace format is invalid
   */
  static create(namespace: string): NamespaceId {
    if (!namespace || namespace.trim().length === 0) {
      throw new DomainException('Namespace cannot be empty');
    }

    const normalized = namespace.toLowerCase().trim();

    // Validate format: lowercase alphanumeric and hyphens, starts with letter
    const namespaceRegex = /^[a-z][a-z0-9-]*$/;
    if (!namespaceRegex.test(normalized)) {
      throw new DomainException(
        `Invalid namespace format: ${namespace} (expected: lowercase, starts with letter, alphanumeric and hyphens only)`
      );
    }

    if (normalized.length < 3) {
      throw new DomainException('Namespace must be at least 3 characters');
    }

    if (normalized.length > 63) {
      throw new DomainException('Namespace cannot exceed 63 characters');
    }

    // No consecutive hyphens
    if (normalized.includes('--')) {
      throw new DomainException('Namespace cannot contain consecutive hyphens');
    }

    // Cannot end with hyphen
    if (normalized.endsWith('-')) {
      throw new DomainException('Namespace cannot end with hyphen');
    }

    // Reserved namespaces
    const reserved = ['admin', 'api', 'www', 'app', 'system', 'public'];
    if (reserved.includes(normalized)) {
      throw new DomainException(`Namespace "${normalized}" is reserved`);
    }

    return new NamespaceId(normalized);
  }

  /**
   * Get namespace value as string.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Check equality with another NamespaceId.
   */
  equals(other: NamespaceId): boolean {
    return this.value === other.value;
  }
}
