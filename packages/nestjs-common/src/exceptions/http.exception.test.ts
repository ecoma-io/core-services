import { IntrinsicException, IErrorResponse } from '@ecoma-io/common';
import { HttpException } from './http.exception';

jest.mock('@ecoma-io/common');

const mockIntrinsicException = jest.mocked(IntrinsicException);

describe('httpException', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create an instance with status, response, and cause', () => {
    // Arrange: Define test inputs.
    const status = 404;
    const response: IErrorResponse<string, object> = {
      message: 'Not Found',
      details: 'Resource not found',
      metadata: { key: 'value' },
    };
    const cause = new Error('Test cause');

    // Act: Instantiate HttpException with explicit cause.
    const exception = new HttpException(status, response, cause);

    // Assert: Verify properties are set correctly.
    expect(exception.getStatus()).toBe(status);
    expect(exception.getResponse()).toStrictEqual(response);
    expect(exception.cause).toBe(cause);
    expect(mockIntrinsicException).toHaveBeenCalledTimes(1);
  });

  it('should have undefined response if not provided', () => {
    // Arrange: Define test inputs without response.
    const status = 500;

    // Act: Instantiate HttpException without response.
    const exception = new HttpException(status);

    // Assert: Verify response is undefined when not provided.
    expect(exception.getResponse()).toBeUndefined();
    expect(exception.getStatus()).toBe(status);
  });

  it('should return provided response object when message is provided', () => {
    // Arrange: Define response with explicit message.
    const status = 400;
    const response: IErrorResponse<string> = {
      message: 'Bad Request',
      details: 'Bad Request details',
    };

    // Act: Instantiate HttpException with the response.
    const exception = new HttpException(status, response);

    // Assert: Verify the same response object is returned.
    expect(exception.getResponse()).toBe(response);
    expect(exception.getResponse()?.message).toBe('Bad Request');
  });

  it('should set cause if provided as third argument', () => {
    // Arrange: Define a cause value.
    const status = 403;
    const cause = new Error('Forbidden cause');

    // Act: Instantiate HttpException with cause as third argument.
    const exception = new HttpException(status, undefined, cause);

    // Assert: Verify cause is set.
    expect(exception.cause).toBe(cause);
  });

  it('should not set cause if third argument is undefined', () => {
    // Arrange: Define status and undefined cause.
    const status = 401;

    // Act: Instantiate HttpException with undefined cause.
    const exception = new HttpException(status, undefined, undefined);

    // Assert: Verify cause is undefined.
    expect(exception.cause).toBeUndefined();
  });

  it('should handle null cause value gracefully', () => {
    // Arrange: Define a null cause value.
    const status = 200;

    // Act: Instantiate HttpException with null as cause.
    const exception = new HttpException(status, undefined, null as unknown);

    // Assert: Verify no errors and cause is null.
    expect(exception.cause).toBeNull();
    expect(exception.getStatus()).toBe(status);
  });

  it('should return the empty response object when provided', () => {
    // Arrange: Define empty response.
    const status = 422;
    const response: IErrorResponse = { message: '' };

    // Act: Instantiate HttpException with empty response.
    const exception = new HttpException(status, response);

    // Assert: Verify the same empty response object is returned.
    expect(exception.getResponse()).toBe(response);
  });
});
