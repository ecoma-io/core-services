import { IntrinsicException } from '@ecoma-io/common';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

/**
 * Validates environment variables against a class definition using class-transformer and class-validator.
 * This function transforms plain environment variables into a typed class instance and validates it,
 * throwing an exception if validation fails.
 *
 * @param env - A record of environment variables as strings.
 * @param envVariablesClass - The class constructor to validate against, typically decorated with class-validator decorators.
 * @returns The validated and type-safe configuration object.
 * @throws {IntrinsicException} If validation fails, with details of the errors.
 */
export function validateConfig<T extends object>(
  env: Record<string, string>,
  envVariablesClass: ClassConstructor<T>
): T {
  if (!env || typeof env !== 'object') {
    throw new IntrinsicException(
      'Invalid environment variables: must be a non-null object'
    );
  }
  // enableImplicitConversion handles string-to-number/boolean conversion based on class property types.
  const validatedConfig = plainToInstance(envVariablesClass, env, {
    enableImplicitConversion: true,
  });

  // Validate the resulting class instance against defined decorators.
  const errors = validateSync(validatedConfig, {
    // Ensure validation runs against all properties, checking for missing values if required.
    skipMissingProperties: false,
  });

  // Handle validation errors.
  if (errors.length > 0) {
    // Throw a custom exception with detailed validation failure messages.
    throw new IntrinsicException(
      `Process environment validation failed: \n ${errors.toString()}`
    );
  }

  // Return the type-safe, validated configuration object.
  return validatedConfig;
}
