import { Inject, SetMetadata } from '@nestjs/common';
import {
  S3_CLIENTS_MAP,
  S3_CLIENT_PROVIDER_METADATA,
  S3_DEFAULT_CLIENT_NAME,
  getS3ClientToken,
} from './s3.constants';

/**
 * @description Decorator `@S3Client()` used to inject a specific S3 client (by name) into the constructor.
 * @param {string} [name=S3_DEFAULT_CLIENT_NAME] The name of the client. Defaults to 'default'.
 * @returns {ParameterDecorator} A parameter decorator for injecting the S3 client.
 * @example
 * constructor(
 *   @S3Client() private s3: S3Client, // Injects client 'default'
 *   @S3Client('uploads') private s3Uploads: S3Client, // Injects client 'uploads'
 * ) {}
 */
export const S3Client = (
  name: string = S3_DEFAULT_CLIENT_NAME
): ParameterDecorator => Inject(getS3ClientToken(name));

/**
 * @description Decorator `@S3Clients()` used to inject a `Map` containing ALL registered S3 clients, with the key being the name of the client.
 * @returns {ParameterDecorator} A parameter decorator for injecting the map of S3 clients.
 * @example
 * constructor(
 *   @S3Clients() private allClients: Map<string, S3Client>,
 * ) {
 *   const defaultClient = this.allClients.get('default');
 * }
 */
export const S3Clients = (): ParameterDecorator => Inject(S3_CLIENTS_MAP);

/**
 * @description Internal decorator used to "tag" S3Client providers so that DiscoveryService can find them.
 * @param {string} [name=S3_DEFAULT_CLIENT_NAME] The name of the client.
 * @returns {CustomDecorator<string>} A custom decorator for metadata.
 */
export const S3ClientProvider = (name: string = S3_DEFAULT_CLIENT_NAME) =>
  SetMetadata(S3_CLIENT_PROVIDER_METADATA, { name });
