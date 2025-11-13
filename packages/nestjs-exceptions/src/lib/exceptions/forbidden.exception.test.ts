import { HttpStatus } from '@nestjs/common';
import { ForbiddenException } from './forbidden.exception';
import { HttpException } from './http.exception';

jest.mock('./http.exception');

const mockHttpException = HttpException as jest.MockedClass<
  typeof HttpException
>;

describe('ForbiddenException', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create an instance with message, details, metadata, and options', () => {
    // Arrange: Define test parameters.
    const message = 'Access denied';
    const details = { reason: 'Insufficient permissions' };
    const metadata = { userId: 123 };
    const cause = new Error('Test error');

    // Act: Instantiate ForbiddenException with all parameters.
    new ForbiddenException(message, details, metadata, cause);

    // Assert: Verify that HttpException is called with HttpStatus.FORBIDDEN and the correct object and cause.
    expect(mockHttpException).toHaveBeenCalledWith(
      HttpStatus.FORBIDDEN,
      {
        message,
        details,
        metadata,
      },
      cause
    );
  });

  it('should create an instance with only message', () => {
    // Arrange: Define test parameters with only message.
    const message = 'Forbidden access';

    // Act: Instantiate ForbiddenException with only message.
    new ForbiddenException(message);

    // Assert: Verify that HttpException is called with HttpStatus.FORBIDDEN and object with message, others undefined.
    expect(mockHttpException).toHaveBeenCalledWith(
      HttpStatus.FORBIDDEN,
      {
        message,
        details: undefined,
        metadata: undefined,
      },
      undefined
    );
  });

  // No-arg construction removed: constructors now require a message parameter.

  it('should handle null message', () => {
    // Arrange: Define test parameters with null message.
    const message = null;

    // Act: Instantiate ForbiddenException with null message.
     
    new ForbiddenException(message as any);

    // Assert: Verify that HttpException is called with HttpStatus.FORBIDDEN and object with null message.
    expect(mockHttpException).toHaveBeenCalledWith(
      HttpStatus.FORBIDDEN,
      {
        message,
        details: undefined,
        metadata: undefined,
      },
      undefined
    );
  });

  it('should handle empty string message', () => {
    // Arrange: Define test parameters with empty string message.
    const message = '';

    // Act: Instantiate ForbiddenException with empty string message.
    new ForbiddenException(message);

    // Assert: Verify that HttpException is called with HttpStatus.FORBIDDEN and object with empty message.
    expect(mockHttpException).toHaveBeenCalledWith(
      HttpStatus.FORBIDDEN,
      {
        message,
        details: undefined,
        metadata: undefined,
      },
      undefined
    );
  });

  it('should handle undefined details and metadata', () => {
    // Arrange: Define test parameters with undefined details and metadata.
    const message = 'Test message';
    const details = undefined;
    const metadata = undefined;

    // Act: Instantiate ForbiddenException with undefined details and metadata.
    new ForbiddenException(message, details, metadata);

    // Assert: Verify that HttpException is called with HttpStatus.FORBIDDEN and object with undefined details and metadata.
    expect(mockHttpException).toHaveBeenCalledWith(
      HttpStatus.FORBIDDEN,
      {
        message,
        details,
        metadata,
      },
      undefined
    );
  });
});
