import { DomainException } from '@ecoma-io/domain';

/**
 * PermissionKey Value Object.
 *
 * Represents a hierarchical permission key like "users:read" or "tenants:admin:write".
 */
export class PermissionKey {
  private readonly value: string;

  private constructor(key: string) {
    this.value = key;
  }

  /**
   * Create PermissionKey from string with validation.
   *
   * Format: resource:action or resource:subresource:action
   *
   * @throws {DomainException} if key format is invalid
   */
  static create(key: string): PermissionKey {
    if (!key || key.trim().length === 0) {
      throw new DomainException('Permission key cannot be empty');
    }

    const normalized = key.toLowerCase().trim();

    // Validate format: alphanumeric and colons only, no leading/trailing colons
    const keyRegex = /^[a-z0-9]+(?::[a-z0-9]+)*$/;
    if (!keyRegex.test(normalized)) {
      throw new DomainException(
        `Invalid permission key format: ${key} (expected: resource:action)`
      );
    }

    const parts = normalized.split(':');
    if (parts.length < 2) {
      throw new DomainException(
        `Permission key must have at least resource:action: ${key}`
      );
    }

    if (parts.length > 5) {
      throw new DomainException(
        `Permission key cannot exceed 5 levels: ${key}`
      );
    }

    if (normalized.length > 255) {
      throw new DomainException('Permission key cannot exceed 255 characters');
    }

    return new PermissionKey(normalized);
  }

  /**
   * Get permission key value as string.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Check if this key matches a pattern (supports wildcards).
   *
   * Example: "users:read" matches "users:*"
   */
  matches(pattern: string): boolean {
    const patternParts = pattern.split(':');
    const keyParts = this.value.split(':');

    if (patternParts.length !== keyParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] !== '*' && patternParts[i] !== keyParts[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check equality with another PermissionKey.
   */
  equals(other: PermissionKey): boolean {
    return this.value === other.value;
  }

  /**
   * Get resource part (first segment).
   */
  getResource(): string {
    return this.value.split(':')[0];
  }

  /**
   * Get action part (last segment).
   */
  getAction(): string {
    const parts = this.value.split(':');
    return parts[parts.length - 1];
  }
}
