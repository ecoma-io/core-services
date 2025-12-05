/**
 * Standardized success response used across microservices.
 *
 * @template TData - Type of the data payload. When omitted this defaults to `undefined`.
 * @template TMetaData - Type of the optional metadata object.
 * @remarks
 * Keep this interface minimal and serializable. Prefer creating helper
 * factories (e.g. `createSuccessResponse`) when constructing responses at runtime.
 */
export interface ISuccessResponse<TData = undefined, TMetaData = undefined> {
  /**
   * Optional human-friendly message describing the response.
   */
  message?: string;
  /**
   * Optional data payload containing the requested resource(s).
   */
  data?: TData;
  /**
   * Optional metadata (paging, counts, etc.).
   */
  metadata?: TMetaData;
}
