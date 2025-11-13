import { HttpStatus } from '@nestjs/common';
import { HttpException } from './http.exception';

/**
 * Represents a Forbidden (403) HTTP exception.
 * This exception is thrown when a user attempts to access a resource they do not have permission to access.
 * @template TDetails - Optional type for additional error details.
 * @template TMetaData - Optional type for additional metadata.
 */
export class ForbiddenException<
  TDetails = undefined,
  TMetaData = undefined,
> extends HttpException<TDetails, TMetaData> {
  /**
   * Creates a new ForbiddenException instance.
   * @param message - Optional error message describing the forbidden access.
   * @param details - Optional additional details about the error.
   * @param metadata - Optional metadata associated with the error.
   * @param options - Optional HTTP exception options.
   */
  constructor(
    message: string,
    details?: TDetails,
    metadata?: TMetaData,
    cause?: unknown
  ) {
    super(
      HttpStatus.FORBIDDEN,
      {
        message,
        details,
        metadata,
      },
      cause
    );
  }
}
