import { LoggerService } from '@nestjs/common';
import { ListBucketsCommand, S3Client } from '@aws-sdk/client-s3';
import { ConnectionValidationOptions } from './s3.interfaces';

/**
 * Helper function for asynchronous delay (pause).
 * @remarks Creates a promise that resolves after a specified number of milliseconds, useful for implementing retries with backoff.
 * @param {number} ms - The delay time in milliseconds.
 * @returns {Promise<void>} A promise that resolves after the specified delay.
 * @internal
 */
export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Validates the connection to S3 using the ListBucketsCommand with exponential backoff retry mechanism.
 * @remarks Attempts to connect to S3 by sending a ListBucketsCommand. If the connection fails, it retries with increasing delays up to the maximum number of attempts specified in options. Logs success or failure details.
 * @param {S3Client} client - The S3Client instance to validate.
 * @param {ConnectionValidationOptions} options - Configuration options for validation, including retries and retry delay.
 * @param {string} clientName - The name of the client, used for logging purposes.
 * @param {LoggerService} logger - The logger service to record information.
 * @returns {Promise<void>} A promise that resolves if the connection is successful.
 * @throws {Error} If the connection fails after all retry attempts.
 */
export async function validateS3Client(
  client: S3Client,
  options: ConnectionValidationOptions,
  clientName: string,
  logger: LoggerService
): Promise<void> {
  const maxRetries = options.retries ?? 5;
  let currentDelay = options.retryDelay ?? 1000;
  const command = new ListBucketsCommand({});

  // Retry loop with exponential backoff
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Attempt to send the ListBuckets command to verify connection
      await client.send(command);
      logger.log(`S3 client "${clientName}" connected successfully.`);
      return; // Exit early on success
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (isLastAttempt) {
        // Log final failure and throw error
        logger.error(
          `S3 client "${clientName}" failed to connect after ${maxRetries} attempts. Error: ${errorMessage}`
        );
        throw new Error(
          `[S3Module] Failed to connect S3 client "${clientName}": ${errorMessage}`
        );
      }

      // Log retry attempt and prepare for next try
      logger.warn(
        `Failed to connect S3 client "${clientName}" (Attempt ${attempt}/${maxRetries}). Retrying in ${
          currentDelay / 1000
        }s... Error: ${errorMessage}`
      );

      // Wait for the delay, then increase it exponentially
      await delay(currentDelay);
      currentDelay *= 2;
    }
  }
}
