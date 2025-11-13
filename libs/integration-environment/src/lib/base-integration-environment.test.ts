import { BaseIntegrationEnvironment } from './base-integration-environment';
import { StartedTestContainer } from 'testcontainers';

// Mock external dependencies
jest.mock('typeorm', () => ({
  DataSource: jest.fn(),
}));

jest.mock('ioredis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    select: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn(),
  })),
  CreateBucketCommand: jest.fn(),
  PutBucketPolicyCommand: jest.fn(),
}));

jest.mock('pg', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue(undefined),
    end: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock integration-hybridize
jest.mock('@ecoma-io/integration-hybridize', () => {
  class MockIntegrationEnvironment {
    constructor(
      public address: string,
      public enableProxy: boolean
    ) {}
    createService = jest.fn();
    log = jest.fn();
    id = 'mock-id';
  }
  // @ts-expect-error Adding stop to prototype for mocking
  MockIntegrationEnvironment.prototype.stop = jest
    .fn()
    .mockResolvedValue(undefined);
  return {
    IntegrationEnvironment: MockIntegrationEnvironment,
  };
});

describe('BaseIntegrationEnvironment', () => {
  let mockCreateService: jest.Mock;

  beforeEach(() => {
    // Reset env vars
    process.env['POSTGRES_PORT'] = '5432';
    process.env['REDIS_PORT'] = '6379';
    process.env['MINIO_PORT'] = '9000';
    process.env['MAILDEV_WEB_PORT'] = '1080';
    process.env['MINIO_KEY'] = 'minioadmin';
    process.env['MINIO_SECRET'] = 'minioadmin';
    process.env['POSTGRES_USERNAME'] = 'postgres';
    process.env['POSTGRES_PASSWORD'] = 'password';
    process.env['REDIS_PASSWORD'] = 'password';

    // Mock instance
    mockCreateService = jest.fn();
  });

  afterEach(() => {
    // Clean up env vars
    delete process.env['POSTGRES_PORT'];
    delete process.env['REDIS_PORT'];
    delete process.env['MINIO_PORT'];
    delete process.env['MAILDEV_WEB_PORT'];
    delete process.env['MINIO_KEY'];
    delete process.env['MINIO_SECRET'];
    delete process.env['POSTGRES_USERNAME'];
    delete process.env['POSTGRES_PASSWORD'];
    delete process.env['REDIS_PASSWORD'];
  });

  describe('constructor', () => {
    test('should throw error if POSTGRES_PORT is not set', () => {
      delete process.env['POSTGRES_PORT'];
      expect(() => new TestBaseIntegrationEnvironment({ proxy: true })).toThrow(
        'Environment variable POSTGRES_PORT is required but not set'
      );
    });

    test('should throw error if POSTGRES_USERNAME is not set', () => {
      delete process.env['POSTGRES_USERNAME'];
      expect(() => new TestBaseIntegrationEnvironment({ proxy: true })).toThrow(
        'Environment variable POSTGRES_USERNAME is required but not set'
      );
    });

    test('should throw error if POSTGRES_PASSWORD is not set', () => {
      delete process.env['POSTGRES_PASSWORD'];
      expect(() => new TestBaseIntegrationEnvironment({ proxy: true })).toThrow(
        'Environment variable POSTGRES_PASSWORD is required but not set'
      );
    });

    test('should throw error if REDIS_PORT is not set', () => {
      delete process.env['REDIS_PORT'];
      expect(() => new TestBaseIntegrationEnvironment({ proxy: true })).toThrow(
        'Environment variable REDIS_PORT is required but not set'
      );
    });

    test('should throw error if REDIS_PASSWORD is not set', () => {
      delete process.env['REDIS_PASSWORD'];
      expect(() => new TestBaseIntegrationEnvironment({ proxy: true })).toThrow(
        'Environment variable REDIS_PASSWORD is required but not set'
      );
    });

    test('should throw error if MINIO_PORT is not set', () => {
      delete process.env['MINIO_PORT'];
      expect(() => new TestBaseIntegrationEnvironment({ proxy: true })).toThrow(
        'Environment variable MINIO_PORT is required but not set'
      );
    });

    test('should throw error if MINIO_KEY is not set', () => {
      delete process.env['MINIO_KEY'];
      expect(() => new TestBaseIntegrationEnvironment({ proxy: true })).toThrow(
        'Environment variable MINIO_KEY is required but not set'
      );
    });

    test('should throw error if MINIO_SECRET is not set', () => {
      delete process.env['MINIO_SECRET'];
      expect(() => new TestBaseIntegrationEnvironment({ proxy: true })).toThrow(
        'Environment variable MINIO_SECRET is required but not set'
      );
    });

    test('should throw error if MAILDEV_WEB_PORT is not set', () => {
      delete process.env['MAILDEV_WEB_PORT'];
      expect(() => new TestBaseIntegrationEnvironment({ proxy: true })).toThrow(
        'Environment variable MAILDEV_WEB_PORT is required but not set'
      );
    });

    test('should create instance when all env vars are set', () => {
      expect(
        () => new TestBaseIntegrationEnvironment({ proxy: true })
      ).not.toThrow();
    });
  });

  class TestBaseIntegrationEnvironment extends BaseIntegrationEnvironment {
    async initAppContainers(): Promise<StartedTestContainer[]> {
      return [];
    }
  }

  describe('getPostgres', () => {
    let mockClient: any;
    let mockDataSource: any;

    beforeEach(() => {
      mockClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockResolvedValue(undefined),
        end: jest.fn().mockResolvedValue(undefined),
      };
      (require('pg').Client as jest.Mock).mockImplementation(() => mockClient);

      mockDataSource = {
        initialize: jest.fn().mockResolvedValue(undefined),
        destroy: jest.fn().mockResolvedValue(undefined),
      };
      (require('typeorm').DataSource as jest.Mock).mockImplementation(
        () => mockDataSource
      );
    });

    test('should create service with correct name and port, initialize DataSource, create database, and return with dataSource', async () => {
      // Arrange: Set env var
      process.env['POSTGRES_PORT'] = '5432';
      const env = new TestBaseIntegrationEnvironment({ proxy: true });
      const mockService = { host: 'localhost', port: 5432 };
       
      (env as any).createService = mockCreateService;
      mockCreateService.mockResolvedValue(mockService);

      // Act: Call method
      const result = await env.getPostgres();

      // Assert: createService called with expected args
      expect(mockCreateService).toHaveBeenCalledWith(
        'postgres-mock-id',
        '5432'
      );
      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(
        'CREATE DATABASE "test_mock-id";'
      );
      expect(mockClient.end).toHaveBeenCalled();
      expect(result).toEqual({
        dataSource: mockDataSource,
        databaseName: 'test_mock-id',
        ...mockService,
      });
    });

    test('should cache the service and return the same instance on subsequent calls', async () => {
      // Arrange: Set env var
      process.env['POSTGRES_PORT'] = '5432';
      const env = new TestBaseIntegrationEnvironment({ proxy: true });
      const mockService = { host: 'localhost', port: 5432 };
       
      (env as any).createService = mockCreateService;
      mockCreateService.mockResolvedValue(mockService);

      // Act: Call method twice
      const result1 = await env.getPostgres();
      const result2 = await env.getPostgres();

      // Assert: createService called only once
      expect(mockCreateService).toHaveBeenCalledTimes(1);
      expect(result1).toBe(result2); // Same reference
    });
  });

  describe('getRedis', () => {
    let mockRedis: any;

    beforeEach(() => {
      mockRedis = {
        select: jest.fn().mockResolvedValue(undefined),
        set: jest.fn().mockResolvedValue(undefined),
        quit: jest.fn().mockResolvedValue(undefined),
      };
      (require('ioredis').Redis as jest.Mock).mockImplementation(
        () => mockRedis
      );
    });

    test('should create service for Redis, initialize Redis client, select database, set test key, and return with redis', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });
       
      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 6379 };
      mockCreateService.mockResolvedValue(mockService);

      // Act
      const result = await env.getRedis();

      // Assert
      expect(mockCreateService).toHaveBeenCalledWith('redis-mock-id', '6379');
      expect(require('ioredis').Redis).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        password: expect.any(String),
        keyPrefix: 'test_mock-id_',
      });
      expect(mockRedis.select).toHaveBeenCalledWith(2); // Based on mock-id hash % 15 + 1
      expect(mockRedis.set).toHaveBeenCalledWith('test_mock-id', 'initialized');
      expect(result).toEqual({ redis: mockRedis, ...mockService });
    });

    test('should cache the service and return the same instance on subsequent calls', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });
       
      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 6379 };
      mockCreateService.mockResolvedValue(mockService);

      // Act: Call method twice
      const result1 = await env.getRedis();
      const result2 = await env.getRedis();

      // Assert: createService called only once
      expect(mockCreateService).toHaveBeenCalledTimes(1);
      expect(result1).toBe(result2); // Same reference
    });
  });

  describe('getMinio', () => {
    let mockS3Client: any;

    beforeEach(() => {
      mockS3Client = {
        send: jest.fn().mockResolvedValue(undefined),
        destroy: jest.fn(),
      };
      (require('@aws-sdk/client-s3').S3Client as jest.Mock).mockImplementation(
        () => mockS3Client
      );
    });

    test('should create service for MinIO, initialize S3 client, create bucket, and return with bucketName and s3Client', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });
       
      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 9000 };
      mockCreateService.mockResolvedValue(mockService);

      // Act
      const result = await env.getMinio();

      // Assert
      expect(mockCreateService).toHaveBeenCalledWith('minio-mock-id', '9000');
      expect(require('@aws-sdk/client-s3').S3Client).toHaveBeenCalledWith({
        endpoint: 'http://localhost:9000',
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'minioadmin',
          secretAccessKey: 'minioadmin',
        },
        forcePathStyle: true,
      });
      expect(mockS3Client.send).toHaveBeenCalledTimes(1); // CreateBucketCommand
      expect(result).toEqual({
        bucketName: 'test-private-mock-id',
        s3Client: mockS3Client,
        ...mockService,
      });
    });

    test('should set public policy when isPublicBucket is true', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });
       
      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 9000 };
      mockCreateService.mockResolvedValue(mockService);

      // Act
      const result = await env.getMinio({ isPublicBucket: true });

      // Assert
      expect(mockS3Client.send).toHaveBeenCalledTimes(2); // CreateBucket and PutBucketPolicy
      expect(result.bucketName).toBe('test-public-mock-id');
    });

    test('should cache the service and return the same instance on subsequent calls', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });
       
      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 9000 };
      mockCreateService.mockResolvedValue(mockService);

      // Act: Call method twice
      const result1 = await env.getMinio();
      const result2 = await env.getMinio();

      // Assert: createService called only once
      expect(mockCreateService).toHaveBeenCalledTimes(1);
      expect(result1).toBe(result2); // Same reference
    });

    test('should cache separately for different options', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });
       
      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 9000 };
      mockCreateService.mockResolvedValue(mockService);

      // Act: Call with different options
      await env.getMinio({ isPublicBucket: false });
      await env.getMinio({ isPublicBucket: true });

      // Assert: createService called twice
      expect(mockCreateService).toHaveBeenCalledTimes(2);
    });

    test('should handle MinIO CreateBucket error', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });
       
      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 9000 };
      mockCreateService.mockResolvedValue(mockService);
      mockS3Client.send.mockRejectedValueOnce(new Error('CreateBucket failed'));

      // Act & Assert
      await expect(env.getMinio()).rejects.toThrow(
        'Failed to setup MinIO bucket: Error: CreateBucket failed'
      );
    });

    test('should handle MinIO PutBucketPolicy error', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });
       
      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 9000 };
      mockCreateService.mockResolvedValue(mockService);
      mockS3Client.send
        .mockResolvedValueOnce(undefined) // CreateBucket succeeds
        .mockRejectedValueOnce(new Error('PutBucketPolicy failed')); // Policy fails

      // Act & Assert
      await expect(env.getMinio({ isPublicBucket: true })).rejects.toThrow(
        'Failed to setup MinIO bucket: Error: PutBucketPolicy failed'
      );
    });
  });

  describe('getMaildev', () => {
    test('should create service for Maildev', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });
       
      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 1080 };
      mockCreateService.mockResolvedValue(mockService);

      // Act
      const service = await env.getMaildev();

      // Assert
      expect(mockCreateService).toHaveBeenCalledWith('maildev-mock-id', '1080');
      expect(service).toBe(mockService);
    });

    test('should cache the service and return the same instance on subsequent calls', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });
       
      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 1080 };
      mockCreateService.mockResolvedValue(mockService);

      // Act: Call method twice
      const result1 = await env.getMaildev();
      const result2 = await env.getMaildev();

      // Assert: createService called only once
      expect(mockCreateService).toHaveBeenCalledTimes(1);
      expect(result1).toBe(result2); // Same reference
    });
  });

  describe('stop', () => {
    test('should clear service cache and call waitToCloses functions', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });
       
      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 5432 };
      mockCreateService.mockResolvedValue(mockService);

      // Mock waitToCloses functions
      const closeFn1 = jest.fn();
      const closeFn2 = jest.fn();
       
      (env as any).waitToCloses = [closeFn1, closeFn2];

      // Mock cache
       
      (env as any).serviceCache.set('test', 'value');

      // Act
      await env.stop();

      // Assert
      expect(closeFn1).toHaveBeenCalled();
      expect(closeFn2).toHaveBeenCalled();
       
      expect((env as any).serviceCache.size).toBe(0);
    });
  });

  describe('error handling', () => {
    test('should propagate errors from createService', async () => {
      // Arrange: Mock error
      const env = new TestBaseIntegrationEnvironment({ proxy: true });
       
      (env as any).createService = mockCreateService;
      mockCreateService.mockRejectedValue(new Error('Service creation failed'));

      // Act & Assert: Expect error
      await expect(env.getPostgres()).rejects.toThrow(
        'Service creation failed'
      );
    });

    test('should handle DataSource initialization error', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });
       
      (env as any).createService = mockCreateService;
      mockCreateService.mockResolvedValue({ host: 'localhost', port: 5432 });
      const mockDataSource = {
        initialize: jest.fn().mockRejectedValue(new Error('DB init failed')),
        query: jest.fn(),
        destroy: jest.fn(),
      };
      (require('typeorm').DataSource as jest.Mock).mockImplementation(
        () => mockDataSource
      );

      // Act & Assert
      await expect(env.getPostgres()).rejects.toThrow(
        'Failed to connect to test database: Error: DB init failed'
      );
    });

    test('should handle database creation error', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });
       
      (env as any).createService = mockCreateService;
      mockCreateService.mockResolvedValue({ host: 'localhost', port: 5432 });
      const mockClientLocal = {
        connect: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockRejectedValue(new Error('Query failed')),
        end: jest.fn().mockResolvedValue(undefined),
      };
      (require('pg').Client as jest.Mock).mockImplementation(
        () => mockClientLocal
      );

      // Act & Assert
      await expect(env.getPostgres()).rejects.toThrow(
        'Failed to initialize Postgres database: Error: Query failed'
      );
    });

    test('should handle final DataSource initialization error', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });
       
      (env as any).createService = mockCreateService;
      mockCreateService.mockResolvedValue({ host: 'localhost', port: 5432 });
      const mockClientLocal = {
        connect: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockResolvedValue(undefined),
        end: jest.fn().mockResolvedValue(undefined),
      };
      (require('pg').Client as jest.Mock).mockImplementation(
        () => mockClientLocal
      );
      const mockDataSourceLocal = {
        initialize: jest
          .fn()
          .mockRejectedValue(new Error('Final DB init failed')),
        destroy: jest.fn().mockResolvedValue(undefined),
      };
      (require('typeorm').DataSource as jest.Mock).mockImplementation(
        () => mockDataSourceLocal
      );

      // Act & Assert
      await expect(env.getPostgres()).rejects.toThrow(
        'Failed to connect to test database: Error: Final DB init failed'
      );
    });
  });
});
