/**
 * Unit tests for IPermissionExpansionService
 *
 * @remarks
 * Tests pure domain algorithm for expanding nested permissions.
 */

import { PermissionExpansionService } from './impl/permission-expansion.service.impl';
import { ICombinedPermissionsTree } from './permission-merge.service';

describe('PermissionExpansionService (implementation)', () => {
  const svc = PermissionExpansionService;

  const mockTree: ICombinedPermissionsTree = {
    tree: [
      {
        key: 'admin:all',
        children: [
          {
            key: 'admin:user',
            children: [
              { key: 'admin:user:read' } as any,
              { key: 'admin:user:write' } as any,
            ],
          } as any,
          { key: 'admin:billing' } as any,
        ],
      } as any,
      { key: 'viewer:read' } as any,
    ],
    metadata: {
      combinedFrom: [],
      mergedAt: new Date().toISOString(),
      globalVersion: 1,
    },
    provenance: new Map(),
  };

  describe('expand()', () => {
    it('expands high-level key to include all children', () => {
      const res = svc.expand(['admin:all'] as any, mockTree);
      const keys = res.keys.sort();
      expect(keys).toEqual(
        [
          'admin:all',
          'admin:billing',
          'admin:user',
          'admin:user:read',
          'admin:user:write',
        ].sort()
      );
      expect(res.metadata.inputCount).toBe(1);
    });

    it('deduplicates multiple inputs', () => {
      const res = svc.expand(['admin:all', 'admin:user'] as any, mockTree);
      expect(res.keys).toContain('admin:all');
      expect(res.keys).toContain('admin:user');
      // no duplicates
      expect(new Set(res.keys).size).toBe(res.keys.length);
    });

    it('includes leaf keys as-is', () => {
      const res = svc.expand(['viewer:read'] as any, mockTree);
      expect(res.keys).toEqual(['viewer:read']);
    });
  });

  describe('expandSingle()', () => {
    it('expands single key correctly', () => {
      const out = svc.expandSingle('admin:user' as any, mockTree);
      expect(out).toEqual(
        expect.arrayContaining([
          'admin:user',
          'admin:user:read',
          'admin:user:write',
        ])
      );
    });

    it('returns only the leaf for a leaf node', () => {
      const out = svc.expandSingle('admin:user:read' as any, mockTree);
      expect(out).toEqual(['admin:user:read']);
    });
  });

  describe('matches()', () => {
    it('matches exact key', () => {
      const r = svc.matches(
        'viewer:read' as any,
        ['viewer:read'] as any,
        mockTree
      );
      expect(r.matches).toBe(true);
    });

    it('matches when parent covers child', () => {
      const r = svc.matches(
        'admin:user:read' as any,
        ['admin:all'] as any,
        mockTree
      );
      expect(r.matches).toBe(true);
      expect(r.matchedKey).toBe('admin:all');
    });

    it('does not match unrelated keys', () => {
      const r = svc.matches(
        'billing:write' as any,
        ['admin:all'] as any,
        mockTree
      );
      expect(r.matches).toBe(false);
    });
  });
});
