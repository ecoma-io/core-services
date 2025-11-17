import { Test, TestingModule } from '@nestjs/testing';
import { PermissionMergeService } from './permission-merge.service';
import { PermissionNode } from './types';

describe('PermissionMergeService', () => {
  let service: PermissionMergeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PermissionMergeService],
    }).compile();

    service = module.get<PermissionMergeService>(PermissionMergeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('mergePermissions', () => {
    it('should throw error if serviceName is empty', async () => {
      await expect(
        service.mergePermissions('', [
          { version: '1.0.0', permissionsTree: [] },
        ])
      ).rejects.toThrow('serviceName cannot be empty');
    });

    it('should throw error if versions array is empty', async () => {
      await expect(
        service.mergePermissions('test-service', [])
      ).rejects.toThrow('versions array cannot be empty');
    });

    it('should throw error for invalid semver', async () => {
      await expect(
        service.mergePermissions('test-service', [
          { version: 'invalid', permissionsTree: [] },
        ])
      ).rejects.toThrow('Invalid semver format');
    });

    it('should merge single version successfully', async () => {
      const tree: PermissionNode[] = [
        { key: 'admin', description: 'Admin permission' },
      ];

      const result = await service.mergePermissions('test-service', [
        { version: '1.0.0', permissionsTree: tree },
      ]);

      expect(result.serviceName).toBe('test-service');
      expect(result.combinedTree).toHaveLength(1);
      expect(result.combinedTree[0].key).toBe('admin');
      expect(result.mergedVersions).toHaveLength(1);
      expect(result.mergedVersions[0].version).toBe('1.0.0');
    });

    it('should select top 3 major versions', async () => {
      const versions = [
        { version: '5.0.0', permissionsTree: [{ key: 'v5' }] },
        { version: '4.0.0', permissionsTree: [{ key: 'v4' }] },
        { version: '3.0.0', permissionsTree: [{ key: 'v3' }] },
        { version: '2.0.0', permissionsTree: [{ key: 'v2' }] },
        { version: '1.0.0', permissionsTree: [{ key: 'v1' }] },
      ];

      const result = await service.mergePermissions('test-service', versions);

      expect(result.mergedVersions).toHaveLength(3);
      expect(result.mergedVersions[0].version).toBe('5.0.0');
      expect(result.mergedVersions[1].version).toBe('4.0.0');
      expect(result.mergedVersions[2].version).toBe('3.0.0');
    });

    it('should keep latest patch per major version', async () => {
      const versions = [
        { version: '2.0.0', permissionsTree: [{ key: 'v2.0' }] },
        { version: '2.1.0', permissionsTree: [{ key: 'v2.1' }] },
        { version: '2.0.5', permissionsTree: [{ key: 'v2.0.5' }] }, // Latest patch for major 2
        { version: '1.0.0', permissionsTree: [{ key: 'v1' }] },
      ];

      const result = await service.mergePermissions('test-service', versions);

      expect(result.mergedVersions).toHaveLength(2);
      // Should have 2.0.5 (highest patch in major 2) and 1.0.0
      const v2 = result.mergedVersions.find((v) => v.major === 2);
      expect(v2?.version).toBe('2.0.5');
    });

    it('should merge nested permission trees', async () => {
      const v1Tree: PermissionNode[] = [
        {
          key: 'admin',
          description: 'Admin permissions',
          children: [
            {
              key: 'user',
              description: 'User management',
              children: [{ key: 'read', description: 'Read users' }],
            },
          ],
        },
      ];

      const v2Tree: PermissionNode[] = [
        {
          key: 'admin',
          children: [
            {
              key: 'user',
              children: [
                { key: 'read' },
                { key: 'write', description: 'Write users' }, // New permission
              ],
            },
          ],
        },
      ];

      const result = await service.mergePermissions('test-service', [
        { version: '2.0.0', permissionsTree: v2Tree },
        { version: '1.0.0', permissionsTree: v1Tree },
      ]);

      const admin = result.combinedTree.find((n) => n.key === 'admin');
      expect(admin).toBeDefined();
      expect(admin?.children).toHaveLength(1);

      const user = admin?.children?.find((n) => n.key === 'user');
      expect(user).toBeDefined();
      expect(user?.children).toHaveLength(2); // read + write

      const read = user?.children?.find((n) => n.key === 'read');
      const write = user?.children?.find((n) => n.key === 'write');
      expect(read).toBeDefined();
      expect(write).toBeDefined();
      expect(write?.description).toBe('Write users');
    });

    it('should handle type conflicts (leaf vs container)', async () => {
      const v1Tree: PermissionNode[] = [
        { key: 'admin', description: 'Simple admin permission' }, // Leaf
      ];

      const v2Tree: PermissionNode[] = [
        {
          key: 'admin',
          description: 'Admin with children',
          children: [{ key: 'user' }], // Container
        },
      ];

      const result = await service.mergePermissions('test-service', [
        { version: '2.0.0', permissionsTree: v2Tree }, // Higher priority
        { version: '1.0.0', permissionsTree: v1Tree },
      ]);

      const admin = result.combinedTree.find((n) => n.key === 'admin');
      expect(admin).toBeDefined();
      expect(admin?.children).toHaveLength(1); // v2 wins, has children
      expect(admin?.metadata?.reason).toBe('type-conflict-higher-priority');
    });
  });

  describe('expandPermission', () => {
    it('should expand simple permission without children', async () => {
      const tree: PermissionNode[] = [{ key: 'admin', description: 'Admin' }];

      const expanded = await service.expandPermission('admin', tree);

      expect(expanded.size).toBe(1);
      expect(expanded.has('admin')).toBe(true);
    });

    it('should expand permission with nested children', async () => {
      const tree: PermissionNode[] = [
        {
          key: 'admin',
          children: [
            {
              key: 'user',
              children: [{ key: 'read' }, { key: 'write' }],
            },
            {
              key: 'billing',
              children: [{ key: 'view' }],
            },
          ],
        },
      ];

      const expanded = await service.expandPermission('admin', tree);

      expect(expanded.size).toBe(6);
      expect(expanded.has('admin')).toBe(true);
      expect(expanded.has('admin:user')).toBe(true);
      expect(expanded.has('admin:user:read')).toBe(true);
      expect(expanded.has('admin:user:write')).toBe(true);
      expect(expanded.has('admin:billing')).toBe(true);
      expect(expanded.has('admin:billing:view')).toBe(true);
    });

    it('should expand nested permission path', async () => {
      const tree: PermissionNode[] = [
        {
          key: 'admin',
          children: [
            {
              key: 'user',
              children: [{ key: 'read' }, { key: 'write' }],
            },
          ],
        },
      ];

      const expanded = await service.expandPermission('admin:user', tree);

      expect(expanded.size).toBe(3);
      expect(expanded.has('admin:user')).toBe(true);
      expect(expanded.has('admin:user:read')).toBe(true);
      expect(expanded.has('admin:user:write')).toBe(true);
      expect(expanded.has('admin')).toBe(false); // Should not include parent
    });

    it('should return only self if permission not found', async () => {
      const tree: PermissionNode[] = [{ key: 'admin' }];

      const expanded = await service.expandPermission('nonexistent', tree);

      expect(expanded.size).toBe(1);
      expect(expanded.has('nonexistent')).toBe(true);
    });
  });

  describe('mergeNodes', () => {
    it('should merge two container nodes', () => {
      const base: PermissionNode = {
        key: 'admin',
        children: [{ key: 'user' }],
      };

      const incoming: PermissionNode = {
        key: 'admin',
        children: [{ key: 'billing' }],
      };

      const result = service.mergeNodes(base, incoming, '2.0.0', 'admin');

      expect(result.children).toHaveLength(2);
      expect(result.children?.some((n) => n.key === 'user')).toBe(true);
      expect(result.children?.some((n) => n.key === 'billing')).toBe(true);
    });

    it('should resolve type conflict with incoming node', () => {
      const base: PermissionNode = {
        key: 'admin',
        children: [{ key: 'user' }], // Container
      };

      const incoming: PermissionNode = {
        key: 'admin',
        description: 'Simple admin', // Leaf
      };

      const result = service.mergeNodes(base, incoming, '2.0.0', 'admin');

      expect(result.children).toBeUndefined(); // Incoming (leaf) wins
      expect(result.description).toBe('Simple admin');
      expect(result.metadata?.reason).toBe('type-conflict-higher-priority');
    });

    it('should resolve leaf conflict with incoming node', () => {
      const base: PermissionNode = {
        key: 'admin',
        description: 'Old description',
      };

      const incoming: PermissionNode = {
        key: 'admin',
        description: 'New description',
      };

      const result = service.mergeNodes(base, incoming, '2.0.0', 'admin');

      expect(result.description).toBe('New description');
      expect(result.metadata?.reason).toBe('leaf-conflict-higher-priority');
    });
  });
});
