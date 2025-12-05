import { IntrinsicException } from './intrinsic.exception';

describe('IntrinsicException', () => {
  it('should be defined', () => {
    // Arrange: No special setup needed for class definition check.
    // Act: Attempt to access the class.
    // Assert: Verify the class is defined.
    expect(IntrinsicException).toBeDefined();
  });

  it('should create an instance with a message (happy path)', () => {
    // Arrange: Define the message for the exception.
    const message = 'This is an intrinsic error';

    // Act: Create an instance of IntrinsicException with the message.
    const exception = new IntrinsicException(message);

    // Assert: Verify the instance is created, is an instance of Error, and has the correct message.
    expect(exception).toBeInstanceOf(IntrinsicException);
    expect(exception).toBeInstanceOf(Error);
    expect(exception.message).toBe(message);
  });

  it('should create an instance without a message (edge case: empty message)', () => {
    // Arrange: No message provided.
    // Act: Create an instance of IntrinsicException without arguments.
    const exception = new IntrinsicException();

    // Assert: Verify the instance is created and has an empty message.
    expect(exception).toBeInstanceOf(IntrinsicException);
    expect(exception.message).toBe('');
  });

  it('should handle null or undefined message (edge case: invalid input)', () => {
    // Arrange: Define null and undefined messages.
    const nullMessage = null;
    const undefinedMessage = undefined;

    // Act: Create instances with null and undefined messages.
    const exceptionNull = new IntrinsicException(nullMessage as any);
    const exceptionUndefined = new IntrinsicException(undefinedMessage as any);

    // Assert: Verify instances are created and messages are handled as empty strings (default Error behavior).
    expect(exceptionNull).toBeInstanceOf(IntrinsicException);
    expect(exceptionNull.message).toBe('null'); // Error constructor converts null to 'null'
    expect(exceptionUndefined).toBeInstanceOf(IntrinsicException);
    expect(exceptionUndefined.message).toBe(''); // Error constructor converts undefined to empty string
  });

  it('should have a name property set to the class name', () => {
    // Arrange: Define a message.
    const message = 'Test error';

    // Act: Create an instance.
    const exception = new IntrinsicException(message);

    // Assert: Verify the name property is set correctly.
    expect(exception.name).toBe('IntrinsicException');
  });

  it('should be throwable and catchable as an Error (error handling)', () => {
    // Arrange: Create an exception instance.
    const exception = new IntrinsicException('Throwable error');

    // Act: Throw and catch the exception.
    let caughtException: IntrinsicException | undefined;
    try {
      throw exception;
    } catch (error) {
      caughtException = error as IntrinsicException;
    }

    // Assert: Verify the caught exception is the same instance and has correct properties.
    expect(caughtException).toBe(exception);
    expect(caughtException).toBeInstanceOf(IntrinsicException);
    expect(caughtException?.message).toBe('Throwable error');
  });
});
