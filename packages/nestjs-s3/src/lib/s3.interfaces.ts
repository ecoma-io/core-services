import { LoggerService } from '@nestjs/common';
import { ModuleMetadata, Provider, Type } from '@nestjs/common/interfaces';
import { S3ClientConfig } from '@aws-sdk/client-s3';

/**
 * @description Options for connection validation and retry logic.
 */
export interface ConnectionValidationOptions {
  /**
   * @description Number of retry attempts before failing.
   * @default 5
   */
  retries?: number;

  /**
   * @description Initial delay (in milliseconds) between retry attempts.
   * Increases exponentially (exponential backoff).
   * @default 1000
   */
  retryDelay?: number;
}

/**
 * @description Basic (synchronous) configuration options for an S3 client.
 * Inherits all properties from `S3ClientConfig` from `@aws-sdk/client-s3`.
 */
export type S3ModuleOptions = {
  /**
   * @description Name identifier for this S3 client.
   * If not provided, defaults to 'default'.
   * @default 'default'
   */
  name?: string;

  /**
   * @description Configuration for connection validation during initialization.
   * Defaults to enabled with 5 retries.
   */
  connectionValidationOptions?: ConnectionValidationOptions;

  /**
   * @description Custom logger for recording information.
   * If not provided, uses the default NestJS Logger.
   */
  logger?: LoggerService;

  /**
   * @description Additional options to be passed directly to the S3Client constructor.
   * Useful for configuring options not covered by the typed S3ClientConfig interface.
   */
  extra?: Record<string, unknown>;
} & Omit<S3ClientConfig, 'logger'>;

/**
 * @description Interface for factory classes, used in 'useClass' and 'useExisting'
 * of S3ModuleAsyncOptions.
 */
export interface S3OptionsFactory {
  /**
   * @description Mandatory method to implement.
   * Returns S3ClientConfig (can be synchronous or asynchronous).
   * @returns {Promise<S3ClientConfig> | S3ClientConfig} The S3 client configuration.
   */
  createS3Options(): Promise<S3ClientConfig> | S3ClientConfig;
}

/**
 * @description Asynchronous configuration options for an S3 client.
 */
export interface S3ModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  /**
   * @description Name identifier for this S3 client.
   * If not provided, defaults to 'default'.
   * @default 'default'
   */
  name?: string;

  /**
   * @description Configuration for connection validation during initialization.
   * Defaults to enabled with 5 retries.
   */
  connectionValidationOptions?: ConnectionValidationOptions;

  /**
   * @description Custom logger for recording information.
   * If not provided, uses the default NestJS Logger.
   */
  logger?: LoggerService;

  /**
   * @description Additional options to be passed directly to the S3Client constructor.
   * Useful for configuring options not covered by the typed S3ClientConfig interface.
   */
  extra?: Record<string, unknown>;

  /**
   * @description Factory function to create S3ClientConfig.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useFactory?: (...args: any[]) => Promise<S3ClientConfig> | S3ClientConfig;

  /**
   * @description Class (factory) to create S3ClientConfig.
   * The class must implement the `S3OptionsFactory` interface.
   */
  useClass?: Type<S3OptionsFactory>;

  /**
   * @description Use an existing provider to create S3ClientConfig.
   * The provider must implement the `S3OptionsFactory` interface.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useExisting?: any;

  /**
   * @description List of providers to inject into `useFactory`, `useClass`, or `useExisting`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inject?: any[];
  /**
   * @description Additional providers to be included in the module.
   */
  extraProviders?: Provider[];
}
