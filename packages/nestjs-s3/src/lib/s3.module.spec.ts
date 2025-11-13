import { Logger, LoggerService, Provider } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { S3Client } from '@aws-sdk/client-s3';
import { S3Module } from './s3.module';
import { S3_DEFAULT_CLIENT_NAME, getS3ClientToken } from './s3.constants';
import { S3ModuleOptions, S3ModuleAsyncOptions } from './s3.interfaces';
import { validateS3Client } from './s3.helpers';
import { createAsyncConfigProvider } from './s3-async-config.provider';

// Mock dependencies
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
}));

jest.mock('./s3.helpers', () => ({
  validateS3Client: jest.fn(),
}));

jest.mock('./s3-async-config.provider', () => ({
  createAsyncConfigProvider: jest.fn(),
}));

/**
 * Test suite for S3Module.
 * @remarks This suite tests the static methods of S3Module, including forRoot and forRootAsync,
 * ensuring proper dynamic module creation and client configuration.
 */
describe('S3Module', () => {
  let mockLogger: LoggerService;
  let mockS3Client: jest.Mocked<S3Client>;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockS3Client = {
      destroy: jest.fn(),
    } as unknown as jest.Mocked<S3Client>;

    (S3Client as jest.Mock).mockImplementation(() => mockS3Client);
    (validateS3Client as jest.Mock).mockResolvedValue(undefined);
    (createAsyncConfigProvider as jest.Mock).mockReturnValue([
      {
        provide: 'S3_TEMP_CONFIG_TOKEN',
        useFactory: () => ({ region: 'us-east-1' }),
      },
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test suite for S3Module class definition.
   * @remarks Verifies the basic existence and type of the S3Module class.
   */
  describe('S3Module class', () => {
    // Note: Class instance tests are skipped due to complex dependency injection
    // in NestJS testing. Static methods are tested below.
    it('should be defined as a class', () => {
      // Arrange: No setup needed for class existence check
      // Act: Check if S3Module is defined
      // Assert: Verify S3Module is a function (class)
      expect(S3Module).toBeDefined();
      expect(typeof S3Module).toBe('function');
    });
  });

  /**
   * Test suite for forRoot static method.
   * @remarks Tests the forRoot method for creating dynamic modules with synchronous options.
   */
  describe('forRoot', () => {
    it('should create a global dynamic module', () => {
      // Arrange: Define options for forRoot
      const options: S3ModuleOptions = {
        region: 'us-east-1',
        name: 'test-client',
        logger: mockLogger,
      };

      // Act: Call forRoot with options
      const dynamicModule = S3Module.forRoot(options);

      // Assert: Verify dynamic module structure
      expect(dynamicModule.global).toBe(true);
      expect(dynamicModule.module).toBe(S3Module);
      expect(dynamicModule.imports).toContain(DiscoveryModule);
      expect(dynamicModule.providers).toBeDefined();
      expect(dynamicModule.exports).toBeDefined();
    });

    it('should use default logger when not provided', async () => {
      // Arrange: Define options without logger
      const options: S3ModuleOptions = {
        region: 'us-east-1',
      };

      // Act: Call forRoot and execute the provider's useFactory
      const dynamicModule = S3Module.forRoot(options);
      const provider = dynamicModule.providers?.[0] as {
        useFactory?: () => Promise<void>;
      };
      const useFactory = provider?.useFactory;

      if (useFactory) {
        await useFactory();
      }

      // Assert: Verify validateS3Client is called with default logger
      expect(validateS3Client).toHaveBeenCalledWith(
        expect.any(Object), // S3Client mock returns an object
        {},
        S3_DEFAULT_CLIENT_NAME,
        expect.any(Logger)
      );
    });

    it('should create client with custom name', async () => {
      // Arrange: Define options with custom name and logger
      const options: S3ModuleOptions = {
        region: 'us-east-1',
        name: 'custom-client',
        logger: mockLogger,
      };

      // Act: Call forRoot and execute the provider's useFactory
      const dynamicModule = S3Module.forRoot(options);
      const provider = dynamicModule.providers?.[0] as {
        provide?: string;
        useFactory?: () => Promise<void>;
      };
      const useFactory = provider?.useFactory;

      // Assert: Verify provider token and validateS3Client call
      expect(provider.provide).toBe(getS3ClientToken('custom-client'));

      if (useFactory) {
        await useFactory();
      }

      expect(validateS3Client).toHaveBeenCalledWith(
        expect.any(Object),
        {},
        'custom-client',
        mockLogger
      );
    });
  });

  /**
   * Test suite for forRootAsync static method.
   * @remarks Tests the forRootAsync method for creating dynamic modules with asynchronous options.
   */
  describe('forRootAsync', () => {
    it('should create a global dynamic module with useFactory', () => {
      // Arrange: Define async options with useFactory
      const options: S3ModuleAsyncOptions = {
        useFactory: () => ({ region: 'us-east-1' }),
        logger: mockLogger,
      };

      // Act: Call forRootAsync with options
      const dynamicModule = S3Module.forRootAsync(options);

      // Assert: Verify dynamic module structure
      expect(dynamicModule.global).toBe(true);
      expect(dynamicModule.module).toBe(S3Module);
      expect(dynamicModule.imports).toContain(DiscoveryModule);
      expect(dynamicModule.providers).toBeDefined();
      expect(dynamicModule.exports).toBeDefined();
    });

    it('should create client with default name using useFactory', async () => {
      // Arrange: Define async options with useFactory and logger
      const options: S3ModuleAsyncOptions = {
        useFactory: () => ({ region: 'us-east-1' }),
        logger: mockLogger,
      };

      // Act: Call forRootAsync and execute the client's useFactory
      const dynamicModule = S3Module.forRootAsync(options);
      const provider = dynamicModule.providers?.[1] as {
        useFactory?: (config: { region: string }) => Promise<void>;
      }; // Second provider is the client
      const useFactory = provider?.useFactory;

      if (useFactory) {
        await useFactory({ region: 'us-east-1' });
      }

      // Assert: Verify validateS3Client is called with default name
      expect(validateS3Client).toHaveBeenCalledWith(
        expect.any(Object),
        {},
        S3_DEFAULT_CLIENT_NAME,
        mockLogger
      );
    });

    it('should create client with custom name using useFactory', async () => {
      // Arrange: Define async options with custom name, useFactory, and logger
      const options: S3ModuleAsyncOptions = {
        name: 'async-client',
        useFactory: () => ({ region: 'us-east-1' }),
        logger: mockLogger,
      };

      // Act: Call forRootAsync and execute the client's useFactory
      const dynamicModule = S3Module.forRootAsync(options);
      const provider = dynamicModule.providers?.[1] as {
        useFactory?: (config: { region: string }) => Promise<void>;
      };
      const useFactory = provider?.useFactory;

      if (useFactory) {
        await useFactory({ region: 'us-east-1' });
      }

      // Assert: Verify validateS3Client is called with custom name
      expect(validateS3Client).toHaveBeenCalledWith(
        expect.any(Object),
        {},
        'async-client',
        mockLogger
      );
    });

    it('should include extraProviders in the module providers', () => {
      // Arrange: Define extra providers to include
      const extraProviders: Provider[] = [
        {
          provide: 'EXTRA_SERVICE',
          useValue: { test: 'value' },
        },
        {
          provide: 'ANOTHER_SERVICE',
          useClass: class TestService {},
        },
      ];

      const options: S3ModuleAsyncOptions = {
        useFactory: () => ({ region: 'us-east-1' }),
        extraProviders,
      };

      // Act: Call forRootAsync with extraProviders
      const dynamicModule = S3Module.forRootAsync(options);

      // Assert: Verify extraProviders are included in the providers array
      expect(dynamicModule.providers).toBeDefined();
      expect(dynamicModule.providers).toContain(extraProviders[0]);
      expect(dynamicModule.providers).toContain(extraProviders[1]);
    });
  });
});
