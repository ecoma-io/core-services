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
      ],
    })
      .setLogger(mockLoggerInstance)
      .compile();

    service = module.get<HealthService>(HealthService);

    // Spy on the service's internal logger instance to track calls
    const actualLoggerInstance = (service as any)['logger'];
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

    beforeEach(() => {
      // Mock the private pingDatabase method to resolve successfully by default
      pingDatabaseSpy = jest
        .spyOn(
          service as unknown as { pingDatabase: () => Promise<boolean> },
          'pingDatabase'
        )
        .mockResolvedValue(true);
    });

    afterEach(() => {
      if (pingDatabaseSpy) pingDatabaseSpy.mockRestore();
    });

    it('should return UP status for database if it is up', async () => {
      // Arrange
      const expectedDetails: HealthDetails = {
        database: ServiceHealthStatus.UP,
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
});
