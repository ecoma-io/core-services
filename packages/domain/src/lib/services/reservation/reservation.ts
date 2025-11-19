/**
 * Generic Reservation abstraction for domain-level uniqueness reservation.
 *
 * @remarks
 * This interface represents a universal "reserve -> confirm -> release"
 * pattern. Implementations are infra adapters (Postgres/Redis) and live
 * outside the domain package. Keep this API pure and IO agnostic.
 */
export type ReservationStatus =
  | 'reserved'
  | 'committed'
  | 'released'
  | 'expired'
  | 'not_found';

export interface IReservationResult {
  status: ReservationStatus;
  ownerId?: string; // existing owner aggregate id when conflict
  reservedUntil?: string; // ISO timestamp
}

export interface IReservation<TValue = string, TOwner = string> {
  /**
   * Reserve a value for an owner with optional idempotency key and ttl.
   */
  reserve(
    value: TValue,
    owner: TOwner,
    idempotencyKey?: string,
    ttlMs?: number
  ): Promise<IReservationResult>;

  /**
   * Confirm a reserved value (mark as committed to an aggregateId).
   */
  confirm(value: TValue, owner: TOwner): Promise<void>;

  /**
   * Release a reservation (free the value).
   */
  release(value: TValue): Promise<void>;

  /**
   * Get current reservation status for a value.
   */
  status(value: TValue): Promise<IReservationResult>;
}
