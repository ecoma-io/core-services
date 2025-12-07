import { HttpStatus } from '@nestjs/common';
import { UnauthorizedException } from './unauthorized.exception';
import { HttpException } from './http.exception';

jest.mock('./http.exception', () => ({
  HttpException: jest.fn(),
}));

const mockHttpException = jest.mocked(HttpException);

describe('unauthorizedException', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create an instance with all parameters provided', () => {
    // Arrange: Define all parameters.
    const message = 'Access denied';
    const details = { reason: 'Invalid token' };
    const metadata = { userId: 123 };
    const cause = new Error('Test error');

    // Act: Instantiate UnauthorizedException with all parameters.
    new UnauthorizedException(message, details, metadata, cause);

    // Assert: Verify that HttpException is called with HttpStatus.UNAUTHORIZED and the correct object.
    expect(mockHttpException).toHaveBeenCalledWith(
      HttpStatus.UNAUTHORIZED,
      {
        message,
        details,
        metadata,
      },
      cause
    );
  });

  it('should create an instance with only message provided', () => {
    // Arrange: Define only message.
    const message = 'Access denied';

    // Act: Instantiate UnauthorizedException with only message.
    new UnauthorizedException(message);

    // Assert: Verify that HttpException is called with HttpStatus.UNAUTHORIZED and object with message, others undefined.
    expect(mockHttpException).toHaveBeenCalledWith(
      HttpStatus.UNAUTHORIZED,
      {
        message,
        details: undefined,
        metadata: undefined,
      },
      undefined
    );
  });

  it('should create an instance with message and details provided', () => {
    // Arrange: Define message and details.
    const message = 'Access denied';
    const details = { reason: 'Invalid token' };

    // Act: Instantiate UnauthorizedException with message and details.
    new UnauthorizedException(message, details);

    // Assert: Verify that HttpException is called with HttpStatus.UNAUTHORIZED and object with message and details, metadata undefined.
    expect(mockHttpException).toHaveBeenCalledWith(
      HttpStatus.UNAUTHORIZED,
      {
        message,
        details,
        metadata: undefined,
      },
      undefined
    );
  });

  it('should create an instance with message, details, and metadata provided', () => {
    // Arrange: Define message, details, and metadata.
    const message = 'Access denied';
    const details = { reason: 'Invalid token' };
    const metadata = { userId: 123 };

    // Act: Instantiate UnauthorizedException with message, details, and metadata.
    new UnauthorizedException(message, details, metadata);

    // Assert: Verify that HttpException is called with HttpStatus.UNAUTHORIZED and the correct object, options undefined.
    expect(mockHttpException).toHaveBeenCalledWith(
      HttpStatus.UNAUTHORIZED,
      {
        message,
        details,
        metadata,
      },
      undefined
    );
  });

  // No-arg construction removed: constructor now requires a message parameter.

  it('should create an instance with null message', () => {
    // Arrange: Define null message.
    const message = null;

    // Act: Instantiate UnauthorizedException with null message.
     
    new UnauthorizedException(message as any);

    // Assert: Verify that HttpException is called with HttpStatus.UNAUTHORIZED and object with null message.
    expect(mockHttpException).toHaveBeenCalledWith(
      HttpStatus.UNAUTHORIZED,
      {
        message,
        details: undefined,
        metadata: undefined,
      },
      undefined
    );
  });

  it('should create an instance with empty string message', () => {
    // Arrange: Define empty string message.
    const message = '';

    // Act: Instantiate UnauthorizedException with empty string message.
    new UnauthorizedException(message);

    // Assert: Verify that HttpException is called with HttpStatus.UNAUTHORIZED and object with empty string message.
    expect(mockHttpException).toHaveBeenCalledWith(
      HttpStatus.UNAUTHORIZED,
      {
        message,
        details: undefined,
        metadata: undefined,
      },
      undefined
    );
  });

  it('should create an instance with null details', () => {
    // Arrange: Define message and null details.
    const message = 'Access denied';
    const details = null;

    // Act: Instantiate UnauthorizedException with null details.
    new UnauthorizedException(message, details);

    // Assert: Verify that HttpException is called with HttpStatus.UNAUTHORIZED and object with null details.
    expect(mockHttpException).toHaveBeenCalledWith(
      HttpStatus.UNAUTHORIZED,
      {
        message,
        details,
        metadata: undefined,
      },
      undefined
    );
  });

  it('should create an instance with null metadata', () => {
    // Arrange: Define message, details, and null metadata.
    const message = 'Access denied';
    const details = { reason: 'Invalid token' };
    const metadata = null;

    // Act: Instantiate UnauthorizedException with null metadata.
    new UnauthorizedException(message, details, metadata);

    // Assert: Verify that HttpException is called with HttpStatus.UNAUTHORIZED and object with null metadata.
    expect(mockHttpException).toHaveBeenCalledWith(
      HttpStatus.UNAUTHORIZED,
      {
        message,
        details,
        metadata,
      },
      undefined
    );
  });

  it('should create an instance with null options', () => {
    // Arrange: Define message, details, metadata, and null options.
    const message = 'Access denied';
    const details = { reason: 'Invalid token' };
    const metadata = { userId: 123 };
    const cause = null;

    // Act: Instantiate UnauthorizedException with null cause.
     
    new UnauthorizedException(message, details, metadata, cause as any);

    // Assert: Verify that HttpException is called with HttpStatus.UNAUTHORIZED and null cause.
    expect(mockHttpException).toHaveBeenCalledWith(
      HttpStatus.UNAUTHORIZED,
      {
        message,
        details,
        metadata,
      },
      cause
    );
  });
});
