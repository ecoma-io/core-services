import { ValueObject } from '@ecoma-io/domain';
import {
  NamespaceEmptyException,
  NamespaceFormatException,
  NamespaceTooShortException,
  NamespaceTooLongException,
  NamespaceConsecutiveHyphensException,
  NamespaceEndsWithHyphenException,
  NamespaceReservedException,
} from '../exceptions';

/**
 * NamespaceId Value Object.
 *
 * Represents a tenant namespace (URL-safe identifier).
 */
export class NamespaceId extends ValueObject<string> {
  private constructor(namespace: string) {
    const normalized = namespace;
    super(normalized);
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
      throw new NamespaceEmptyException('Namespace cannot be empty');
    }

    const normalized = namespace.toLowerCase().trim();

    // Validate format: lowercase alphanumeric and hyphens, starts with letter
    const namespaceRegex = /^[a-z][a-z0-9-]*$/;
    if (!namespaceRegex.test(normalized)) {
      throw new NamespaceFormatException(
        `Invalid namespace format: ${namespace} (expected: lowercase, starts with letter, alphanumeric and hyphens only)`
      );
    }

    if (normalized.length < 3) {
      throw new NamespaceTooShortException(
        'Namespace must be at least 3 characters'
      );
    }

    if (normalized.length > 63) {
      throw new NamespaceTooLongException(
        'Namespace cannot exceed 63 characters'
      );
    }

    // No consecutive hyphens
    if (normalized.includes('--')) {
      throw new NamespaceConsecutiveHyphensException(
        'Namespace cannot contain consecutive hyphens'
      );
    }

    // Cannot end with hyphen
    if (normalized.endsWith('-')) {
      throw new NamespaceEndsWithHyphenException(
        'Namespace cannot end with hyphen'
      );
    }

    // Reserved namespaces
    const reserved = ['admin', 'api', 'www', 'app', 'system', 'public'];
    if (reserved.includes(normalized)) {
      throw new NamespaceReservedException(
        `Namespace "${normalized}" is reserved`
      );
    }

    return new NamespaceId(normalized);
  }

  /**
   * Get namespace value as string.
   */
  toString(): string {
    return this.props;
  }

  /**
   * Check equality with another NamespaceId.
   */
  equals(other?: ValueObject<string> | NamespaceId): boolean {
    return super.equals(other as ValueObject<string> | undefined);
  }
}
