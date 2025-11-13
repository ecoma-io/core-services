import { S3Client } from '@aws-sdk/client-s3';
import { validateS3Client, delay } from './s3.helpers';

// Mock S3Client and commands
jest.mock('@aws-sdk/client-s3', () => {
  const S3Client = jest.fn(() => ({
    send: jest.fn(),
  }));
  const ListBucketsCommand = jest.fn();
  return { S3Client, ListBucketsCommand };
});

// Mock Logger from NestJS
const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('S3 Helpers', () => {
  describe('delay', () => {
    // Use fake timers from Jest
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should resolve after the specified time', async () => {
      // Arrange: Set up the delay time and promise
      const ms = 1000;
      const promise = delay(ms);
      let resolved = false;
      promise.then(() => {
        resolved = true;
      });

      // Assert: Initially, promise should not be resolved
      expect(resolved).toBe(false);

      // Act: Advance timers by the specified time
      jest.advanceTimersByTime(ms);

      // Act: Wait for promise to resolve
      await promise;

      // Assert: Now it should be resolved
      expect(resolved).toBe(true);
    });

    it('should resolve immediately with 0ms delay', async () => {
      // Arrange: Temporarily use real timers for 0ms delay test
      jest.useRealTimers();
      const promise = delay(0);

      // Act & Assert: Expect the promise to resolve immediately to undefined
      await expect(promise).resolves.toBeUndefined();

      // Restore fake timers
      jest.useFakeTimers();
    });
  });

  describe('validateS3Client', () => {
    let mockS3Client: S3Client;
    let mockSend: jest.Mock;

    beforeEach(() => {
      // Mock delay to make tests run faster
      jest.spyOn(require('./s3.helpers'), 'delay').mockResolvedValue(undefined);

      // Reset mocks before each test
      mockSend = jest.fn();
       
      mockS3Client = { send: mockSend } as any; // Mock S3Client for testing
      mockLogger.log.mockClear();
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should connect successfully on the first try', async () => {
      // Arrange: Mock successful send response
      mockSend.mockResolvedValueOnce({});

      // Act: Call validateS3Client
      await validateS3Client(mockS3Client, {}, 'default', mockLogger);

      // Assert: Verify send was called once and success log was emitted
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockLogger.log).toHaveBeenCalledWith(
        'S3 client "default" connected successfully.'
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should fail once and succeed on the second try', async () => {
      // Arrange: Mock failure on first attempt, success on second
      mockSend
        .mockRejectedValueOnce(new Error('Connection error'))
        .mockResolvedValueOnce({});

      // Act: Call validateS3Client with retry options
      await validateS3Client(
        mockS3Client,
        { retries: 5, retryDelay: 100 },
        'default',
        mockLogger
      );

      // Assert: Verify send was called twice, with one warn and one log
      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.log).toHaveBeenCalledTimes(1);
    });

    it('should fail all attempts and throw an error', async () => {
      // Arrange: Mock permanent failure
      const error = new Error('Permanent failure');
      mockSend.mockRejectedValue(error);
      const options = { retries: 3, retryDelay: 50 };

      // Act & Assert: Expect the function to throw an error
      await expect(
        validateS3Client(mockS3Client, options, 'default', mockLogger)
      ).rejects.toThrow(
        '[S3Module] Failed to connect S3 client "default": Permanent failure'
      );

      // Assert: Verify send was called 3 times, with 2 warns and 1 error
      expect(mockSend).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });

    it('should use default options when not provided', async () => {
      // Arrange: Mock failure and empty options
      mockSend.mockRejectedValue(new Error('Failure'));

      // Act & Assert: Expect the function to throw with default retries
      await expect(
        validateS3Client(mockS3Client, {}, 'default', mockLogger)
      ).rejects.toThrow();

      // Assert: Verify send was called 5 times (default retries)
      expect(mockSend).toHaveBeenCalledTimes(5);
    }, 30000);

    it('should handle non-Error exceptions', async () => {
      // Arrange: Mock throwing a string instead of an Error
      mockSend.mockRejectedValue('String error');
      const options = { retries: 1 };

      // Act & Assert: Expect the function to throw with the string error
      await expect(
        validateS3Client(mockS3Client, options, 'test-client', mockLogger)
      ).rejects.toThrow(
        '[S3Module] Failed to connect S3 client "test-client": String error'
      );

      // Assert: Verify error log was called
      expect(mockLogger.error).toHaveBeenCalledWith(
        'S3 client "test-client" failed to connect after 1 attempts. Error: String error'
      );
    });

    it('should log correct retry messages with exponential backoff', async () => {
      // Arrange: Mock network error and retry options
      mockSend.mockRejectedValue(new Error('Network error'));
      const options = { retries: 3, retryDelay: 200 };

      // Act & Assert: Expect the function to throw
      await expect(
        validateS3Client(mockS3Client, options, 'test-client', mockLogger)
      ).rejects.toThrow();

      // Assert: Verify specific warning messages for retries
      expect(mockLogger.warn).toHaveBeenNthCalledWith(
        1,
        'Failed to connect S3 client "test-client" (Attempt 1/3). Retrying in 0.2s... Error: Network error'
      );
      expect(mockLogger.warn).toHaveBeenNthCalledWith(
        2,
        'Failed to connect S3 client "test-client" (Attempt 2/3). Retrying in 0.4s... Error: Network error'
      );
    });
  });
});
