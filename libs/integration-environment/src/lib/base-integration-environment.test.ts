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

jest.mock('mongodb', () => ({
  MongoClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    db: jest.fn().mockReturnValue({}),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@elastic/elasticsearch', () => ({
  Client: jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('amqplib', () => ({
  connect: jest.fn().mockResolvedValue({
    createChannel: jest.fn().mockResolvedValue({
      close: jest.fn().mockResolvedValue(undefined),
    }),
    close: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('@eventstore/db-client', () => ({
  EventStoreDBClient: {
    connectionString: jest.fn().mockReturnValue({
      dispose: jest.fn(),
    }),
  },
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
    process.env['MONGO_PORT'] = '27017';
    process.env['MONGO_USERNAME'] = 'mongo';
    process.env['MONGO_PASSWORD'] = 'mongo';
    process.env['RABBITMQ_AMQP_PORT'] = '5672';
    process.env['RABBITMQ_USERNAME'] = 'rabbitmq';
    process.env['RABBITMQ_PASSWORD'] = 'rabbitmq';
    process.env['ESDB_HTTP_PORT'] = '2113';
    process.env['ELASTIC_PORT'] = '9200';
    process.env['ELASTIC_PASSWORD'] = 'elastic';

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
    delete process.env['MONGO_PORT'];
    delete process.env['MONGO_USERNAME'];
    delete process.env['MONGO_PASSWORD'];
    delete process.env['RABBITMQ_AMQP_PORT'];
    delete process.env['RABBITMQ_USERNAME'];
    delete process.env['RABBITMQ_PASSWORD'];
    delete process.env['ESDB_HTTP_PORT'];
    delete process.env['ELASTIC_PORT'];
    delete process.env['ELASTIC_PASSWORD'];
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

    test('should throw error if MONGO_PORT is not set', () => {
      delete process.env['MONGO_PORT'];
      expect(() => new TestBaseIntegrationEnvironment({ proxy: true })).toThrow(
        'Environment variable MONGO_PORT is required but not set'
      );
    });

    test('should throw error if MONGO_USERNAME is not set', () => {
      delete process.env['MONGO_USERNAME'];
      expect(() => new TestBaseIntegrationEnvironment({ proxy: true })).toThrow(
        'Environment variable MONGO_USERNAME is required but not set'
      );
    });

    test('should throw error if MONGO_PASSWORD is not set', () => {
      delete process.env['MONGO_PASSWORD'];
      expect(() => new TestBaseIntegrationEnvironment({ proxy: true })).toThrow(
        'Environment variable MONGO_PASSWORD is required but not set'
      );
    });

    test('should throw error if RABBITMQ_AMQP_PORT is not set', () => {
      delete process.env['RABBITMQ_AMQP_PORT'];
      expect(() => new TestBaseIntegrationEnvironment({ proxy: true })).toThrow(
        'Environment variable RABBITMQ_AMQP_PORT is required but not set'
      );
    });

    test('should throw error if RABBITMQ_USERNAME is not set', () => {
      delete process.env['RABBITMQ_USERNAME'];
      expect(() => new TestBaseIntegrationEnvironment({ proxy: true })).toThrow(
        'Environment variable RABBITMQ_USERNAME is required but not set'
      );
    });

    test('should throw error if RABBITMQ_PASSWORD is not set', () => {
      delete process.env['RABBITMQ_PASSWORD'];
      expect(() => new TestBaseIntegrationEnvironment({ proxy: true })).toThrow(
        'Environment variable RABBITMQ_PASSWORD is required but not set'
      );
    });

    test('should throw error if ESDB_HTTP_PORT is not set', () => {
      delete process.env['ESDB_HTTP_PORT'];
      expect(() => new TestBaseIntegrationEnvironment({ proxy: true })).toThrow(
        'Environment variable ESDB_HTTP_PORT is required but not set'
      );
    });

    test('should throw error if ELASTIC_PORT is not set', () => {
      delete process.env['ELASTIC_PORT'];
      expect(() => new TestBaseIntegrationEnvironment({ proxy: true })).toThrow(
        'Environment variable ELASTIC_PORT is required but not set'
      );
    });

    test('should throw error if ELASTIC_PASSWORD is not set', () => {
      delete process.env['ELASTIC_PASSWORD'];
      expect(() => new TestBaseIntegrationEnvironment({ proxy: true })).toThrow(
        'Environment variable ELASTIC_PASSWORD is required but not set'
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

  describe('getMongo', () => {
    let mockMongoClient: any;

    beforeEach(() => {
      const mockDb = {};
      mockMongoClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        db: jest.fn().mockReturnValue(mockDb),
        close: jest.fn().mockResolvedValue(undefined),
      };
      (require('mongodb').MongoClient as jest.Mock).mockImplementation(
        () => mockMongoClient
      );
    });

    test('should create service for MongoDB, initialize MongoClient, connect, and return with client and database', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });

      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 27017 };
      mockCreateService.mockResolvedValue(mockService);

      // Act
      const result = await env.getMongo();

      // Assert
      expect(mockCreateService).toHaveBeenCalledWith('mongo-mock-id', '27017');
      expect(require('mongodb').MongoClient).toHaveBeenCalledWith(
        'mongodb://mongo:mongo@localhost:27017'
      );
      expect(mockMongoClient.connect).toHaveBeenCalled();
      expect(mockMongoClient.db).toHaveBeenCalledWith('test_mock-id');
      expect(result).toEqual({
        mongoClient: mockMongoClient,
        db: {},
        databaseName: 'test_mock-id',
        ...mockService,
      });
    });

    test('should cache the service and return the same instance on subsequent calls', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });

      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 27017 };
      mockCreateService.mockResolvedValue(mockService);

      // Act: Call method twice
      const result1 = await env.getMongo();
      const result2 = await env.getMongo();

      // Assert: createService called only once
      expect(mockCreateService).toHaveBeenCalledTimes(1);
      expect(result1).toBe(result2); // Same reference
    });

    test('should handle MongoDB connection error', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });

      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 27017 };
      mockCreateService.mockResolvedValue(mockService);
      mockMongoClient.connect.mockRejectedValueOnce(
        new Error('Connection failed')
      );

      // Act & Assert
      await expect(env.getMongo()).rejects.toThrow(
        'Failed to connect to MongoDB: Error: Connection failed'
      );
    });
  });

  describe('getElasticsearch', () => {
    let mockElasticsearchClient: any;

    beforeEach(() => {
      mockElasticsearchClient = {
        ping: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
      };
      (require('@elastic/elasticsearch').Client as jest.Mock).mockImplementation(
        () => mockElasticsearchClient
      );
    });

    test('should create service for Elasticsearch, initialize client, ping, and return with client and indexPrefix', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });

      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 9200 };
      mockCreateService.mockResolvedValue(mockService);

      // Act
      const result = await env.getElasticsearch();

      // Assert
      expect(mockCreateService).toHaveBeenCalledWith(
        'elasticsearch-mock-id',
        '9200'
      );
      expect(require('@elastic/elasticsearch').Client).toHaveBeenCalledWith({
        node: 'http://localhost:9200',
        auth: {
          username: 'elastic',
          password: 'elastic',
        },
      });
      expect(mockElasticsearchClient.ping).toHaveBeenCalled();
      expect(result).toEqual({
        elasticsearchClient: mockElasticsearchClient,
        indexPrefix: 'test_mock-id',
        ...mockService,
      });
    });

    test('should cache the service and return the same instance on subsequent calls', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });

      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 9200 };
      mockCreateService.mockResolvedValue(mockService);

      // Act: Call method twice
      const result1 = await env.getElasticsearch();
      const result2 = await env.getElasticsearch();

      // Assert: createService called only once
      expect(mockCreateService).toHaveBeenCalledTimes(1);
      expect(result1).toBe(result2); // Same reference
    });

    test('should handle Elasticsearch ping error', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });

      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 9200 };
      mockCreateService.mockResolvedValue(mockService);
      mockElasticsearchClient.ping.mockRejectedValueOnce(
        new Error('Ping failed')
      );

      // Act & Assert
      await expect(env.getElasticsearch()).rejects.toThrow(
        'Failed to connect to Elasticsearch: Error: Ping failed'
      );
    });
  });

  describe('getRabbitMQ', () => {
    let mockConnection: any;
    let mockChannel: any;

    beforeEach(() => {
      mockChannel = {
        close: jest.fn().mockResolvedValue(undefined),
      };
      mockConnection = {
        createChannel: jest.fn().mockResolvedValue(mockChannel),
        close: jest.fn().mockResolvedValue(undefined),
      };
      (require('amqplib').connect as jest.Mock).mockResolvedValue(
        mockConnection
      );
    });

    test('should create service for RabbitMQ, connect, create channel, and return with connection and channel', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });

      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 5672 };
      mockCreateService.mockResolvedValue(mockService);

      // Act
      const result = await env.getRabbitMQ();

      // Assert
      expect(mockCreateService).toHaveBeenCalledWith('rabbitmq-mock-id', '5672');
      expect(require('amqplib').connect).toHaveBeenCalledWith(
        'amqp://rabbitmq:rabbitmq@localhost:5672'
      );
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(result).toEqual({
        connection: mockConnection,
        channel: mockChannel,
        ...mockService,
      });
    });

    test('should cache the service and return the same instance on subsequent calls', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });

      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 5672 };
      mockCreateService.mockResolvedValue(mockService);

      // Act: Call method twice
      const result1 = await env.getRabbitMQ();
      const result2 = await env.getRabbitMQ();

      // Assert: createService called only once
      expect(mockCreateService).toHaveBeenCalledTimes(1);
      expect(result1).toBe(result2); // Same reference
    });

    test('should handle RabbitMQ connection error', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });

      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 5672 };
      mockCreateService.mockResolvedValue(mockService);
      (require('amqplib').connect as jest.Mock).mockRejectedValueOnce(
        new Error('Connection failed')
      );

      // Act & Assert
      await expect(env.getRabbitMQ()).rejects.toThrow(
        'Failed to connect to RabbitMQ: Error: Connection failed'
      );
    });

    test('should handle RabbitMQ channel creation error', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });

      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 5672 };
      mockCreateService.mockResolvedValue(mockService);
      mockConnection.createChannel.mockRejectedValueOnce(
        new Error('Channel creation failed')
      );

      // Act & Assert
      await expect(env.getRabbitMQ()).rejects.toThrow(
        'Failed to connect to RabbitMQ: Error: Channel creation failed'
      );
    });
  });

  describe('getEventStoreDB', () => {
    let mockEventStoreClient: any;

    beforeEach(() => {
      mockEventStoreClient = {
        dispose: jest.fn(),
      };
      (
        require('@eventstore/db-client').EventStoreDBClient
          .connectionString as jest.Mock
      ).mockReturnValue(mockEventStoreClient);
    });

    test('should create service for EventStoreDB, initialize client, and return with client and streamPrefix', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });

      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 2113 };
      mockCreateService.mockResolvedValue(mockService);

      // Act
      const result = await env.getEventStoreDB();

      // Assert
      expect(mockCreateService).toHaveBeenCalledWith(
        'eventstoredb-mock-id',
        '2113'
      );
      expect(
        require('@eventstore/db-client').EventStoreDBClient.connectionString
      ).toHaveBeenCalledWith('esdb://localhost:2113?tls=false');
      expect(result).toEqual({
        eventStoreClient: mockEventStoreClient,
        streamPrefix: 'test_mock-id',
        ...mockService,
      });
    });

    test('should cache the service and return the same instance on subsequent calls', async () => {
      // Arrange
      const env = new TestBaseIntegrationEnvironment({ proxy: true });

      (env as any).createService = mockCreateService;
      const mockService = { host: 'localhost', port: 2113 };
      mockCreateService.mockResolvedValue(mockService);

      // Act: Call method twice
      const result1 = await env.getEventStoreDB();
      const result2 = await env.getEventStoreDB();

      // Assert: createService called only once
      expect(mockCreateService).toHaveBeenCalledTimes(1);
      expect(result1).toBe(result2); // Same reference
    });
  });
});
