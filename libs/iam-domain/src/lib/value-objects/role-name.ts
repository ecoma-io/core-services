import { DomainException } from '@ecoma-io/domain';

/**
 * RoleName Value Object.
 *
 * Represents a role name within a tenant.
 */
export class RoleName {
  private readonly value: string;

  private constructor(name: string) {
    this.value = name;
  }

  /**
   * Create RoleName from string with validation.
   *
   * @throws {DomainException} if role name is invalid
   */
  static create(name: string): RoleName {
    if (!name || name.trim().length === 0) {
      throw new DomainException('Role name cannot be empty');
    }

    const trimmed = name.trim();

    if (trimmed.length < 2) {
      throw new DomainException('Role name must be at least 2 characters');
    }

    if (trimmed.length > 100) {
      throw new DomainException('Role name cannot exceed 100 characters');
    }

    // Alphanumeric, spaces, hyphens, underscores only
    const nameRegex = /^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/;
    if (!nameRegex.test(trimmed)) {
      throw new DomainException(
        `Invalid role name format: ${name} (expected: alphanumeric, spaces, hyphens, underscores)`
      );
    }

    return new RoleName(trimmed);
  }

  /**
   * Get role name value as string.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Check equality with another RoleName.
   */
  equals(other: RoleName): boolean {
    return this.value === other.value;
  }
}
