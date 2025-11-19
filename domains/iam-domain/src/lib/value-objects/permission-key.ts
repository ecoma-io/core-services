import { ValueObject } from '@ecoma-io/domain';
import {
  PermissionKeyEmptyException,
  PermissionKeyFormatException,
  PermissionKeyLevelException,
  PermissionKeyTooLongException,
} from '../exceptions';

/**
 * PermissionKey Value Object.
 *
 * Represents a hierarchical permission key like "users:read" or "tenants:admin:write".
 */
export class PermissionKey extends ValueObject<string> {
  private constructor(key: string) {
    const normalized = key;
    super(normalized);
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
      throw new PermissionKeyEmptyException('Permission key cannot be empty');
    }

    const normalized = key.toLowerCase().trim();

    // Validate format: alphanumeric and colons only, no leading/trailing colons
    const keyRegex = /^[a-z0-9]+(?::[a-z0-9]+)*$/;
    if (!keyRegex.test(normalized)) {
      throw new PermissionKeyFormatException(
        `Invalid permission key format: ${key} (expected: resource:action)`
      );
    }

    const parts = normalized.split(':');
    if (parts.length < 2) {
      throw new PermissionKeyLevelException(
        `Permission key must have at least resource:action: ${key}`
      );
    }

    if (parts.length > 5) {
      throw new PermissionKeyLevelException(
        `Permission key cannot exceed 5 levels: ${key}`
      );
    }

    if (normalized.length > 255) {
      throw new PermissionKeyTooLongException(
        'Permission key cannot exceed 255 characters'
      );
    }

    return new PermissionKey(normalized);
  }

  /**
   * Get permission key value as string.
   */
  toString(): string {
    return this.props;
  }

  /**
   * Check if this key matches a pattern (supports wildcards).
   *
   * Example: "users:read" matches "users:*"
   */
  matches(pattern: string): boolean {
    const patternParts = pattern.split(':');
    const keyParts = this.props.split(':');

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
  equals(other?: ValueObject<string> | PermissionKey): boolean {
    return super.equals(other as ValueObject<string> | undefined);
  }

  /**
   * Get resource part (first segment).
   */
  getResource(): string {
    return this.props.split(':')[0];
  }

  /**
   * Get action part (last segment).
   */
  getAction(): string {
    const parts = this.props.split(':');
    return parts[parts.length - 1];
  }
}
