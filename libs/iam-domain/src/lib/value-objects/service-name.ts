import { DomainException } from '@ecoma-io/domain';

/**
 * ServiceName Value Object.
 *
 * Represents a service identifier in the permission registry.
 */
export class ServiceName {
  private readonly value: string;

  private constructor(name: string) {
    this.value = name;
  }

  /**
   * Create ServiceName from string with validation.
   *
   * Format: lowercase alphanumeric and hyphens.
   *
   * @throws {DomainException} if service name is invalid
   */
  static create(name: string): ServiceName {
    if (!name || name.trim().length === 0) {
      throw new DomainException('Service name cannot be empty');
    }

    const normalized = name.toLowerCase().trim();

    // Validate format: lowercase alphanumeric and hyphens
    const nameRegex = /^[a-z][a-z0-9-]*$/;
    if (!nameRegex.test(normalized)) {
      throw new DomainException(
        `Invalid service name format: ${name} (expected: lowercase, alphanumeric and hyphens)`
      );
    }

    if (normalized.length < 3) {
      throw new DomainException('Service name must be at least 3 characters');
    }

    if (normalized.length > 50) {
      throw new DomainException('Service name cannot exceed 50 characters');
    }

    // No consecutive hyphens
    if (normalized.includes('--')) {
      throw new DomainException(
        'Service name cannot contain consecutive hyphens'
      );
    }

    // Cannot end with hyphen
    if (normalized.endsWith('-')) {
      throw new DomainException('Service name cannot end with hyphen');
    }

    return new ServiceName(normalized);
  }

  /**
   * Get service name value as string.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Check equality with another ServiceName.
   */
  equals(other: ServiceName): boolean {
    return this.value === other.value;
  }
}
