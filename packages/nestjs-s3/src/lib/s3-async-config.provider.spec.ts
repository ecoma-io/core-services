import { Test } from '@nestjs/testing';
import { S3ClientConfig } from '@aws-sdk/client-s3';
import { createAsyncConfigProvider } from './s3-async-config.provider';
import { S3ModuleAsyncOptions, S3OptionsFactory } from './s3.interfaces';
import { S3_TEMP_CONFIG_TOKEN } from './s3.constants';

/**
 * Mock token to replace external dependencies in tests
 */
const MOCK_CONFIG_TOKEN = 'MOCK_CONFIG_TOKEN';

/**
 * Custom factory provider interface for testing purposes.
 * Defines the structure of a provider with a factory function and optional injections.
 * @template T - The type of the value provided by the factory.
 */
interface CustomFactoryProvider<T = unknown> {
  provide: unknown;
  useFactory: (...args: unknown[]) => Promise<T> | T;
  inject?: unknown[];
}

describe('createAsyncConfigProvider', () => {
  it('should create a factory provider with useFactory and inject', () => {
    // Arrange: Define options with useFactory, inject, and imports
    const options: S3ModuleAsyncOptions = {
      name: 'test',
      useFactory: () => ({ region: 'ap-southeast-1' }),
      inject: [MOCK_CONFIG_TOKEN],
      imports: [], // Remove external dependency
    };

    // Act: Call createAsyncConfigProvider with the options
    const providers = createAsyncConfigProvider(options);

    // Assert: Verify the provider structure and properties
    expect(providers.length).toBe(1);

    const provider = providers[0] as CustomFactoryProvider<S3ClientConfig>;

    expect(provider.provide).toBe(S3_TEMP_CONFIG_TOKEN);
    expect(provider.useFactory).toBeDefined();
    expect(provider.inject).toEqual([MOCK_CONFIG_TOKEN]);
  });

  it('should create a factory provider with useFactory but without inject when none provided', () => {
    // Arrange: Define options with useFactory but no inject
    const options: S3ModuleAsyncOptions = {
      name: 'test-no-inject',
      useFactory: () => ({ region: 'ap-southeast-2' }),
    };

    // Act: Call createAsyncConfigProvider with the options
    const providers = createAsyncConfigProvider(options);

    // Assert: Verify the provider structure and properties
    expect(providers.length).toBe(1);

    const provider = providers[0] as CustomFactoryProvider<S3ClientConfig>;

    expect(provider.provide).toBe(S3_TEMP_CONFIG_TOKEN);
    expect(provider.useFactory).toBeDefined();
    expect(provider.inject).toEqual([]);
  });

  it('should create a provider with useClass and corresponding imports', async () => {
    /**
     * Mock configuration service implementing S3OptionsFactory for testing useClass.
     */
    class ConfigService implements S3OptionsFactory {
      /**
       * Creates S3 client configuration options.
       * @returns {S3ClientConfig} The S3 client configuration with a specified region.
       */
      createS3Options(): Promise<S3ClientConfig> | S3ClientConfig {
        return { region: 'ap-southeast-3' };
      }
    }

    // Arrange: Define options with useClass
    const options: S3ModuleAsyncOptions = {
      name: 'test-use-class',
      useClass: ConfigService,
    };

    // Act: Call createAsyncConfigProvider with the options
    const providers = createAsyncConfigProvider(options);

    // Assert: Verify the providers are created correctly
    // useClass creates 2 providers: one for the class and one for the factory
    expect(providers.length).toBe(2);

    // Provider for the class
    const classProvider = providers.find(
      (p) => (p as { provide: unknown }).provide === ConfigService
    );
    expect(classProvider).toBeDefined();

    // Factory provider that uses the class provider
    const factoryProvider = providers.find(
      (p) => (p as { provide: unknown }).provide === S3_TEMP_CONFIG_TOKEN
    ) as CustomFactoryProvider<S3ClientConfig>;

    expect(factoryProvider.provide).toBe(S3_TEMP_CONFIG_TOKEN);
    expect(factoryProvider.useFactory).toBeDefined();
    // useClass must inject the class itself
    expect(factoryProvider.inject).toEqual([ConfigService]);

    // Test that the factory function works correctly
    const module = await Test.createTestingModule({
      providers: [...providers],
    }).compile();

    const configService = module.get(ConfigService);
    const config = await factoryProvider.useFactory(configService);

    expect(config).toEqual({ region: 'ap-southeast-3' });
  });

  it('should create a provider with useExisting', async () => {
    /**
     * Mock configuration service for testing useExisting.
     */
    class ConfigServiceMock {
      /**
       * Creates S3 client configuration options.
       * @returns {S3ClientConfig} The S3 client configuration with a specified region.
       */
      createS3Options(): S3ClientConfig {
        return { region: 'ap-southeast-4' };
      }
    }

    // Arrange: Define options with useExisting and register a mock service
    const ExistingToken = 'ExistingToken';

    const options: S3ModuleAsyncOptions = {
      name: 'test-use-existing',
      useExisting: ExistingToken,
    };

    // Act: Call createAsyncConfigProvider with the options
    const providers = createAsyncConfigProvider(options);

    // Assert: Verify the provider is created correctly
    // useExisting creates only 1 factory provider that relies on an existing provider
    expect(providers.length).toBe(1);

    const factoryProvider =
      providers[0] as CustomFactoryProvider<S3ClientConfig>;

    expect(factoryProvider.provide).toBe(S3_TEMP_CONFIG_TOKEN);
    expect(factoryProvider.useFactory).toBeDefined();
    // useExisting must inject the existing token
    expect(factoryProvider.inject).toEqual([ExistingToken]);

    // Test that the factory function works correctly
    const module = await Test.createTestingModule({
      providers: [
        {
          provide: ExistingToken,
          useClass: ConfigServiceMock,
        },
        ...providers,
      ],
    }).compile();

    const existingInstance = module.get(ExistingToken);
    const config = await factoryProvider.useFactory(existingInstance);

    expect(config).toEqual({ region: 'ap-southeast-4' });
  });

  it('should throw error when no factory method is provided', () => {
    // Arrange: Define invalid options without any factory method
    const options: S3ModuleAsyncOptions = {
      name: 'invalid-options',
    };

    // Act & Assert: Call createAsyncConfigProvider and expect it to throw
    expect(() => createAsyncConfigProvider(options)).toThrow(
      '[S3Module] Invalid S3ModuleAsyncOptions: "useFactory", "useClass", or "useExisting" must be provided.'
    );
  });
});
