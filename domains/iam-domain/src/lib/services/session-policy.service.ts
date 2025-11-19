/**
 * Session Policy Service
 *
 * @remarks
 * Enforces business policies for Session lifecycle in hybrid event model:
 * - Max concurrent sessions per user
 * - Session TTL calculation
 * - Refresh rate limiting
 * - Revocation criteria
 *
 * Pure policy evaluation (no state) - implementation in domain layer.
 *
 * @see Section 3.1 — UserSession (Hybrid Model)
 */

import { IPolicy, PolicyDecision } from '@ecoma-io/domain';

/**
 * Session type for different TTL policies.
 */
export type SessionType = 'web' | 'mobile' | 'service';

/**
 * Revocation reason.
 */
export type RevocationReason =
  | 'user-suspended'
  | 'user-deleted'
  | 'password-changed'
  | 'security-breach'
  | 'manual-logout'
  | 'admin-force-logout'
  | 'expired';

/**
 * Session creation validation context.
 */
export interface ISessionCreationContext {
  userId: string;
  existingActiveSessions: number;
  sessionType: SessionType;
  userStatus: 'Active' | 'Suspended' | 'PendingVerification';
}

/**
 * Session refresh validation context.
 */
export interface ISessionRefreshContext {
  sessionId: string;
  userId: string;
  lastRefreshAt: Date;
  now: Date;
  refreshCount: number; // Count in current window
}

/**
 * Session revocation check context.
 */
export interface ISessionRevocationContext {
  sessionId: string;
  userId: string;
  userStatus: 'Active' | 'Suspended' | 'PendingVerification';
  createdAt: Date;
  lastPasswordChangeAt?: Date;
  sessionCreatedAt: Date;
}

/**
 * Session policy configuration.
 */
export interface ISessionPolicyConfig {
  /**
   * Max concurrent sessions per user (default: 5).
   */
  maxConcurrentSessions: number;

  /**
   * Session TTL by type (in seconds).
   */
  ttl: {
    web: number; // default: 7 days
    mobile: number; // default: 30 days
    service: number; // default: 90 days
  };

  /**
   * Refresh rate limit (default: 1 refresh per 5 seconds).
   */
  refreshRateLimit: {
    windowSeconds: number; // default: 5
    maxRefreshes: number; // default: 1
  };
}

/**
 * Validation result for session operations.
 */
export interface ISessionValidationResult extends PolicyDecision {
  allowed: boolean;
  reason?: string;
  metadata?: {
    currentSessions?: number;
    maxAllowed?: number;
    refreshWaitTime?: number; // seconds to wait before next refresh
  };
}

/**
 * Session Policy Service Interface.
 */
export interface ISessionPolicyService {
  /**
   * Validate session creation request.
   *
   * @param context - Session creation context
   * @returns Validation result
   *
   * @remarks
   * Checks:
   * - User status is Active
   * - Concurrent sessions < max limit
   * - Session type is valid
   */
  validateSessionCreation(
    context: ISessionCreationContext
  ): ISessionValidationResult;

  /**
   * Calculate session expiry date.
   *
   * @param createdAt - Session creation timestamp
   * @param sessionType - Type of session
   * @returns Expiry date
   *
   * @remarks
   * Uses TTL from config based on session type.
   */
  calculateExpiry(createdAt: Date, sessionType: SessionType): Date;

  /**
   * Check if session refresh is allowed (rate limiting).
   *
   * @param context - Refresh validation context
   * @returns True if allowed
   *
   * @remarks
   * Rate limit: 1 refresh per user per 5 seconds (configurable).
   * Prevents refresh token abuse.
   */
  canRefresh(context: ISessionRefreshContext): ISessionValidationResult;

  /**
   * Determine if session should be revoked based on user/system state.
   *
   * @param context - Revocation check context
   * @returns Revocation reason if should revoke, null otherwise
   *
   * @remarks
   * Auto-revocation criteria:
   * - User suspended or deleted
   * - Password changed after session creation
   * - Security breach detected
   */
  shouldRevoke(context: ISessionRevocationContext): RevocationReason | null;

  /**
   * Get current policy configuration.
   *
   * @returns Policy config
   */
  getConfig(): ISessionPolicyConfig;
}

/**
 * Session Creation Policy (implements IPolicy for composability).
 */
export interface ISessionCreationPolicy
  extends IPolicy<SessionCreationContext> {
  evaluate(ctx: SessionCreationContext): Promise<PolicyDecision>;
}

/**
 * Session Refresh Rate Limit Policy.
 */
export interface ISessionRefreshPolicy extends IPolicy<SessionRefreshContext> {
  evaluate(ctx: SessionRefreshContext): Promise<PolicyDecision>;
}
