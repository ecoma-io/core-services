/**
 * @description Main module of the library, responsible for assembling and managing the lifecycle.
 */

import 'reflect-metadata'; // Necessary for using Reflect.defineMetadata for programmatic tagging
import {
  DynamicModule,
  Inject,
  Logger,
  Module,
  OnModuleDestroy,
  OnModuleInit,
  Provider,
} from '@nestjs/common';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import {
  S3_CLIENTS_MAP,
  S3_CLIENT_PROVIDER_METADATA,
  S3_DEFAULT_CLIENT_NAME,
  S3_TEMP_CONFIG_TOKEN,
  getS3ClientToken,
} from './s3.constants';
import { S3ModuleAsyncOptions, S3ModuleOptions } from './s3.interfaces';
import { createAsyncConfigProvider } from './s3-async-config.provider';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { validateS3Client } from './s3.helpers';

/**
 * Central provider containing a Map of all S3 clients.
 * This is a singleton Map, provided by S3Module
 * and updated by DynamicModules (from forRoot/forRootAsync).
 */
const s3ClientsMapProvider: Provider = {
  provide: S3_CLIENTS_MAP,
  useValue: new Map<string, S3Client>(),
};

/**
 * @description S3Module is the core module for managing AWS S3 clients in a NestJS application.
 * It handles client discovery, registration, and lifecycle management.
 * @remarks This module uses DiscoveryService to automatically populate a central Map of S3 clients
 * based on metadata-tagged providers. It supports both synchronous and asynchronous client configurations.
 */
@Module({
  imports: [DiscoveryModule],
  providers: [s3ClientsMapProvider],
  exports: [s3ClientsMapProvider],
})
export class S3Module implements OnModuleInit, OnModuleDestroy {
  /**
   * @param discoveryService - Service for discovering providers with metadata.
   * @param clientsMap - Injected Map containing all registered S3 clients.
   * @param logger - Logger instance for logging module events.
   */
  constructor(
    private readonly discoveryService: DiscoveryService,
    @Inject(S3_CLIENTS_MAP)
    private readonly clientsMap: Map<string, S3Client>,
    private readonly logger: Logger
  ) {}

  /**
   * @description Called when the module initializes. Uses DiscoveryService to find all S3Client providers
   * tagged with metadata and adds them to the central Map.
   * @remarks This method iterates through discovered providers, extracts the client name from metadata,
   * and populates the clientsMap. It handles multiple fallback strategies for metadata retrieval.
   */
  onModuleInit(): void {
    this.logger.log('Discovering S3 client providers...');
    const providers: InstanceWrapper[] = this.discoveryService.getProviders({
      metadataKey: S3_CLIENT_PROVIDER_METADATA,
    });

    for (const provider of providers) {
      const clientName = this.extractClientName(provider);
      if (clientName && provider.instance) {
        this.logger.log(
          `Populating S3 client "${clientName}" into clients map.`
        );
        this.clientsMap.set(clientName, provider.instance as S3Client);
      } else {
        this.logger.warn(
          `Found a provider with S3 metadata but no instance or name. Provider: ${
            provider.name ||
            (provider.token ? provider.token.toString() : 'unknown')
          }`
        );
      }
    }
  }

  /**
   * @description Extracts the client name from provider metadata using multiple fallback strategies.
   * @param provider - The InstanceWrapper to extract metadata from.
   * @returns {string | undefined} The client name if found, otherwise undefined.
   * @remarks First checks the provider instance, then metatype, and finally legacy metadata.
   */
  private extractClientName(provider: InstanceWrapper): string | undefined {
    // Check metadata on provider instance (for Factory/Value Providers)
    if (provider.instance) {
      const metadata = Reflect.getMetadata(
        S3_CLIENT_PROVIDER_METADATA,
        provider.instance
      );
      if (metadata?.name) return metadata.name;
    }

    // Fallback: Check metadata on metatype (for Class Providers or legacy)
    if (provider.metatype) {
      const metadata = Reflect.getMetadata(
        S3_CLIENT_PROVIDER_METADATA,
        provider.metatype
      );
      if (metadata?.name) return metadata.name;
    }

    // Final fallback for legacy logic
    const legacyMetadata = (
      provider.metatype as unknown as Record<string, unknown>
    )?.['__metadata__'] as
      | Record<string, { name: string | undefined }>
      | undefined;

    return legacyMetadata?.[S3_CLIENT_PROVIDER_METADATA]?.name as
      | string
      | undefined;
  }

