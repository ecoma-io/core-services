import { HttpStatus } from '@nestjs/common';
import { ConflictException } from './conflict.exception';

describe('conflictException', () => {
  it('should create an instance with message, details, and metadata', () => {
    // Arrange: Define test inputs.
    const message = 'Conflict occurred';
    const details = { field: 'name', issue: 'already exists' };
    const metadata = { timestamp: '2023-01-01' };

    // Act: Create the exception instance.
    const exception = new ConflictException(message, details, metadata);

    // Assert: Verify the status and response structure.
    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(exception.getResponse()).toStrictEqual({
      message,
      details,
      metadata,
    });
  });

  it('should create an instance with only message', () => {
    // Arrange: Define test inputs with minimal parameters.
    const message = 'Resource conflict';

    // Act: Create the exception instance.
    const exception = new ConflictException(message);

    // Assert: Verify the status and response structure.
    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(exception.getResponse()).toStrictEqual({
      message,
      details: undefined,
      metadata: undefined,
    });
  });

  // Note: constructors now require a `message` parameter; no-arg construction
  // is not supported and thus tests expecting default message are removed.

  it('should create an instance with null details and undefined metadata', () => {
    // Arrange: Define test inputs with edge case values.
    const message = 'Conflict';
    const details = null;
    const metadata = undefined;

    // Act: Create the exception instance.
    const exception = new ConflictException(message, details, metadata);

    // Assert: Verify the status and response structure.
    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(exception.getResponse()).toStrictEqual({
      message,
      details,
      metadata,
    });
  });

  it('should create an instance with options', () => {
    // Arrange: Define test inputs including options.
    const message = 'Conflict with options';
    const details = { error: 'duplicate' };
    const metadata = { userId: 123 };
    const cause = new Error('Underlying cause');

    // Act: Create the exception instance with a direct cause value.
    const exception = new ConflictException(message, details, metadata, cause);

    // Assert: Verify the status, response, and cause are handled.
    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(exception.getResponse()).toStrictEqual({ message, details, metadata });
    expect(exception.cause).toBe(cause);
  });
});
