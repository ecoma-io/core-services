import { ValueObject } from '@ecoma-io/domain';
import {
  ServiceNameEmptyException,
  ServiceNameFormatException,
  ServiceNameTooShortException,
  ServiceNameTooLongException,
  ServiceNameConsecutiveHyphensException,
  ServiceNameEndsWithHyphenException,
} from '../exceptions';

/**
 * ServiceName Value Object.
 *
 * Represents a service identifier in the permission registry.
 */
export class ServiceName extends ValueObject<string> {
  private constructor(name: string) {
    const normalized = name;
    super(normalized);
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
      throw new ServiceNameEmptyException('Service name cannot be empty');
    }

    const normalized = name.toLowerCase().trim();

    // Validate format: lowercase alphanumeric and hyphens
    const nameRegex = /^[a-z][a-z0-9-]*$/;
    if (!nameRegex.test(normalized)) {
      throw new ServiceNameFormatException(
        `Invalid service name format: ${name} (expected: lowercase, alphanumeric and hyphens)`
      );
    }

    if (normalized.length < 3) {
      throw new ServiceNameTooShortException(
        'Service name must be at least 3 characters'
      );
    }

    if (normalized.length > 50) {
      throw new ServiceNameTooLongException(
        'Service name cannot exceed 50 characters'
      );
    }

    // No consecutive hyphens
    if (normalized.includes('--')) {
      throw new ServiceNameConsecutiveHyphensException(
        'Service name cannot contain consecutive hyphens'
      );
    }

    // Cannot end with hyphen
    if (normalized.endsWith('-')) {
      throw new ServiceNameEndsWithHyphenException(
        'Service name cannot end with hyphen'
      );
    }

    return new ServiceName(normalized);
  }

  /**
   * Get service name value as string.
   */
  toString(): string {
    return this.props;
  }

  /**
   * Check equality with another ServiceName.
   */
  equals(other?: ValueObject<string> | ServiceName): boolean {
    return super.equals(other as ValueObject<string> | undefined);
  }
}
