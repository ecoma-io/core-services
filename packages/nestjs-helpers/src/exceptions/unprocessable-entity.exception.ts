import { HttpStatus } from '@nestjs/common';
import { HttpException } from './http.exception';

/**
 * Represents an HTTP 422 Unprocessable Entity exception.
 * This exception is thrown when the server understands the content type of the request entity,
 * and the syntax of the request entity is correct, but it was unable to process the contained instructions.
 *
 * @template TDetails - The type of additional details provided with the exception.
 * @template TMetaData - The type of metadata provided with the exception.
 */
export class UnprocessableEntityException<
  TDetails = undefined,
  TMetaData = undefined,
> extends HttpException<TDetails, TMetaData> {
  /**
   * Creates an instance of UnprocessableEntityException (HTTP 422).
   * @param message - {string} Human-readable error message.
   * @param details - {TDetails | undefined} Optional details describing validation errors.
   * @param metadata - {TMetaData | undefined} Optional metadata for diagnostics.
   * @param cause - {unknown | undefined} Optional underlying cause.
   */
  constructor(
    message: string,
    details?: TDetails,
    metadata?: TMetaData,
    cause?: unknown
  ) {
    super(
      HttpStatus.UNPROCESSABLE_ENTITY,
      {
        message,
        details,
        metadata,
      },
      cause
    );
  }
}
