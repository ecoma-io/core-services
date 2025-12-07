import { HttpStatus } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { validationPipeOptions } from './validation-pipe.options';

// --- CUSTOM DEPENDENCY MOCKING ---

jest.mock('../exceptions', () => {
  /**
   * Simplified Mock of UnprocessableEntityException, inheriting directly from Error.
   * This structure is designed solely to capture the arguments passed to the constructor.
   * @template T - The type of the validation payload.
   */
  class MockUnprocessableEntityException<T> extends Error {
    /** Public property to store the validation payload for test assertions. */
    public validationPayload: T | undefined;
    /** Public property to store additional data for test assertions. */
    public data: unknown | undefined;
    /** Private property to store the initial message argument for assertion purposes. */
    public _initialMessage: string | undefined;

    /**
     * Constructs a new MockUnprocessableEntityException.
     * @param {string | undefined} message - The error message.
     * @param {T} errors - The validation errors payload.
     * @param {unknown | undefined} data - Additional data or metadata.
     */
    constructor(
      message: string | undefined,
      errors: T,
      data: unknown | undefined
    ) {
      // Call parent Error constructor with a default message (Error.message must be a string)
      super(message || 'Validation Failed');

      // Store the initial 'message' argument for assertion purposes
      // (Used to check if 'undefined' was passed)
      this._initialMessage = message;

      this.validationPayload = errors;
      this.data = data;
    }
  }

  // Export the mock class under the original name
  return { UnprocessableEntityException: MockUnprocessableEntityException };
});

// Re-import the Mock Class after it has been defined by jest.mock()
import { UnprocessableEntityException } from '../exceptions';
// --- END MOCK ---

/**
 * Test suite for ValidationPipe Configuration (validationPipeOptions).
 * Verifies the configuration options and exception factory behavior.
 */
describe('validationPipe Configuration (validationPipeOptions)', () => {
  // Type definition for the MockException instance
  type MockException = InstanceType<typeof UnprocessableEntityException> & {
    _initialMessage?: string;
    validationPayload?: unknown;
    data?: unknown;
  };

  // Mock validation error data for test cases
  const mockValidationErrors: ValidationError[] = [
    {
      property: 'username',
      constraints: {
        isString: 'username must be a string',
        minLength: 'username must be longer than 5 characters',
      },
    },
    {
      property: 'age',
      constraints: {
        isNumber: 'age must be a number',
        max: 'age must not exceed 100',
      },
    },
    {
      property: 'tags',
      constraints: undefined,
    },
  ];

  /**
   * Test case to verify the base ValidationPipe configuration options.
   */
  it('should have the correct base ValidationPipe configuration options', () => {
    // Arrange: No setup needed as we're testing static configuration.
    // Act: Access the configuration properties.
    // Assert: Verify each property matches expected values.
    expect(validationPipeOptions.transform).toBe(true);
    expect(validationPipeOptions.whitelist).toBe(true);
    expect(validationPipeOptions.errorHttpStatusCode).toBe(
      HttpStatus.UNPROCESSABLE_ENTITY
    );
    expect(
      validationPipeOptions.transformOptions?.enableImplicitConversion
    ).toBe(true);
  });

  /**
   * Test suite for the exceptionFactory function within validationPipeOptions.
   */
  describe('exceptionFactory', () => {
    // [FIX] Extract the potentially undefined function and assert its existence
    // to resolve the 'no-non-null-assertion' lint error.
    const factory = validationPipeOptions.exceptionFactory;

    if (!factory) {
      throw new Error(
        'exceptionFactory is missing from validationPipeOptions, tests cannot run.'
      );
    }

    /**
     * Test case to verify that exceptionFactory returns an instance of UnprocessableEntityException.
     */
    it('should return an instance of UnprocessableEntityException', () => {
      // Arrange: Use the extracted factory function.
      // Act: Call the factory with mock validation errors.
      const exception = factory(mockValidationErrors);
      // Assert: Verify the exception is an instance of the expected class.
      expect(exception).toBeInstanceOf(UnprocessableEntityException);
    });

    /**
     * Test case to verify the correctly formatted error payload using generateErrors.
     */
    it('should create the correctly formatted error payload (using generateErrors)', () => {
      // Arrange: Use the extracted factory function and expected payload.
      const expectedErrorsPayload = {
        // Two constraints joined
        username:
          'username must be a string, username must be longer than 5 characters',
        // Two constraints joined
        age: 'age must be a number, age must not exceed 100',
        // constraints: undefined => empty string
        tags: '',
      };
      // Act: Call the factory with mock validation errors.
      const exception = factory(mockValidationErrors) as MockException;
      // Assert: Verify the saved error payload matches expected.
      expect(exception.validationPayload).toStrictEqual(expectedErrorsPayload);
    });

    /**
     * Test case to verify that exceptionFactory is called with "undefined" arguments for data.
     */
    it('should be called with "undefined" arguments for data', () => {
      // Arrange: Use the extracted factory function.
      // Act: Call the factory with mock validation errors.
      const exception = factory(mockValidationErrors) as MockException;
      // Assert: Check the (data) are undefined.
      expect(exception.data).toBeUndefined();
    });

    /**
     * Test case to verify handling of errors with only a single constraint.
     */
    it('should handle errors with only a single constraint', () => {
      // Arrange: Define single error and expected payload.
      const singleError: ValidationError[] = [
        {
          property: 'title',
          constraints: { isNotEmpty: 'title cannot be empty' },
        },
      ];
      const expectedErrorsPayload = {
        title: 'title cannot be empty',
      };
      // Act: Call the factory with single error.
      const exception = factory(singleError) as MockException;
      // Assert: Verify the saved error payload matches expected.
      expect(exception.validationPayload).toStrictEqual(expectedErrorsPayload);
    });
  });
});
