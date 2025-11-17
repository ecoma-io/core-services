import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { DataSource } from 'typeorm';
import {
  ServiceHealthStatus,
  SuccessResponse,
  HealthDetails,
} from '@ecoma-io/common';
import { HttpException } from '@ecoma-io/nestjs-exceptions';
import { Logger, HttpStatus, LoggerService } from '@nestjs/common';
import * as S3 from '@aws-sdk/client-s3';

// Basic mock instance for Logger methods

const mockLoggerInstance: LoggerService = {
  setLogLevels: jest.fn(),
  verbose: jest.fn(),
  fatal: jest.fn(),
  log: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock DataSource class, including the destroy method for resource cleanup
const mockDataSource = {
  isInitialized: true,
  query: jest.fn(),
  destroy: jest.fn().mockResolvedValue(undefined),
};

// Mock S3 client
const mockS3Client = {
  send: jest.fn(),
};

// Spies to track the actual logger instance methods
let debugSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

// --- TEST SUITE ---

describe('HealthService', () => {
  let service: HealthService;

  // Use fake timers globally to manage all setTimeout calls within the service logic
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(async () => {
    // Clean up all pending timers and restore real timers after the suite runs
    jest.clearAllTimers();
    jest.useRealTimers();
    // Close the mocked DataSource connection to prevent resource leaks
    await mockDataSource.destroy();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: Logger, useValue: mockLoggerInstance },
        { provide: 'S3_CLIENT_DEFAULT', useValue: mockS3Client },
      ],
    })
      .setLogger(mockLoggerInstance)
      .compile();

    service = module.get<HealthService>(HealthService);

    // Spy on the service's internal logger instance to track calls
    const actualLoggerInstance = (service as object)['logger'];
    debugSpy = jest.spyOn(actualLoggerInstance, 'debug');
    errorSpy = jest.spyOn(actualLoggerInstance, 'error');
    warnSpy = jest.spyOn(actualLoggerInstance, 'warn');

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (debugSpy) debugSpy.mockRestore();
    if (errorSpy) errorSpy.mockRestore();
    if (warnSpy) warnSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- Tests for check() method ---

  describe('check', () => {
    let pingDatabaseSpy: jest.SpyInstance;
    let pingS3Spy: jest.SpyInstance;

    beforeEach(() => {
      // Mock the private pingDatabase and pingS3 methods to resolve successfully by default
      pingDatabaseSpy = jest
        .spyOn(
          service as unknown as { pingDatabase: () => Promise<boolean> },
          'pingDatabase'
        )
        .mockResolvedValue(true);

      pingS3Spy = jest
        .spyOn(
          service as unknown as { pingS3: () => Promise<boolean> },
          'pingS3'
        )
        .mockResolvedValue(true);
    });

    afterEach(() => {
      if (pingDatabaseSpy) pingDatabaseSpy.mockRestore();
      if (pingS3Spy) pingS3Spy.mockRestore();
    });

    it('should return UP status for both database and storage if both are up', async () => {
      // Arrange
      const expectedDetails: HealthDetails = {
        database: ServiceHealthStatus.UP,
        storage: ServiceHealthStatus.UP,
      };
      const expectedResponse: SuccessResponse<HealthDetails> = {
        message: 'Service is ready',
        data: expectedDetails,
      };

      // Act
      const result = await service.check();

      // Assert
      expect(debugSpy).toHaveBeenCalledWith('Checking health...');
      expect(result).toEqual(expectedResponse);

      // Run timers to clear any pending setTimeout calls from the service logic
      jest.runAllTimers();
    });

    it('should throw HttpException if database is down', async () => {
      // Arrange
      pingDatabaseSpy.mockResolvedValue(false);
      const expectedDetails: HealthDetails = {
        database: ServiceHealthStatus.DOWN,
        storage: ServiceHealthStatus.UP,
      };

      // Act & Assert
      await expect(service.check()).rejects.toThrow(HttpException);
      await expect(service.check()).rejects.toHaveProperty(
        'status',
        HttpStatus.SERVICE_UNAVAILABLE
      );
      await expect(service.check()).rejects.toHaveProperty('response', {
        message: 'Service is not ready',
        details: expectedDetails,
      });
      expect(errorSpy).toHaveBeenCalledWith('Health check failed');

      // Run timers to clear any pending setTimeout calls
      jest.runAllTimers();
    });

    it('should throw HttpException if storage is down', async () => {
      // Arrange
      pingS3Spy.mockResolvedValue(false);
      const expectedDetails: HealthDetails = {
        database: ServiceHealthStatus.UP,
        storage: ServiceHealthStatus.DOWN,
      };

      // Act & Assert
      await expect(service.check()).rejects.toThrow(HttpException);
      await expect(service.check()).rejects.toHaveProperty(
        'status',
        HttpStatus.SERVICE_UNAVAILABLE
      );
      await expect(service.check()).rejects.toHaveProperty('response', {
        message: 'Service is not ready',
        details: expectedDetails,
      });
      expect(errorSpy).toHaveBeenCalledWith('Health check failed');

      // Run timers to clear any pending setTimeout calls
      jest.runAllTimers();
    });

    it('should throw HttpException if both database and storage are down', async () => {
      // Arrange
      pingDatabaseSpy.mockResolvedValue(false);
      pingS3Spy.mockResolvedValue(false);
      const expectedDetails: HealthDetails = {
        database: ServiceHealthStatus.DOWN,
        storage: ServiceHealthStatus.DOWN,
      };

      // Act & Assert
      await expect(service.check()).rejects.toThrow(HttpException);
      await expect(service.check()).rejects.toHaveProperty(
        'status',
        HttpStatus.SERVICE_UNAVAILABLE
      );
      await expect(service.check()).rejects.toHaveProperty('response', {
        message: 'Service is not ready',
        details: expectedDetails,
      });
      expect(errorSpy).toHaveBeenCalledWith('Health check failed');

      // Run timers to clear any pending setTimeout calls
      jest.runAllTimers();
    });
  });

  // --- Tests for private pingDatabase(timeoutMs) method ---

  describe('pingDatabase', () => {
    // Helper function to call the private method
    const pingDatabase = (timeoutMs: number) =>
      (
        service as unknown as {
          pingDatabase: (timeoutMs: number) => Promise<boolean>;
        }
      ).pingDatabase(timeoutMs);

    it('should return true if datasource is initialized and query is successful (fast)', async () => {
      // Arrange
      mockDataSource.isInitialized = true;
      mockDataSource.query.mockResolvedValue([1]);

      // Act
      const result = await pingDatabase(5000);

      // Assert
      expect(debugSpy).toHaveBeenCalledWith('Pinging database...');
      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
      expect(debugSpy).toHaveBeenCalledWith('Database ping successful');
      expect(result).toBe(true);

      // Run timers to clear the unused timeout promise
      jest.runAllTimers();
    });

    it('should return false if datasource is NOT initialized', async () => {
      // Arrange
      mockDataSource.isInitialized = false;

      // Act
      const result = await pingDatabase(2000);

      // Assert
      expect(debugSpy).toHaveBeenCalledWith('Pinging database...');
      expect(mockDataSource.query).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('Datasource is not initialized');
      expect(result).toBe(false);

      // Reset initialized status
      mockDataSource.isInitialized = true;

      // Run timers to clear the unused timeout promise
      jest.runAllTimers();
    });

    it('should return false if query fails (throws error)', async () => {
      // Arrange
      mockDataSource.isInitialized = true;
      const mockError = new Error('DB connection failed');
      mockDataSource.query.mockRejectedValue(mockError);

      // Act
      const result = await pingDatabase(2000);

      // Assert
      expect(debugSpy).toHaveBeenCalledWith('Pinging database...');
      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
      expect(errorSpy).toHaveBeenCalledWith(
        'Database ping failed',
        mockError.stack
      );
      expect(result).toBe(false);

      // Run timers to clear the unused timeout promise
      jest.runAllTimers();
    });

    it('should return false if query times out', async () => {
      // Arrange
      mockDataSource.isInitialized = true;
      // Mock query to never resolve (triggering the timeout logic via Promise.race)
      mockDataSource.query.mockImplementation(
        () =>
          new Promise(() => {
            // don't do any things
          })
      );

      const timeoutMs = 100;
      const pingPromise = pingDatabase(timeoutMs);

      // Act - Advance timers to trigger the timeout rejection
      jest.advanceTimersByTime(timeoutMs + 1);

      // Assert
      const result = await pingPromise;
      expect(debugSpy).toHaveBeenCalledWith('Pinging database...');
      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
      expect(errorSpy).toHaveBeenCalledWith(
        'Database ping failed',
        expect.stringContaining('timeout')
      );
      expect(result).toBe(false);

      // advanceTimersByTime implicitly handles the timeout timer.
    });
  });

  // --- Tests for private pingS3(timeoutMs) method ---

  describe('pingS3', () => {
    // Helper function to call the private method
    const pingS3 = (timeoutMs: number) =>
      (
        service as unknown as {
          pingS3: (timeoutMs: number) => Promise<boolean>;
        }
      ).pingS3(timeoutMs);

    it('should return true if S3 client sends ListBucketsCommand successfully', async () => {
      // Arrange
      mockS3Client.send.mockResolvedValue({});

      // Act
      const result = await pingS3(5000);

      // Assert
      expect(debugSpy).toHaveBeenCalledWith('Pinging S3...');
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(S3.ListBucketsCommand)
      );
      expect(debugSpy).toHaveBeenCalledWith('S3 ping successful');
      expect(result).toBe(true);

      // Run timers to clear the unused timeout promise
      jest.runAllTimers();
    });

    it('should return false if S3 client send fails (throws error)', async () => {
      // Arrange
      const mockError = new Error('S3 connection failed');
      mockS3Client.send.mockRejectedValue(mockError);

      // Act
      const result = await pingS3(2000);

      // Assert
      expect(debugSpy).toHaveBeenCalledWith('Pinging S3...');
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(S3.ListBucketsCommand)
      );
      expect(errorSpy).toHaveBeenCalledWith('S3 ping failed', mockError.stack);
      expect(result).toBe(false);

      // Run timers to clear the unused timeout promise
      jest.runAllTimers();
    });

    it('should return false if S3 client send times out', async () => {
      // Arrange
      // Mock send to never resolve (triggering the timeout logic via Promise.race)
      mockS3Client.send.mockImplementation(
        () =>
          new Promise(() => {
            // don't do any things
          })
      );

      const timeoutMs = 100;
      const pingPromise = pingS3(timeoutMs);

      // Act - Advance timers to trigger the timeout rejection
      jest.advanceTimersByTime(timeoutMs + 1);

      // Assert
      const result = await pingPromise;
      expect(debugSpy).toHaveBeenCalledWith('Pinging S3...');
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(S3.ListBucketsCommand)
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'S3 ping failed',
        expect.stringContaining('timeout')
      );
      expect(result).toBe(false);

      // advanceTimersByTime implicitly handles the timeout timer.
    });
  });
});
