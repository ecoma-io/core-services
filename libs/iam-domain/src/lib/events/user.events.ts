import { DomainEventEnvelope } from '@ecoma-io/domain';
import { v7 as uuidv7 } from 'uuid';

/**
 * Optional metadata for events. We populate minimal tracing fields when absent.
 */
export type EventMetadata = Record<string, unknown> | undefined;

function ensureMetadata(md?: EventMetadata): Record<string, unknown> {
  const base: Record<string, unknown> = md ? { ...md } : {};
  if (!base.correlationId) base.correlationId = uuidv7();
  if (!base.causationId) base.causationId = uuidv7();
  return base;
}

export function createUserRegisteredEvent(
  aggregateId: string,
  payload: {
    email: string;
    passwordHash: string;
    firstName?: string;
    lastName?: string;
    source?: string;
  },
  metadata?: EventMetadata
): DomainEventEnvelope {
  return {
    id: uuidv7(),
    type: 'UserRegistered',
    aggregateId,
    occurredAt: new Date().toISOString(),
    eventVersion: '1.0.0',
    payload,
    metadata: ensureMetadata(metadata),
  };
}

export function createUserPasswordChangedEvent(
  aggregateId: string,
  payload: {
    passwordHash: string;
  },
  metadata?: EventMetadata
): DomainEventEnvelope {
  return {
    id: uuidv7(),
    type: 'UserPasswordChanged',
    aggregateId,
    occurredAt: new Date().toISOString(),
    eventVersion: '1.0.0',
    payload,
    metadata: ensureMetadata(metadata),
  };
}

export function createUserProfileUpdatedEvent(
  aggregateId: string,
  payload: {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
  },
  metadata?: EventMetadata
): DomainEventEnvelope {
  return {
    id: uuidv7(),
    type: 'UserProfileUpdated',
    aggregateId,
    occurredAt: new Date().toISOString(),
    eventVersion: '1.0.0',
    payload,
    metadata: ensureMetadata(metadata),
  };
}

export function createUserStatusChangedEvent(
  aggregateId: string,
  payload: {
    status: 'Active' | 'Suspended' | 'PendingVerification';
  },
  metadata?: EventMetadata
): DomainEventEnvelope {
  return {
    id: uuidv7(),
    type: 'UserStatusChanged',
    aggregateId,
    occurredAt: new Date().toISOString(),
    eventVersion: '1.0.0',
    payload,
    metadata: ensureMetadata(metadata),
  };
}

export function createUserMfaEnabledEvent(
  aggregateId: string,
  metadata?: EventMetadata
): DomainEventEnvelope {
  return {
    id: uuidv7(),
    type: 'UserMfaEnabled',
    aggregateId,
    occurredAt: new Date().toISOString(),
    eventVersion: '1.0.0',
    payload: {},
    metadata: ensureMetadata(metadata),
  };
}

export function createUserMfaDisabledEvent(
  aggregateId: string,
  metadata?: EventMetadata
): DomainEventEnvelope {
  return {
    id: uuidv7(),
    type: 'UserMfaDisabled',
    aggregateId,
    occurredAt: new Date().toISOString(),
    eventVersion: '1.0.0',
    payload: {},
    metadata: ensureMetadata(metadata),
  };
}

export function createUserSocialLinkedEvent(
  aggregateId: string,
  payload: {
    provider: string;
    providerId: string;
    providerEmail?: string;
  },
  metadata?: EventMetadata
): DomainEventEnvelope {
  return {
    id: uuidv7(),
    type: 'UserSocialLinked',
    aggregateId,
    occurredAt: new Date().toISOString(),
    eventVersion: '1.0.0',
    payload,
    metadata: ensureMetadata(metadata),
  };
}
