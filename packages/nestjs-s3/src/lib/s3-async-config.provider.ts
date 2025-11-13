import { Provider } from '@nestjs/common';
import { S3_TEMP_CONFIG_TOKEN } from './s3.constants';
import { S3ModuleAsyncOptions, S3OptionsFactory } from './s3.interfaces';

/**
 * Creates an array of providers necessary to handle asynchronous configuration options.
 * It handles three cases: `useFactory`, `useClass`, and `useExisting`.
 *
 * @description This function generates providers for S3 module async configuration,
 * ensuring proper dependency injection based on the provided options.
 * @param {S3ModuleAsyncOptions} options - The asynchronous options for S3 module configuration.
 * @returns {Provider[]} An array of providers (typically 1 or 2 providers).
 * @throws {Error} If no factory method is provided in the options.
 */
export function createAsyncConfigProvider(
  options: S3ModuleAsyncOptions
): Provider[] {
  // Handle the useFactory case
  if (options.useFactory) {
    return [
      {
        provide: S3_TEMP_CONFIG_TOKEN,
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
    ];
  }

  // Handle the useClass case
  if (options.useClass) {
    return [
      // Provide the class itself for Nest to inject and manage
      {
        provide: options.useClass,
        useClass: options.useClass,
      },
      // Provide the config token by injecting the useClass and calling createS3Options()
      {
        provide: S3_TEMP_CONFIG_TOKEN,
        useFactory: (factory: S3OptionsFactory) => factory.createS3Options(),
        inject: [options.useClass],
      },
    ];
  }

  // Handle the useExisting case
  if (options.useExisting) {
    return [
      {
        provide: S3_TEMP_CONFIG_TOKEN,
        useFactory: (factory: S3OptionsFactory) => factory.createS3Options(),
        inject: [options.useExisting],
      },
    ];
  }

  // This case should not occur if the DTO is valid
  throw new Error(
    '[S3Module] Invalid S3ModuleAsyncOptions: "useFactory", "useClass", or "useExisting" must be provided.'
  );
}
