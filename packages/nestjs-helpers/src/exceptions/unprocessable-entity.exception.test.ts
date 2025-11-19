import { HttpStatus } from '@nestjs/common';
import { UnprocessableEntityException } from './unprocessable-entity.exception';

describe('UnprocessableEntityException', () => {
  it('should create an exception with message, details, and metadata (happy path)', () => {
    // Arrange: Define test inputs for a standard exception creation.
    const message = 'Validation failed';
    const details = { field: 'email', reason: 'invalid format' };
    const metadata = { timestamp: '2023-10-01T00:00:00Z' };

    // Act: Instantiate the exception with the provided parameters.
    const exception = new UnprocessableEntityException(
      message,
      details,
      metadata
    );

    // Assert: Verify the exception has the correct status and response structure.
    expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(exception.getResponse()).toEqual({
      message,
      details,
      metadata,
    });
  });

  it('should create an exception with only message (edge case: details and metadata undefined)', () => {
    // Arrange: Define test inputs with only message, others undefined.
    const message = 'Invalid data provided';

    // Act: Instantiate the exception with minimal parameters.
    const exception = new UnprocessableEntityException(message);

    // Assert: Verify the exception has the correct status and response with undefined details and metadata.
    expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(exception.getResponse()).toEqual({
      message,
      details: undefined,
      metadata: undefined,
    });
  });

  it('should create an exception with empty message (edge case: empty string)', () => {
    // Arrange: Define test inputs with an empty message.
    const message = '';
    const details = null;
    const metadata = {};
    // Act: Instantiate the exception with empty message and null details.
    const exception = new UnprocessableEntityException(
      message,
      details,
      metadata
    );

    // Assert: Verify the exception preserves the provided empty message.
    expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(exception.getResponse()).toEqual({
      message,
      details,
      metadata,
    });
  });

  it('should create an exception with options (edge case: options provided)', () => {
    // Arrange: Define test inputs including options.
    const message = 'Processing error';
    const details = { errorCode: 422 };
    const metadata = { userId: 123 };
    const cause = new Error('Underlying cause');

    // Act: Instantiate the exception with a direct cause value.
    const exception = new UnprocessableEntityException(
      message,
      details,
      metadata,
      cause
    );

    // Assert: Verify the exception has the correct status, response, and cause is passed.
    expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(exception.getResponse()).toEqual({ message, details, metadata });
    expect(exception.cause).toBe(cause);
  });

  // No-argument construction is not supported because a message is required by the constructor.
});
