/**
 * Unit tests for IPermissionMergeService
 *
 * @remarks
 * Tests pure domain algorithm for merging permission trees.
 * These tests validate ADR-IAM-4 compliance.
 */

import { PermissionMergeService } from './impl/permission-merge.service.impl';

describe('PermissionMergeService (implementation)', () => {
  const svc = PermissionMergeService;

  describe('selectRelevantVersions()', () => {
    it('selects top 3 majors with highest minor+patch', () => {
      const input = [
        {
          version: '5.1.0',
          permissionsTree: [],
          serviceId: 's',
          serviceName: 's',
        },
        {
          version: '4.2.3',
          permissionsTree: [],
          serviceId: 's',
          serviceName: 's',
        },
        {
          version: '4.2.1',
          permissionsTree: [],
          serviceId: 's',
          serviceName: 's',
        },
        {
          version: '4.1.0',
          permissionsTree: [],
          serviceId: 's',
          serviceName: 's',
        },
        {
          version: '3.5.2',
          permissionsTree: [],
          serviceId: 's',
          serviceName: 's',
        },
        {
          version: '3.5.0',
          permissionsTree: [],
          serviceId: 's',
          serviceName: 's',
        },
        {
          version: '2.0.0',
          permissionsTree: [],
          serviceId: 's',
          serviceName: 's',
        },
        {
          version: '1.9.9',
          permissionsTree: [],
          serviceId: 's',
          serviceName: 's',
        },
      ];
      const sel = svc.selectRelevantVersions('s', input as any);
      expect(sel.map((v) => v.version)).toEqual(['5.1.0', '4.2.3', '3.5.2']);
    });

    it('handles less than 3 majors', () => {
      const input = [
        {
          version: '2.0.0',
          permissionsTree: [],
          serviceId: 's',
          serviceName: 's',
        },
        {
          version: '1.1.0',
          permissionsTree: [],
          serviceId: 's',
          serviceName: 's',
        },
      ];
      const sel = svc.selectRelevantVersions('s', input as any);
      expect(sel.map((v) => v.version)).toEqual(['2.0.0', '1.1.0']);
    });
  });

  describe('mergeTrees()', () => {
    it('merges non-overlapping keys', () => {
      const v1 = {
        version: '2.0.0',
        permissionsTree: [{ key: 'admin:user' } as any],
        serviceId: 'a',
        serviceName: 'A',
      } as any;
      const v2 = {
        version: '1.0.0',
        permissionsTree: [{ key: 'billing:read' } as any],
        serviceId: 'b',
        serviceName: 'B',
      } as any;
      const combined = svc.mergeTrees([v1, v2]);
      const keys = combined.tree.map((n) => n.key).sort();
      expect(keys).toEqual(['admin:user', 'billing:read']);
    });

    it('applies semver priority on conflict', () => {
      const v2 = {
        version: '2.0.0',
        permissionsTree: [{ key: 'admin:user', description: 'New' } as any],
        serviceId: 's',
        serviceName: 'S',
      } as any;
      const v1 = {
        version: '1.0.0',
        permissionsTree: [{ key: 'admin:user', description: 'Old' } as any],
        serviceId: 's',
        serviceName: 'S',
      } as any;
      const combined = svc.mergeTrees([v2, v1]);
      const node = combined.tree.find((n) => n.key === 'admin:user')!;
      expect(node.description).toBe('New');
    });

    it('deep-merges container nodes recursively', () => {
      const v2 = {
        version: '2.0.0',
        permissionsTree: [
          { key: 'admin:all', children: [{ key: 'admin:user' }] } as any,
        ],
        serviceId: 's',
        serviceName: 'S',
      } as any;
      const v1 = {
        version: '1.0.0',
        permissionsTree: [
          { key: 'admin:all', children: [{ key: 'admin:billing' }] } as any,
        ],
        serviceId: 's',
        serviceName: 'S',
      } as any;
      const combined = svc.mergeTrees([v2, v1]);
      const root = combined.tree.find((n) => n.key === 'admin:all')!;
      const childKeys = (root.children || []).map((c) => c.key).sort();
      expect(childKeys).toEqual(['admin:billing', 'admin:user']);
    });

    it('leaf overrides container when configured', () => {
      const v2 = {
        version: '2.0.0',
        permissionsTree: [{ key: 'admin:user' }] as any,
        serviceId: 's',
        serviceName: 'S',
      } as any;
      const v1 = {
        version: '1.0.0',
        permissionsTree: [
          { key: 'admin:user', children: [{ key: 'admin:user:read' }] } as any,
        ],
        serviceId: 's',
        serviceName: 'S',
      } as any;
      const combined = svc.mergeTrees([v2, v1], {
        leafOverridesContainer: true,
      } as any);
      const node = combined.tree.find((n) => n.key === 'admin:user')!;
      expect(node.children).toBeUndefined();
    });
  });
});
