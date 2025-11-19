import {
  ISessionPolicyService,
  ISessionPolicyConfig,
  ISessionCreationContext,
  ISessionRefreshContext,
  ISessionRevocationContext,
  ISessionValidationResult,
  SessionType,
  RevocationReason,
} from '../session-policy.service';

const DEFAULT_CONFIG: ISessionPolicyConfig = {
  maxConcurrentSessions: 5,
  ttl: {
    web: 7 * 24 * 60 * 60,
    mobile: 30 * 24 * 60 * 60,
    service: 90 * 24 * 60 * 60,
  },
  refreshRateLimit: {
    windowSeconds: 5,
    maxRefreshes: 1,
  },
};

export class SessionPolicyServiceImpl implements ISessionPolicyService {
  private config: ISessionPolicyConfig;

  constructor(cfg?: ISessionPolicyConfig) {
    this.config = Object.assign({}, DEFAULT_CONFIG, cfg || {});
  }

  validateSessionCreation(
    context: ISessionCreationContext
  ): ISessionValidationResult {
    if (context.userStatus !== 'Active')
      return {
        allowed: false,
        reason: 'user-not-active',
      } as ISessionValidationResult;
    const max = this.config.maxConcurrentSessions;
    if (context.existingActiveSessions >= max)
      return {
        allowed: false,
        reason: 'max-sessions-reached',
        metadata: {
          currentSessions: context.existingActiveSessions,
          maxAllowed: max,
        },
      } as ISessionValidationResult;
    return { allowed: true } as ISessionValidationResult;
  }

  calculateExpiry(createdAt: Date, sessionType: SessionType): Date {
    const ttl = this.config.ttl[sessionType];
    return new Date(createdAt.getTime() + ttl * 1000);
  }

  canRefresh(context: ISessionRefreshContext): ISessionValidationResult {
    const { windowSeconds, maxRefreshes } = this.config.refreshRateLimit;
    // naive check: if refreshCount > maxRefreshes -> disallow
    if (context.refreshCount > maxRefreshes) {
      return {
        allowed: false,
        reason: 'rate-limited',
        metadata: { refreshWaitTime: windowSeconds },
      } as ISessionValidationResult;
    }
    // also check lastRefreshAt vs now
    const deltaSec =
      (context.now.getTime() - context.lastRefreshAt.getTime()) / 1000;
    if (deltaSec < windowSeconds && context.refreshCount >= maxRefreshes) {
      return {
        allowed: false,
        reason: 'too-soon',
        metadata: { refreshWaitTime: Math.ceil(windowSeconds - deltaSec) },
      } as ISessionValidationResult;
    }
    return { allowed: true } as ISessionValidationResult;
  }

  shouldRevoke(context: ISessionRevocationContext): RevocationReason | null {
    if (context.userStatus !== 'Active') return 'user-suspended';
    if (
      context.lastPasswordChangeAt &&
      context.lastPasswordChangeAt.getTime() >
        context.sessionCreatedAt.getTime()
    )
      return 'password-changed';
    // expired handled elsewhere
    return null;
  }

  getConfig(): ISessionPolicyConfig {
    return this.config;
  }
}

export const SessionPolicyService = new SessionPolicyServiceImpl();
