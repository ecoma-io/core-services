import { IntrinsicException, IErrorResponse } from '@ecoma-io/common';

/**
 * Generic HTTP exception used as a base for specific HTTP error classes.
 * @template TDetails - Type of the optional `details` payload.
 * @template TMetaData - Type of the optional `metadata` payload.
 */
export class HttpException<
  TDetails = undefined,
  TMetaData = undefined,
> extends IntrinsicException {
  /**
   * Create a new HttpException.
   * @param status - {number} HTTP status code (e.g. 404).
   * @param response - {ErrorResponse<TDetails, TMetaData> | undefined} Optional structured error response.
   * @param cause - {unknown | undefined} Optional underlying cause for error chaining.
   */
  constructor(
    private readonly status: number,
    private response?: IErrorResponse<TDetails, TMetaData>,
    public readonly cause?: unknown
  ) {
    // Pass the public-facing message (if any) to the Error base class so
    // the thrown error has a useful `.message` when inspected.
    super(response?.message as string | undefined);
  }

  /**
   * Return the structured error response, if provided.
   * @returns {IErrorResponse<TDetails, TMetaData> | undefined} The error response object or undefined.
   */
  public getResponse(): IErrorResponse<TDetails, TMetaData> | undefined {
    return this.response;
  }

  /**
   * Return the HTTP status code associated with this exception.
   * @returns {number} The HTTP status code.
   */
  public getStatus(): number {
    return this.status;
  }
}
