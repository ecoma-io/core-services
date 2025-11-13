import { ClassConstructor } from 'class-transformer';
import { expandEnv } from '@ecoma-io/expand-env';
import { validateConfig } from './validate-config';

/**
 * @remarks Base class for configuration services that handles expansion and validation of environment variables.
 * It ensures environment variables are processed once per application lifecycle using a static property.
 * @template T - The type of the validated configuration object, extending a plain object.
 */
export abstract class BaseConfigService<T extends object> {
  private static environments: unknown;

  /**
   * @remarks Initializes the configuration service by expanding and validating environment variables if not already done.
   * Uses a static property to cache the validated environments across instances.
   * @param processEnvironmentValidator - The class constructor used to validate the environment configuration.
   * @throws Will throw an error if validation fails, as handled by `validateConfig`.
   */
  constructor(processEnvironmentValidator: ClassConstructor<T>) {
    if (!BaseConfigService.environments) {
      const env = expandEnv(process.env as Record<string, string>);
      BaseConfigService.environments = validateConfig<T>(
        env,
        processEnvironmentValidator
      );
    }
  }

  /**
   * @remarks Retrieves the validated environment configuration object.
   * @returns The validated configuration object of type T.
   */
  protected get environments(): T {
    return BaseConfigService.environments as T;
  }
}