  /**
   * @description Called when the application shuts down. Destroys all S3 clients to release resources and connections.
   * @remarks Iterates through the clientsMap, calls destroy on each client, and clears the map.
   * Logs success or errors during destruction.
   */
  onModuleDestroy(): void {
    this.logger.log('Destroying all S3 clients...');
    for (const [clientName, client] of this.clientsMap.entries()) {
      try {
        client.destroy();
        this.logger.log(`S3 client "${clientName}" destroyed successfully.`);
      } catch (error) {
        this.logger.error(
          `Error destroying S3 client "${clientName}": ${(error as Error).message}`
        );
      }
    }
    this.clientsMap.clear();
  }

  /**
   * @description Registers an S3 client synchronously.
   * @param options - Configuration options for the S3 client.
   * @returns {DynamicModule} A dynamic module with the configured S3 client provider.
   * @remarks Extracts configuration, creates a client with validation, and tags it with metadata.
   * Uses useFactory for async validation during client creation.
   */
  static forRoot(options: S3ModuleOptions): DynamicModule {
    const clientName = options.name ?? S3_DEFAULT_CLIENT_NAME;
    const token = getS3ClientToken(clientName);

    // Extract config, removing 'name' and setting defaults
    const {
      name: _, // Remove 'name' from config
      connectionValidationOptions = {},
      logger: customLogger,
      extra,
      ...s3Config
    } = options;

    const logger = customLogger ?? new Logger('S3Module');
    const s3Logger = { ...logger, info: logger.log.bind(logger) };

    const clientProvider: Provider = {
      provide: token,
      useFactory: async (): Promise<S3Client> => {
        const client = new S3Client({
          ...s3Config,
          ...extra,
          logger: s3Logger,
        } as S3ClientConfig);

        await validateS3Client(
          client,
          connectionValidationOptions,
          clientName,
          logger
        );
        return client;
      },
    };

    Reflect.defineMetadata(
      S3_CLIENT_PROVIDER_METADATA,
      { name: clientName },
      clientProvider
    );

    return {
      global: true,
      module: S3Module,
      imports: [DiscoveryModule],
      providers: [clientProvider, { provide: Logger, useValue: logger }],
      exports: [clientProvider],
    };
  }

  /**
   * @description Registers an S3 client asynchronously.
   * @param options - Asynchronous configuration options for the S3 client.
   * @returns {DynamicModule} A dynamic module with the configured async S3 client provider.
   * @remarks Creates an async config provider and a client provider that injects the config.
   * Validates the client after creation using the provided validation options.
   */
  static forRootAsync(options: S3ModuleAsyncOptions): DynamicModule {
    const clientName = options.name ?? S3_DEFAULT_CLIENT_NAME;
    const token = getS3ClientToken(clientName);

    const validationOptions = options.connectionValidationOptions ?? {};
    const customLogger = options.logger;
    const logger = customLogger ?? new Logger('S3Module');
    const s3Logger = { ...logger, info: logger.log.bind(logger) };
    const extra = options.extra;

    const clientProvider: Provider = {
      provide: token,
      useFactory: async (config: S3ClientConfig): Promise<S3Client> => {
        const client = new S3Client({
          ...config,
          ...extra,
          logger: s3Logger,
        } as S3ClientConfig);

        await validateS3Client(client, validationOptions, clientName, logger);
        return client;
      },
      inject: [S3_TEMP_CONFIG_TOKEN],
    };

    Reflect.defineMetadata(
      S3_CLIENT_PROVIDER_METADATA,
      { name: clientName },
      clientProvider
    );

    const asyncConfigProvider = createAsyncConfigProvider(options);

    return {
      global: true,
      module: S3Module,
      imports: [...(options.imports ?? []), DiscoveryModule],
      providers: [
        ...asyncConfigProvider,
        clientProvider,
        { provide: Logger, useValue: logger },
        ...(options.extraProviders ?? []),
      ],
      exports: [clientProvider],
    };
  }
}
