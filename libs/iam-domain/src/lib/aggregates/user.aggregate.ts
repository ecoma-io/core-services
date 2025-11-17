import {
  AggregateRoot,
  DomainEventEnvelope,
  DomainException,
} from '@ecoma-io/domain';
import {
  createUserRegisteredEvent,
  createUserPasswordChangedEvent,
  createUserProfileUpdatedEvent,
  createUserStatusChangedEvent,
  createUserMfaEnabledEvent,
  createUserMfaDisabledEvent,
  createUserSocialLinkedEvent,
} from '../events/user.events';
import { Email } from '../value-objects/email';
import { Password } from '../value-objects/password';

export type UserStatus = 'Active' | 'Suspended' | 'PendingVerification';

export interface UserProfile {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

export interface UserState {
  userId?: string;
  email?: string;
  profile?: UserProfile;
  status?: UserStatus;
  socialLinks?: Array<Record<string, unknown>>;
  mfaMethods?: Array<Record<string, unknown>>;
}

export class UserAggregate extends AggregateRoot<UserState> {
  constructor(private readonly _id?: string) {
    super();
    // Don't set userId here - it should only be set via UserRegistered event
  }

  protected applyEvent(event: DomainEventEnvelope): void {
    switch (event.type) {
      case 'UserRegistered':
        this._state.userId = event.aggregateId;
        this._state.email = (event.payload as any).email;
        this._state.profile = {
          firstName: (event.payload as any).firstName,
          lastName: (event.payload as any).lastName,
        };
        this._state.status = 'PendingVerification';
        break;
      case 'UserPasswordChanged':
        // password metadata not stored in aggregate state
        break;
      case 'UserProfileUpdated':
        this._state.profile = {
          ...this._state.profile,
          firstName: (event.payload as any).firstName,
          lastName: (event.payload as any).lastName,
          avatarUrl: (event.payload as any).avatarUrl,
        };
        break;
      case 'UserStatusChanged':
        this._state.status = (event.payload as any).status;
        break;
      case 'UserMfaEnabled':
        if (!this._state.mfaMethods) {
          this._state.mfaMethods = [];
        }
        this._state.mfaMethods.push({ enabled: true });
        break;
      case 'UserMfaDisabled':
        this._state.mfaMethods = [];
        break;
      case 'UserSocialLinked':
        if (!this._state.socialLinks) {
          this._state.socialLinks = [];
        }
        this._state.socialLinks.push({
          provider: (event.payload as any).provider,
          providerId: (event.payload as any).providerId,
          providerEmail: (event.payload as any).providerEmail,
        });
        break;
      default:
        // ignore unknown events
        break;
    }
  }

  /**
   * Register a new user.
   *
   * @throws {DomainException} if user already registered or email invalid
   */
  register(email: string, password: string, profile?: UserProfile) {
    if (this._state.userId) {
      throw new DomainException('User already registered');
    }

    // Validate email
    const emailVO = Email.create(email);

    // Validate password
    const passwordVO = Password.createFromPlaintext(password);

    const aggregateId = this._id ?? (this._state.userId as string) ?? '';
    const ev = createUserRegisteredEvent(aggregateId, {
      email: emailVO.toString(),
      passwordHash: passwordVO.toHash(),
      firstName: profile?.firstName,
      lastName: profile?.lastName,
    });
    this.recordEvent(ev);
  }

  /**
   * Change user password.
   *
   * @throws {DomainException} if user not registered
   */
  changePassword(newPassword: string) {
    if (!this._state.userId) {
      throw new DomainException('User not registered');
    }

    // Validate new password
    const passwordVO = Password.createFromPlaintext(newPassword);

    const aggregateId = this._state.userId as string;
    const ev = createUserPasswordChangedEvent(aggregateId, {
      passwordHash: passwordVO.toHash(),
    });
    this.recordEvent(ev);
  }

  /**
   * Update user profile.
   *
   * @throws {DomainException} if user not registered
   */
  updateProfile(profile: UserProfile) {
    if (!this._state.userId) {
      throw new DomainException('User not registered');
    }

    const aggregateId = this._state.userId as string;
    const ev = createUserProfileUpdatedEvent(aggregateId, profile);
    this.recordEvent(ev);
  }

  /**
   * Activate user account.
   *
   * @throws {DomainException} if user not registered or already active
   */
  activate() {
    if (!this._state.userId) {
      throw new DomainException('User not registered');
    }

    if (this._state.status === 'Active') {
      throw new DomainException('User already active');
    }

    const aggregateId = this._state.userId as string;
    const ev = createUserStatusChangedEvent(aggregateId, { status: 'Active' });
    this.recordEvent(ev);
  }

  /**
   * Suspend user account.
   *
   * @throws {DomainException} if user not registered or already suspended
   */
  suspend() {
    if (!this._state.userId) {
      throw new DomainException('User not registered');
    }

    if (this._state.status === 'Suspended') {
      throw new DomainException('User already suspended');
    }

    const aggregateId = this._state.userId as string;
    const ev = createUserStatusChangedEvent(aggregateId, {
      status: 'Suspended',
    });
    this.recordEvent(ev);
  }

  /**
   * Enable MFA for user.
   *
   * @throws {DomainException} if user not registered or MFA already enabled
   */
  enableMfa() {
    if (!this._state.userId) {
      throw new DomainException('User not registered');
    }

    if (this._state.mfaMethods && this._state.mfaMethods.length > 0) {
      throw new DomainException('MFA already enabled');
    }

    const aggregateId = this._state.userId as string;
    const ev = createUserMfaEnabledEvent(aggregateId);
    this.recordEvent(ev);
  }

  /**
   * Disable MFA for user.
   *
   * @throws {DomainException} if user not registered or MFA not enabled
   */
  disableMfa() {
    if (!this._state.userId) {
      throw new DomainException('User not registered');
    }

    if (!this._state.mfaMethods || this._state.mfaMethods.length === 0) {
      throw new DomainException('MFA not enabled');
    }

    const aggregateId = this._state.userId as string;
    const ev = createUserMfaDisabledEvent(aggregateId);
    this.recordEvent(ev);
  }

  /**
   * Link social account to user.
   *
   * @throws {DomainException} if user not registered or social account already linked
   */
  linkSocialAccount(
    provider: string,
    providerId: string,
    providerEmail?: string
  ) {
    if (!this._state.userId) {
      throw new DomainException('User not registered');
    }

    // Check if social account already linked
    if (this._state.socialLinks) {
      const existing = this._state.socialLinks.find(
        (link: Record<string, unknown>) =>
          link['provider'] === provider && link['providerId'] === providerId
      );
      if (existing) {
        throw new DomainException(
          `Social account ${provider}:${providerId} already linked`
        );
      }
    }

    const aggregateId = this._state.userId as string;
    const ev = createUserSocialLinkedEvent(aggregateId, {
      provider,
      providerId,
      providerEmail,
    });
    this.recordEvent(ev);
  }
}
