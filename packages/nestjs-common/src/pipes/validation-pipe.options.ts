import { HttpStatus, ValidationPipeOptions } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { UnprocessableEntityException } from '../exceptions';

/**
 * Helper function to transform an array of NestJS/class-validator errors
 * into a flattened key-value object (Record<string, string>).
 * This makes the error response cleaner and easier for the frontend to consume.
 *
 * @param errors The array of ValidationError objects.
 * @returns A record where the key is the field name and the value is a
 * comma-separated string of validation messages for that field.
 */
function generateErrors(errors: ValidationError[]): Record<string, string> {
  return errors.reduce(
    (accumulator, currentValue) => ({
      ...accumulator,
      // Use the property name as the key
      [currentValue.property]: Object.values(
        // Extract all constraint messages and join them into a single string
        currentValue.constraints ?? {}
      ).join(', '),
    }),
    {} as Record<string, string>
  );
}

/**
 * Configuration options for the global NestJS ValidationPipe.
 */
export const validationPipeOptions: ValidationPipeOptions = {
  // Enables automatic type conversion for incoming request data (e.g., strings to numbers/booleans).
  transform: true,
  transformOptions: {
    // Allows automatic conversion of primitive types based on the DTO property type.
    enableImplicitConversion: true,
  },
  // Strips any properties from the request body/query/params that are NOT defined in the DTO.
  // This is a crucial security feature (prevents unexpected/malicious fields from reaching the application).
  whitelist: true,
  // Forces the HTTP status code for all validation failures to 422 Unprocessable Entity.
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,

  /**
   * Custom function used to create the exception thrown upon validation failure.
   * This overrides the default 400 Bad Request exception behavior.
   *
   * @param errors The array of validation errors from class-validator.
   * @returns A custom exception instance.
   */
  exceptionFactory: (errors: ValidationError[]) => {
    // Instantiate a custom exception with the generated, flattened error object.
    return new UnprocessableEntityException<Record<string, string>>(
      'Validation Failed',
      generateErrors(errors), // The structured error payload
      undefined
    );
  },
};
