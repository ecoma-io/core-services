import { HttpStatus } from '@nestjs/common';
import { HttpException } from './http.exception';
import { NotFoundException } from './not-found.exception';

jest.mock('./http.exception');

const mockHttpException = jest.mocked(HttpException);

describe('notFoundException', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create NotFoundException with message, details, metadata, and options', () => {
    // Arrange: Define all parameters including message, details, metadata, and options.
    const message = 'Resource not found';
    const details = { resourceId: '123' };
    const metadata = { timestamp: '2023-01-01' };
    const cause = new Error('Test cause');

    // Act: Instantiate NotFoundException with all parameters.
    new NotFoundException(message, details, metadata, cause);

    // Assert: Verify that HttpException is called with HttpStatus.NOT_FOUND and the provided parameters.
    expect(mockHttpException).toHaveBeenCalledWith(
      HttpStatus.NOT_FOUND,
      { message, details, metadata },
      cause
    );
  });

  it('should create NotFoundException with message only', () => {
    // Arrange: Define only the message parameter.
    const message = 'Resource not found';

    // Act: Instantiate NotFoundException with message only.
    new NotFoundException(message);

    // Assert: Verify that HttpException is called with HttpStatus.NOT_FOUND, message, and undefined for others.
    expect(mockHttpException).toHaveBeenCalledWith(
      HttpStatus.NOT_FOUND,
      { message, details: undefined, metadata: undefined },
      undefined
    );
  });

  it('should create NotFoundException with message and details', () => {
    // Arrange: Define message and details parameters.
    const message = 'Resource not found';
    const details = { resourceId: '123' };

    // Act: Instantiate NotFoundException with message and details.
    new NotFoundException(message, details);

    // Assert: Verify that HttpException is called with HttpStatus.NOT_FOUND, message, details, and undefined for others.
    expect(mockHttpException).toHaveBeenCalledWith(
      HttpStatus.NOT_FOUND,
      { message, details, metadata: undefined },
      undefined
    );
  });

  it('should create NotFoundException with message, details, and metadata', () => {
    // Arrange: Define message, details, and metadata parameters.
    const message = 'Resource not found';
    const details = { resourceId: '123' };
    const metadata = { timestamp: '2023-01-01' };

    // Act: Instantiate NotFoundException with message, details, and metadata.
    new NotFoundException(message, details, metadata);

    // Assert: Verify that HttpException is called with HttpStatus.NOT_FOUND, message, details, metadata, and undefined options.
    expect(mockHttpException).toHaveBeenCalledWith(
      HttpStatus.NOT_FOUND,
      { message, details, metadata },
      undefined
    );
  });

  it('should create NotFoundException with empty string message and null details', () => {
    // Arrange: Define empty string for message and null for details (edge case).
    const message = '';
    const details = null;

    // Act: Instantiate NotFoundException with empty message and null details.
    new NotFoundException(message, details);

    // Assert: Verify that HttpException is called with HttpStatus.NOT_FOUND, empty message, null details, and undefined metadata/options.
    expect(mockHttpException).toHaveBeenCalledWith(
      HttpStatus.NOT_FOUND,
      { message, details, metadata: undefined },
      undefined
    );
  });

  it('should create NotFoundException with cause only (message provided separately)', () => {
    // Arrange: Create a cause and pass alongside a message.
    const message3 = 'With cause only';
    const cause = new Error('Test cause');

    // Act: Instantiate NotFoundException with message and cause.
    new NotFoundException(message3, undefined, undefined, cause);

    // Assert: Verify that HttpException is called with HttpStatus.NOT_FOUND and the cause.
    expect(mockHttpException).toHaveBeenCalledWith(
      HttpStatus.NOT_FOUND,
      { message: message3, details: undefined, metadata: undefined },
      cause
    );
  });
});
