import { HttpStatus } from '@nestjs/common';
import { HttpException } from './http.exception';

/**
 * Exception representing HTTP 404 Not Found.
 * @template TDetails - Type for optional details object.
 * @template TMetaData - Type for optional metadata object.
 */
export class NotFoundException<
  TDetails = undefined,
  TMetaData = undefined,
> extends HttpException<TDetails, TMetaData> {
  /**
   * Construct a NotFoundException.
   * @param message - {string} Error message describing the missing resource.
   * @param details - {TDetails | undefined} Optional details about the missing resource.
   * @param metadata - {TMetaData | undefined} Optional metadata associated with the error.
   * @param cause - {unknown | undefined} Optional underlying cause for error chaining.
   */
  constructor(
    message: string,
    details?: TDetails,
    metadata?: TMetaData,
    cause?: unknown
  ) {
    super(
      HttpStatus.NOT_FOUND,
      {
        message,
        details,
        metadata,
      },
      cause
    );
  }
}
