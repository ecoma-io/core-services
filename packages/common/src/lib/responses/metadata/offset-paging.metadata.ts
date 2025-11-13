/**
 * Offset-based paging metadata.
 *
 * @remarks
 * This structure is commonly used when clients request pages by offset and
 * page size rather than using opaque cursors.
 */
export type OffsetPagingMetadata = {
  /**
   * Total number of items across all pages.
   */
  totalItems: number;
  /**
   * Number of items returned in this page.
   */
  itemCount: number;
  /**
   * Configured number of items per page.
   */
  itemsPerPage: number;
  /**
   * Total pages available for the current `itemsPerPage`.
   */
  totalPages: number;
  /**
   * Current page number (1-based).
   */
  currentPage: number;
};
