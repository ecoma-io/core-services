import { HttpStatus } from '@nestjs/common';
import { HttpException } from './http.exception';

/**
 * Exception representing HTTP 409 Conflict.
 * @template TDetails - Type for optional details.
 * @template TMetaData - Type for optional metadata.
 */
export class ConflictException<
  TDetails = undefined,
  TMetaData = undefined,
> extends HttpException<TDetails, TMetaData> {
  /**
   * Construct a ConflictException.
   * @param message - {string} Human-readable error message.
   * @param details - {TDetails | undefined} Optional additional error details.
   * @param metadata - {TMetaData | undefined} Optional metadata.
   * @param cause - {unknown | undefined} Optional underlying cause for chaining.
   */
  constructor(
    message: string,
    details?: TDetails,
    metadata?: TMetaData,
    cause?: unknown
  ) {
    super(
      HttpStatus.CONFLICT,
      {
        message,
        details,
        metadata,
      },
      cause
    );
  }
}
