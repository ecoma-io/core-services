/**
 * Unit tests for ISessionPolicyService
 *
 * @remarks
 * Tests pure policy evaluation (stateless).
 */

import { SessionPolicyService } from './impl/session-policy.service.impl';

describe('SessionPolicyService (implementation)', () => {
  const svc = SessionPolicyService;

  describe('validateSessionCreation()', () => {
    it('allows session creation when under limit', () => {
      const ctx = {
        userId: 'u1',
        existingActiveSessions: 3,
        sessionType: 'web',
        userStatus: 'Active',
      } as any;
      const res = svc.validateSessionCreation(ctx);
      expect(res.allowed).toBe(true);
    });

    it('denies when max concurrent sessions reached', () => {
      const ctx = {
        userId: 'u1',
        existingActiveSessions: 5,
        sessionType: 'web',
        userStatus: 'Active',
      } as any;
      const res = svc.validateSessionCreation(ctx);
      expect(res.allowed).toBe(false);
    });

    it('denies for suspended user', () => {
      const ctx = {
        userId: 'u1',
        existingActiveSessions: 0,
        sessionType: 'web',
        userStatus: 'Suspended',
      } as any;
      const res = svc.validateSessionCreation(ctx);
      expect(res.allowed).toBe(false);
    });
  });

  describe('calculateExpiry()', () => {
    it('calculates correct expiry for web session', () => {
      const createdAt = new Date('2025-01-01T00:00:00Z');
      const expiry = svc.calculateExpiry(createdAt, 'web');
      expect(expiry.toISOString()).toBe(
        new Date('2025-01-08T00:00:00Z').toISOString()
      );
    });
  });

  describe('canRefresh()', () => {
    it('allows refresh when rate limit not exceeded', () => {
      const ctx = {
        sessionId: 's1',
        userId: 'u1',
        lastRefreshAt: new Date(Date.now() - 6000),
        now: new Date(),
        refreshCount: 0,
      } as any;
      const res = svc.canRefresh(ctx);
      expect(res.allowed).toBe(true);
    });

    it('denies refresh when within rate limit window', () => {
      const ctx = {
        sessionId: 's1',
        userId: 'u1',
        lastRefreshAt: new Date(Date.now() - 2000),
        now: new Date(),
        refreshCount: 1,
      } as any;
      const res = svc.canRefresh(ctx);
      expect(res.allowed).toBe(false);
    });
  });

  describe('shouldRevoke()', () => {
    it('does not revoke for active user with valid session', () => {
      const ctx = {
        sessionId: 's1',
        userId: 'u1',
        userStatus: 'Active',
        createdAt: new Date(),
        sessionCreatedAt: new Date(),
      } as any;
      const r = svc.shouldRevoke(ctx as any);
      expect(r).toBeNull();
    });

    it('revokes when user is suspended', () => {
      const ctx = {
        sessionId: 's1',
        userId: 'u1',
        userStatus: 'Suspended',
        createdAt: new Date(),
        sessionCreatedAt: new Date(),
      } as any;
      const r = svc.shouldRevoke(ctx as any);
      expect(r).toBe('user-suspended');
    });

    it('revokes when password changed after session creation', () => {
      const sessionCreatedAt = new Date('2025-01-01T00:00:00Z');
      const ctx = {
        sessionId: 's1',
        userId: 'u1',
        userStatus: 'Active',
        createdAt: new Date(),
        sessionCreatedAt,
        lastPasswordChangeAt: new Date('2025-01-02T00:00:00Z'),
      } as any;
      const r = svc.shouldRevoke(ctx as any);
      expect(r).toBe('password-changed');
    });
  });

  describe('getConfig()', () => {
    it('returns policy configuration', () => {
      const cfg = svc.getConfig();
      expect(cfg.maxConcurrentSessions).toBeGreaterThan(0);
    });
  });
});
