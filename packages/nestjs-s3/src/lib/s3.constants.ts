/**
 * Default name for the S3 client if not provided by the user.
 */
export const S3_DEFAULT_CLIENT_NAME = 'default';

/**
 * Injection token for the provider containing a Map of all registered S3 clients.
 * Users can inject this Map using the `@S3Clients()` decorator.
 */
export const S3_CLIENTS_MAP = 'S3_CLIENTS_MAP';

/**
 * Metadata key used for DiscoveryModule.
 * We "tag" S3Client providers with this key so that S3Module can automatically
 * "discover" them during initialization.
 */
export const S3_CLIENT_PROVIDER_METADATA = 'S3_CLIENT_PROVIDER_METADATA';

/**
 * Internal token used to inject config from an asynchronous provider into the client factory.
 */
export const S3_TEMP_CONFIG_TOKEN = 'S3_TEMP_CONFIG_TOKEN';

/**
 * Helper function to generate a unique Injection Token for each S3 client.
 * @remarks Generates a unique injection token by prefixing 'S3_CLIENT_' and uppercasing the provided name.
 * @param {string} name - The name of the client (e.g., 'default', 'user-uploads', 'backups'). Must be a non-empty string.
 * @returns {string} A unique token string, e.g., 'S3_CLIENT_DEFAULT'.
 * @throws {Error} If the name is not a string or is empty.
 */
export const getS3ClientToken = (name: string): string => {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error('Invalid client name: must be a non-empty string.');
  }
  return `S3_CLIENT_${name.toUpperCase()}`;
};
