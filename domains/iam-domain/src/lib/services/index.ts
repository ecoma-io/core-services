/**
 * Domain Services for IAM Bounded Context
 *
 * @remarks
 * All interfaces defined here follow Hexagonal Architecture principles:
 * - Domain layer defines contracts (interfaces)
 * - Infrastructure layer provides implementations
 * - Pure domain logic can be implemented directly in domain layer
 */

// Email Uniqueness Reservation (ADR-IAM-7)
export * from './unique-value-reservation.service';

// Permission Management (ADR-IAM-4)
export * from './permission-merge.service';
export * from './permission-expansion.service';

// Password Security (ADR-IAM-8)
export * from './password-hashing.service';

// Session Lifecycle Policies
export * from './session-policy.service';
