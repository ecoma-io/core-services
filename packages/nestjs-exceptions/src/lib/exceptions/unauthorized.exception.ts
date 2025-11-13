import { HttpStatus } from '@nestjs/common';
import { HttpException } from './http.exception';

/**
 * Represents an unauthorized exception.
 * @remarks This exception is thrown when a user is not authorized to access a resource.
 */
export class UnauthorizedException<
  TDetails = undefined,
  TMetaData = undefined,
> extends HttpException<TDetails, TMetaData> {
  /**
   * Construct an UnauthorizedException (HTTP 401).
   * @param message - {string} Error message describing the unauthorized condition.
   * @param details - {TDetails | undefined} Optional details for debugging.
   * @param metadata - {TMetaData | undefined} Optional metadata related to the error.
   * @param cause - {unknown | undefined} Optional underlying cause.
   */
  constructor(
    message: string,
    details?: TDetails,
    metadata?: TMetaData,
    cause?: unknown
  ) {
    super(
      HttpStatus.UNAUTHORIZED,
      {
        message,
        details,
        metadata,
      },
      cause
    );
  }
}
