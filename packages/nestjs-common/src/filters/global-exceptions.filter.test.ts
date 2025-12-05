import { Test, TestingModule } from '@nestjs/testing';
import {
  ArgumentsHost,
  HttpStatus,
  Logger,
  // eslint-disable-next-line no-restricted-syntax
  NotFoundException as NestNotFoundException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { GlobalExceptionsFilter } from './global-exceptions.filter';
import { UnauthorizedException } from '../exceptions';

/**
 * Mock HttpAdapterHost for testing purposes.
 * Provides a mock httpAdapter with a reply method.
 */
const mockHttpAdapterHost = {
  httpAdapter: {
    reply: jest.fn(),
  },
};

/**
 * Mock Logger object for injection in tests.
 * Includes all standard logging methods as Jest mocks.
 */
const mockLogger = {
  fatal: jest.fn(),
  log: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

/**
 * Mock ArgumentsHost for simulating request/response context.
 * Mocks the switchToHttp method to return a mock response.
 */
const mockResponse = {};
const mockHost = {
  switchToHttp: jest.fn().mockReturnValue({
    getResponse: jest.fn().mockReturnValue(mockResponse),
  }),
} as unknown as ArgumentsHost;

/**
 * Test suite for GlobalExceptionsFilter.
 * Verifies exception handling behavior in various scenarios.
 */
describe('GlobalExceptionsFilter', () => {
  let filter: GlobalExceptionsFilter;
  let httpAdapterReply: jest.Mock;
  let errorSpy: jest.SpyInstance;

  beforeEach(async () => {
    mockLogger.error.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlobalExceptionsFilter,
        {
          provide: HttpAdapterHost,
          useValue: mockHttpAdapterHost,
        },
        // Override Logger with the mock object
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    })
      .setLogger(mockLogger)
      .compile();

    filter = module.get<GlobalExceptionsFilter>(GlobalExceptionsFilter);
    httpAdapterReply = mockHttpAdapterHost.httpAdapter.reply as jest.Mock;

    const actualLoggerInstance = filter['logger'];
    // Spy on the 'error' method of the injected Logger instance to track calls.
    errorSpy = jest.spyOn(actualLoggerInstance, 'error');

    // Reset spies and mocks before each test
    errorSpy.mockClear();
    httpAdapterReply.mockClear();
  });

  // Ensure environment cleanup after each test
  afterEach(() => {
    jest.clearAllMocks();
    errorSpy.mockRestore();
  });

  /**
   * Test to verify that the GlobalExceptionsFilter instance is properly defined.
   */
  it('should be defined', () => {
    // Arrange: No setup needed for this basic existence check.

    // Act: Retrieve the filter instance (already done in beforeEach).

    // Assert: Verify the filter is defined.
    expect(filter).toBeDefined();
  });

  /**
   * Test case for handling standard NestJS HttpException (e.g., NotFoundException).
   */
  it('should handle standard NestHttpException (e.g., NotFoundException) correctly', () => {
    // Arrange: Create a standard NestJS NotFoundException.
    const exception = new NestNotFoundException('Resource not found!');

    // Act: Call the filter's catch method with the exception and mock host.
    filter.catch(exception, mockHost);

    // Assert: Verify Logger was called and first argument is the exception.
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls[0][0]).toBe(exception);

    // Assert: Verify httpAdapter.reply was called with the correct response structure.
    expect(httpAdapterReply).toHaveBeenCalledWith(
      mockResponse, // The raw response object
      { message: 'Resource not found!' },
      HttpStatus.NOT_FOUND // Status Code (404)
    );
  });

  /**
   * Test case for handling custom application HttpException.
   */
  it('should handle custom application HttpException correctly', () => {
    // Arrange: Define custom response payload and create UnauthorizedException.
    const customResponse = {
      productId: 123,
    };
    const exception = new UnauthorizedException(
      'Product out of stock',
      customResponse
    );

    // Act: Call the filter's catch method with the exception and mock host.
    filter.catch(exception, mockHost);

    // Assert: Verify Logger was called and first argument is the exception.
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls[0][0]).toBe(exception);

    // Assert: Verify httpAdapter.reply was called with the custom response body.
    expect(httpAdapterReply).toHaveBeenCalledWith(
      mockResponse,
      exception.getResponse(),
      HttpStatus.UNAUTHORIZED // Status Code (401)
    );
  });

  /**
   * Test case for handling unknown/unhandled errors with fallback to 500 Internal Server Error.
   */
  it('should handle unknown exceptions and fallback to 500 Internal Server Error', () => {
    // Arrange: Create an unknown Error instance.
    const unknownError = new Error('Database connection failed');

    // Act: Call the filter's catch method with the error and mock host.
    filter.catch(unknownError, mockHost);

    // Assert: Verify Logger was called and first argument is the error.
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls[0][0]).toBe(unknownError);

    // Assert: Verify httpAdapter.reply was called with status 500 and generic message.
    expect(httpAdapterReply).toHaveBeenCalledWith(
      mockResponse,
      { message: 'Internal Server Error' }, // Generic response payload
      HttpStatus.INTERNAL_SERVER_ERROR // Status Code (500)
    );
  });

  /**
   * Test case for handling non-Error exceptions (e.g., string or object) as 500 Internal Server Error.
   */
  it('should handle non-Error exceptions (like a string or object) as 500 Internal Server Error', () => {
    // Arrange: Define a string error.
    const stringError = 'Something went wrong catastrophically';

    // Act: Call the filter's catch method with the string error and mock host.
    filter.catch(stringError, mockHost);

    // Assert: Verify Logger was called and first argument is the string error.
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls[0][0]).toBe(stringError);

    // Assert: Verify httpAdapter.reply was called with status 500 and generic message.
    expect(httpAdapterReply).toHaveBeenCalledWith(
      mockResponse,
      { message: 'Internal Server Error' },
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  });
});
