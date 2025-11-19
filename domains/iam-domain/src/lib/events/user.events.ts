import { DomainEvent, IDomainEventInitProps } from '@ecoma-io/domain';
import { v7 as uuidv7 } from 'uuid';

/**
 * Optional metadata for events. We populate minimal tracing fields when absent.
 */
export type EventMetadata = Record<string, unknown> | undefined;

function ensureMetadata(md?: EventMetadata): Record<string, unknown> {
  const base: Record<string, unknown> = md ? { ...md } : {};
  if (!base['correlationId']) base['correlationId'] = uuidv7();
  if (!base['causationId']) base['causationId'] = uuidv7();
  return base;
}

export type UserRegisteredEventPayload = {
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  source?: string;
};

export class UserRegisteredEvent extends DomainEvent<UserRegisteredEventPayload> {
  constructor(
    props: Omit<IDomainEventInitProps<UserRegisteredEventPayload>, 'type'>
  ) {
    super({
      ...props,
      metadata: ensureMetadata(props.metadata),
      type: 'UserRegistered',
    });
  }
}

export type UserPasswordChangedEventPayload = { passwordHash: string };

export class UserPasswordChangedEvent extends DomainEvent<UserPasswordChangedEventPayload> {
  constructor(
    props: Omit<IDomainEventInitProps<UserPasswordChangedEventPayload>, 'type'>
  ) {
    super({
      ...props,
      metadata: ensureMetadata(props.metadata),
      type: 'UserPasswordChanged',
    });
  }
}

export type UserProfileUpdatedEventPayload = {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
};

export class UserProfileUpdatedEvent extends DomainEvent<UserProfileUpdatedEventPayload> {
  constructor(
    props: Omit<IDomainEventInitProps<UserProfileUpdatedEventPayload>, 'type'>
  ) {
    super({
      ...props,
      metadata: ensureMetadata(props.metadata),
      type: 'UserProfileUpdated',
    });
  }
}

export type UserStatusChangedEventPayload = {
  status: 'Active' | 'Suspended' | 'PendingVerification';
};

export class UserStatusChangedEvent extends DomainEvent<UserStatusChangedEventPayload> {
  constructor(
    props: Omit<IDomainEventInitProps<UserStatusChangedEventPayload>, 'type'>
  ) {
    super({
      ...props,
      metadata: ensureMetadata(props.metadata),
      type: 'UserStatusChanged',
    });
  }
}

export type UserMfaEnabledEventPayload = Record<string, unknown>;

export class UserMfaEnabledEvent extends DomainEvent<UserMfaEnabledEventPayload> {
  constructor(
    props: Omit<IDomainEventInitProps<UserMfaEnabledEventPayload>, 'type'>
  ) {
    super({
      ...props,
      metadata: ensureMetadata(props.metadata),
      type: 'UserMfaEnabled',
    });
  }
}

export type UserMfaDisabledEventPayload = Record<string, unknown>;

export class UserMfaDisabledEvent extends DomainEvent<UserMfaDisabledEventPayload> {
  constructor(
    props: Omit<IDomainEventInitProps<UserMfaDisabledEventPayload>, 'type'>
  ) {
    super({
      ...props,
      metadata: ensureMetadata(props.metadata),
      type: 'UserMfaDisabled',
    });
  }
}

export type UserSocialLinkedEventPayload = {
  provider: string;
  providerId: string;
  providerEmail?: string;
};

export class UserSocialLinkedEvent extends DomainEvent<UserSocialLinkedEventPayload> {
  constructor(
    props: Omit<IDomainEventInitProps<UserSocialLinkedEventPayload>, 'type'>
  ) {
    super({
      ...props,
      metadata: ensureMetadata(props.metadata),
      type: 'UserSocialLinked',
    });
  }
}
