import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { UserPermissionService } from './user-permission.service';
import { PermissionMergeService } from './permission-merge.service';
import { PermissionCacheRepository } from '../cache/permission-cache.repository';
import { MembershipReadRepository } from '../read-models/repositories/membership-read.repository';
import { RoleReadRepository } from '../read-models/repositories/role-read.repository';
import { PermissionNode } from './types';

describe('UserPermissionService', () => {
  let service: UserPermissionService;
  let mergeService: any;
  let cacheRepo: any;
  let membershipRepo: any;
  let roleRepo: any;

  beforeEach(async () => {
    // Create mocks
    const mockMergeService = {
      expandPermission: jest.fn(),
    };

    const mockCacheRepo = {
      getCombinedTree: jest.fn(),
      cacheUserPermissions: jest.fn(),
      getUserPermissions: jest.fn(),
      setUserPermissions: jest.fn(),
      invalidateUserPermissions: jest.fn(),
      getCombinedPermissionsTree: jest.fn(),
      setCombinedPermissionsTree: jest.fn(),
      invalidateCombinedPermissionsTree: jest.fn(),
      getProjectionCheckpoint: jest.fn(),
      setProjectionCheckpoint: jest.fn(),
      waitForProjection: jest.fn(),
    };

    const mockMembershipRepo = {
      findByUserAndTenant: jest.fn(),
      findByRoleId: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findByTenantId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const mockRoleRepo = {
      findByIds: jest.fn(),
      findById: jest.fn(),
      findByTenantId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserPermissionService,
        {
          provide: PermissionMergeService,
          useValue: mockMergeService,
        },
        {
          provide: PermissionCacheRepository,
          useValue: mockCacheRepo as any,
        },
        {
          provide: MembershipReadRepository,
          useValue: mockMembershipRepo as any,
        },
        {
          provide: RoleReadRepository,
          useValue: mockRoleRepo as any,
        },
      ],
    }).compile();

    service = module.get<UserPermissionService>(UserPermissionService);
    mergeService = module.get(PermissionMergeService);
    cacheRepo = module.get(PermissionCacheRepository);
    membershipRepo = module.get(MembershipReadRepository);
    roleRepo = module.get(RoleReadRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateAndCacheUserPermissions', () => {
    it('should return empty permissions when no membership exists', async () => {
      // Arrange
      membershipRepo.findByUserAndTenant.mockResolvedValue(null);

      // Act
      const result = await service.calculateAndCacheUserPermissions(
        'user-1',
        'tenant-1'
      );

      // Assert
      expect(result.permissions.size).toBe(0);
      expect(result.userId).toBe('user-1');
      expect(result.tenantId).toBe('tenant-1');
      expect(membershipRepo.findByUserAndTenant).toHaveBeenCalledWith(
        'user-1',
        'tenant-1'
      );
    });

    it('should return empty permissions when membership has no roles', async () => {
      // Arrange
      membershipRepo.findByUserAndTenant.mockResolvedValue({
        membershipId: 'membership-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        roleIds: [],
      } as any);

      // Act
      const result = await service.calculateAndCacheUserPermissions(
        'user-1',
        'tenant-1'
      );

      // Assert
      expect(result.permissions.size).toBe(0);
    });

    it('should return empty permissions when roles have no permission keys', async () => {
      // Arrange
      membershipRepo.findByUserAndTenant.mockResolvedValue({
        membershipId: 'membership-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        roleIds: ['role-1'],
      } as any);

      roleRepo.findByIds.mockResolvedValue([
        {
          roleId: 'role-1',
          name: 'Viewer',
          permissionKeys: [],
        } as any,
      ]);

      // Act
      const result = await service.calculateAndCacheUserPermissions(
        'user-1',
        'tenant-1'
      );

      // Assert
      expect(result.permissions.size).toBe(0);
    });

    it('should expand single permission key correctly', async () => {
      // Arrange
      membershipRepo.findByUserAndTenant.mockResolvedValue({
        membershipId: 'membership-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        roleIds: ['role-1'],
      } as any);

      roleRepo.findByIds.mockResolvedValue([
        {
          roleId: 'role-1',
          name: 'Admin',
          permissionKeys: ['admin'],
        } as any,
      ]);

      const combinedTree: PermissionNode[] = [
        {
          key: 'admin',
          children: [{ key: 'user' }, { key: 'settings' }],
        },
      ];

      cacheRepo.getCombinedTree.mockResolvedValue(combinedTree);

      mergeService.expandPermission.mockResolvedValue(
        new Set(['admin', 'admin:user', 'admin:settings'])
      );

      // Act
      const result = await service.calculateAndCacheUserPermissions(
        'user-1',
        'tenant-1'
      );

      // Assert
      expect(result.permissions.size).toBe(3);
      expect(result.permissions.has('admin')).toBe(true);
      expect(result.permissions.has('admin:user')).toBe(true);
      expect(result.permissions.has('admin:settings')).toBe(true);

      expect(cacheRepo.cacheUserPermissions).toHaveBeenCalledWith(
        'user-1',
        'tenant-1',
        expect.arrayContaining(['admin', 'admin:user', 'admin:settings'])
      );
    });

    it('should merge permissions from multiple roles', async () => {
      // Arrange
      membershipRepo.findByUserAndTenant.mockResolvedValue({
        membershipId: 'membership-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        roleIds: ['role-1', 'role-2'],
      } as any);

      roleRepo.findByIds.mockResolvedValue([
        {
          roleId: 'role-1',
          name: 'Editor',
          permissionKeys: ['content:edit'],
        } as any,
        {
          roleId: 'role-2',
          name: 'Publisher',
          permissionKeys: ['content:publish'],
        } as any,
      ]);

      const combinedTree: PermissionNode[] = [
        {
          key: 'content',
          children: [{ key: 'edit' }, { key: 'publish' }],
        },
      ];

      cacheRepo.getCombinedTree.mockResolvedValue(combinedTree);

      mergeService.expandPermission
        .mockResolvedValueOnce(new Set(['content:edit']))
        .mockResolvedValueOnce(new Set(['content:publish']));

      // Act
      const result = await service.calculateAndCacheUserPermissions(
        'user-1',
        'tenant-1'
      );

      // Assert
      expect(result.permissions.size).toBe(2);
      expect(result.permissions.has('content:edit')).toBe(true);
      expect(result.permissions.has('content:publish')).toBe(true);
    });

    it('should deduplicate permissions from overlapping roles', async () => {
      // Arrange
      membershipRepo.findByUserAndTenant.mockResolvedValue({
        membershipId: 'membership-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        roleIds: ['role-1', 'role-2'],
      } as any);

      roleRepo.findByIds.mockResolvedValue([
        {
          roleId: 'role-1',
          name: 'Admin',
          permissionKeys: ['admin:user'],
        } as any,
        {
          roleId: 'role-2',
          name: 'Super Admin',
          permissionKeys: ['admin:user'], // Same permission
        } as any,
      ]);

      cacheRepo.getCombinedTree.mockResolvedValue([
        {
          key: 'admin',
          children: [{ key: 'user' }],
        },
      ]);

      mergeService.expandPermission.mockResolvedValue(new Set(['admin:user']));

      // Act
      const result = await service.calculateAndCacheUserPermissions(
        'user-1',
        'tenant-1'
      );

      // Assert
      expect(result.permissions.size).toBe(1);
      expect(result.permissions.has('admin:user')).toBe(true);
      // expandPermission should be called only once (permission key deduplicated in Set)
      expect(mergeService.expandPermission).toHaveBeenCalledTimes(1);
      expect(mergeService.expandPermission).toHaveBeenCalledWith(
        'admin:user',
        expect.any(Array)
      );
    });

    it('should return empty permissions when combined tree is not available', async () => {
      // Arrange
      membershipRepo.findByUserAndTenant.mockResolvedValue({
        membershipId: 'membership-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        roleIds: ['role-1'],
      } as any);

      roleRepo.findByIds.mockResolvedValue([
        {
          roleId: 'role-1',
          name: 'Admin',
          permissionKeys: ['admin'],
        } as any,
      ]);

      cacheRepo.getCombinedTree.mockResolvedValue(null);

      // Act
      const result = await service.calculateAndCacheUserPermissions(
        'user-1',
        'tenant-1'
      );

      // Assert
      expect(result.permissions.size).toBe(0);
      expect(mergeService.expandPermission).not.toHaveBeenCalled();
    });
  });

  describe('recalculateUsersByRole', () => {
    it('should recalculate permissions for all users with the given role', async () => {
      // Arrange
      membershipRepo.findByRoleId.mockResolvedValue([
        {
          membershipId: 'membership-1',
          userId: 'user-1',
          tenantId: 'tenant-1',
          roleIds: ['role-1'],
        } as any,
        {
          membershipId: 'membership-2',
          userId: 'user-2',
          tenantId: 'tenant-1',
          roleIds: ['role-1'],
        } as any,
      ]);

      membershipRepo.findByUserAndTenant.mockResolvedValue({
        membershipId: 'membership-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        roleIds: ['role-1'],
      } as any);

      roleRepo.findByIds.mockResolvedValue([
        {
          roleId: 'role-1',
          name: 'Admin',
          permissionKeys: ['admin'],
        } as any,
      ]);

      cacheRepo.getCombinedTree.mockResolvedValue([
        { key: 'admin', children: [] },
      ]);

      mergeService.expandPermission.mockResolvedValue(new Set(['admin']));

      // Act
      await service.recalculateUsersByRole('role-1');

      // Assert
      expect(membershipRepo.findByRoleId).toHaveBeenCalledWith('role-1');
      expect(cacheRepo.cacheUserPermissions).toHaveBeenCalledTimes(2);
    });

    it('should handle empty memberships list', async () => {
      // Arrange
      membershipRepo.findByRoleId.mockResolvedValue([]);

      // Act
      await service.recalculateUsersByRole('role-1');

      // Assert
      expect(membershipRepo.findByRoleId).toHaveBeenCalledWith('role-1');
      expect(cacheRepo.cacheUserPermissions).not.toHaveBeenCalled();
    });
  });
});
