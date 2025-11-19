/**
 * Email Reservation Service (Unique Value Reservation Pattern)
 *
 * @remarks
 * Extends IReservation from @ecoma-io/domain to enforce email uniqueness
 * in Event Sourcing systems (ADR-IAM-7).
 *
 * Orchestration flow (Command Handler):
 * 1. reserve(email, commandId, idempotencyKey)
 * 2. If success → append UserRegistered event
 * 3. confirm(email, userId) after event persisted
 * 4. If failure → release(email)
 *
 * @see ADR-IAM-7 — Chiến lược Đảm bảo Tính duy nhất của email
 */

import { IReservation, IReservationResult } from '@ecoma-io/domain';
import { Email } from '../value-objects';

/**
 * Email-specific reservation service extending base IReservation.
 *
 * Implementation lives in infrastructure layer (Postgres with UNIQUE constraint).
 */
export interface IUniqueValueReservationService
  extends IReservation<Email, string> {
  /**
   * Reserve an email for an owner (aggregateId or commandId).
   *
   * @param email - Email value object to reserve
   * @param owner - Owner identifier (userId or commandId)
   * @param idempotencyKey - Idempotency key for duplicate detection
   * @param ttlMs - Time-to-live in milliseconds (default: 5 minutes)
   * @returns Reservation result with status and conflict info
   *
   * @remarks
   * Status responses:
   * - 'reserved': Successfully reserved for this owner
   * - 'committed': Already committed to an aggregate (conflict)
   * - 'conflict': Reserved by another owner (not expired)
   */
  reserve(
    email: Email,
    owner: string,
    idempotencyKey?: string,
    ttlMs?: number
  ): Promise<IReservationResult>;

  /**
   * Confirm reservation after event persisted (mark as committed).
   *
   * @param email - Email to confirm
   * @param aggregateId - Final aggregate ID (userId)
   */
  confirm(email: Email, aggregateId: string): Promise<void>;

  /**
   * Release reservation (free the email).
   *
   * @param email - Email to release
   *
   * @remarks
   * Called on command failure or idempotency conflict resolution.
   */
  release(email: Email): Promise<void>;

  /**
   * Get current reservation status for an email.
   *
   * @param email - Email to check
   * @returns Reservation status and metadata
   */
  status(email: Email): Promise<IReservationResult>;
}
