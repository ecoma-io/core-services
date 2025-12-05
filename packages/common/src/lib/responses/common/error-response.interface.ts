/**
 * Standardized error response for service-to-service and API responses.
 *
 * @template TDetails - Type of the optional `details` payload.
 * @template TMetaData - Type of the optional `metadata` payload.
 * @remarks
 * This shape is intentionally simple: a required `message` with optional
 * `details` and `metadata`. Prefer structured `details` objects to help
 * callers programmatically react to errors.
 */
export interface IErrorResponse<TDetails = undefined, TMetaData = undefined> {
  /**
   * Human-readable error message describing the problem.
   * @example "User not found"
   */
  message: string;

  /**
   * Optional typed details for programmatic consumers.
   */
  details?: TDetails;

  /**
   * Optional metadata related to the error (e.g., correlation id).
   */
  metadata?: TMetaData;
}
