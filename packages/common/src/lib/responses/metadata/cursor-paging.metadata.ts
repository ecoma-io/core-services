import { ID, NullableOptional } from '../../utils';

/**
 * Cursor-based paging metadata.
 *
 * @remarks
 * Use this metadata when returning results produced by cursor/pagination
 * strategies where the next/previous cursors are explicit identifiers.
 */
export type CursorPagingMetadata = {
  /**
   * Cursor value to fetch the next page (if any).
   */
  nextCursor?: NullableOptional<ID>;
  /**
   * Cursor value to fetch the previous page (if any).
   */
  prevCursor?: NullableOptional<ID>;
  /**
   * Number of items in the current page.
   */
  itemCount: number;
  /**
   * Whether there is a next page available.
   */
  hasNextPage: boolean;
  /**
   * Whether there is a previous page available.
   */
  hasPreviousPage: boolean;
};
