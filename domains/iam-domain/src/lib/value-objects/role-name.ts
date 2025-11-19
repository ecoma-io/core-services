import { ValueObject } from '@ecoma-io/domain';
import {
  RoleNameEmptyException,
  RoleNameTooShortException,
  RoleNameTooLongException,
  RoleNameFormatException,
} from '../exceptions';

/**
 * RoleName Value Object.
 *
 * Represents a role name within a tenant.
 */
export class RoleName extends ValueObject<string> {
  private constructor(name: string) {
    const normalized = name;
    super(normalized);
  }

  /**
   * Create RoleName from string with validation.
   *
   * @throws {DomainException} if role name is invalid
   */
  static create(name: string): RoleName {
    if (!name || name.trim().length === 0) {
      throw new RoleNameEmptyException('Role name cannot be empty');
    }

    const trimmed = name.trim();

    if (trimmed.length < 2) {
      throw new RoleNameTooShortException(
        'Role name must be at least 2 characters'
      );
    }

    if (trimmed.length > 100) {
      throw new RoleNameTooLongException(
        'Role name cannot exceed 100 characters'
      );
    }

    // Alphanumeric, spaces, hyphens, underscores only
    const nameRegex = /^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/;
    if (!nameRegex.test(trimmed)) {
      throw new RoleNameFormatException(
        `Invalid role name format: ${name} (expected: alphanumeric, spaces, hyphens, underscores)`
      );
    }

    return new RoleName(trimmed);
  }

  /**
   * Get role name value as string.
   */
  toString(): string {
    return this.props;
  }

  /**
   * Check equality with another RoleName.
   */
  equals(other?: ValueObject<string> | RoleName): boolean {
    return super.equals(other as ValueObject<string> | undefined);
  }
}
