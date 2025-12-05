import {
  ISuccessResponse,
  IErrorResponse,
  CursorPagingMetadata,
  OffsetPagingMetadata,
} from '../../index';
// factories are intentionally not imported here to keep tests focused on types and
// runtime shapes; factories are covered by their own tests if added.

describe('responses shapes - compile-time and runtime checks', () => {
  /**
   * Helper asserting a value is accepted by the SuccessResponse generic.
   * This provides compile-time checking while still allowing runtime asserts.
   */
  function acceptSuccess<TData = unknown, TMeta = unknown>(
    v: ISuccessResponse<TData, TMeta>
  ) {
    return v;
  }

  /** Helper asserting a value is accepted by the ErrorResponse generic. */
  function acceptError<TDetails = unknown, TMeta = unknown>(
    v: IErrorResponse<TDetails, TMeta>
  ) {
    return v;
  }

  test('SuccessResponse accepts typical payloads and runtime fields', () => {
    // Arrange: build an offset paging metadata payload and data object
    const paging: OffsetPagingMetadata = {
      totalItems: 100,
      itemCount: 10,
      itemsPerPage: 10,
      totalPages: 10,
      currentPage: 1,
    };
    const data = { id: 'u1' };

    // Act: create a success response object
    const success = acceptSuccess<{ id: string }, OffsetPagingMetadata>({
      message: 'ok',
      data,
      metadata: paging,
    });

    // Assert: runtime structure matches expectations
    expect(success.message).toBeDefined();
    expect(success.data).toEqual(data);
    expect((success.metadata as OffsetPagingMetadata).currentPage).toBe(1);
  });

  test('ErrorResponse requires message and can carry details/metadata', () => {
    // Arrange
    const details = { code: 'NOT_FOUND' };
    const meta: CursorPagingMetadata = {
      nextCursor: undefined,
      prevCursor: null,
      itemCount: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    };

    // Act: build an error response object
    const err = acceptError<{ code: string }, CursorPagingMetadata>({
      message: 'Not found',
      details,
      metadata: meta,
    });

    // Assert
    expect(typeof err.message).toBe('string');
    expect((err.details as { code: string }).code).toBe('NOT_FOUND');
    expect((err.metadata as CursorPagingMetadata).hasNextPage).toBe(false);
  });
});
