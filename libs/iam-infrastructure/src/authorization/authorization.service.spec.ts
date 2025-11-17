import { Test, TestingModule } from '@nestjs/testing';
import { AuthorizationService } from './authorization.service';
import { PermissionCacheRepository } from '../cache/permission-cache.repository';
import { UserPermissionService } from '../permissions/user-permission.service';

describe('AuthorizationService', () => {
  let service: AuthorizationService;
  let cacheRepo: any;
  let userPermissionService: any;

  beforeEach(async () => {
    const mockCacheRepo = {
      getUserPermissions: jest.fn(),
    };

    const mockUserPermissionService = {
      calculateAndCacheUserPermissions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthorizationService,
        {
          provide: PermissionCacheRepository,
          useValue: mockCacheRepo as any,
        },
        {
          provide: UserPermissionService,
          useValue: mockUserPermissionService as any,
        },
      ],
    }).compile();

    service = module.get<AuthorizationService>(AuthorizationService);
    cacheRepo = module.get(PermissionCacheRepository);
    userPermissionService = module.get(UserPermissionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkPermission', () => {
    it('should return true when permission exists in cache', async () => {
      // Arrange
      cacheRepo.getUserPermissions.mockResolvedValue([
        'admin:user:read',
        'admin:user:write',
      ]);

      // Act
      const result = await service.checkPermission(
        'user-1',
        'tenant-1',
        'admin:user:read'
      );

      // Assert
      expect(result).toBe(true);
      expect(cacheRepo.getUserPermissions).toHaveBeenCalledWith(
        'user-1',
        'tenant-1'
      );
      expect(
        userPermissionService.calculateAndCacheUserPermissions
      ).not.toHaveBeenCalled();
    });

    it('should return false when permission does not exist in cache', async () => {
      // Arrange
      cacheRepo.getUserPermissions.mockResolvedValue([
        'admin:user:read',
        'admin:user:write',
      ]);

      // Act
      const result = await service.checkPermission(
        'user-1',
        'tenant-1',
        'admin:user:delete'
      );

      // Assert
      expect(result).toBe(false);
      expect(
        userPermissionService.calculateAndCacheUserPermissions
      ).not.toHaveBeenCalled();
    });

    it('should calculate permissions when cache misses', async () => {
      // Arrange
      cacheRepo.getUserPermissions.mockResolvedValue(null);

      userPermissionService.calculateAndCacheUserPermissions.mockResolvedValue({
        userId: 'user-1',
        tenantId: 'tenant-1',
        permissions: new Set(['admin:user:read', 'admin:user:write']),
        calculatedAt: new Date(),
        ttl: 3600,
      });

      // Act
      const result = await service.checkPermission(
        'user-1',
        'tenant-1',
        'admin:user:read'
      );

      // Assert
      expect(result).toBe(true);
      expect(cacheRepo.getUserPermissions).toHaveBeenCalledWith(
        'user-1',
        'tenant-1'
      );
      expect(
        userPermissionService.calculateAndCacheUserPermissions
      ).toHaveBeenCalledWith('user-1', 'tenant-1');
    });

    it('should return false when calculated permissions do not include key', async () => {
      // Arrange
      cacheRepo.getUserPermissions.mockResolvedValue(null);

      userPermissionService.calculateAndCacheUserPermissions.mockResolvedValue({
        userId: 'user-1',
        tenantId: 'tenant-1',
        permissions: new Set(['admin:user:read']),
        calculatedAt: new Date(),
        ttl: 3600,
      });

      // Act
      const result = await service.checkPermission(
        'user-1',
        'tenant-1',
        'admin:user:delete'
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should return false and log error on exception', async () => {
      // Arrange
      cacheRepo.getUserPermissions.mockRejectedValue(
        new Error('Redis connection error')
      );

      // Act
      const result = await service.checkPermission(
        'user-1',
        'tenant-1',
        'admin:user:read'
      );

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('checkAnyPermission', () => {
    it('should return true when user has any of the permissions', async () => {
      // Arrange
      cacheRepo.getUserPermissions.mockResolvedValue([
        'admin:user:read',
        'admin:user:write',
      ]);

      // Act
      const result = await service.checkAnyPermission('user-1', 'tenant-1', [
        'admin:user:delete',
        'admin:user:write',
      ]);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when user has none of the permissions', async () => {
      // Arrange
      cacheRepo.getUserPermissions.mockResolvedValue(['admin:user:read']);

      // Act
      const result = await service.checkAnyPermission('user-1', 'tenant-1', [
        'admin:user:delete',
        'admin:user:write',
      ]);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when permission array is empty', async () => {
      // Act
      const result = await service.checkAnyPermission('user-1', 'tenant-1', []);

      // Assert
      expect(result).toBe(false);
      expect(cacheRepo.getUserPermissions).not.toHaveBeenCalled();
    });

    it('should calculate permissions on cache miss', async () => {
      // Arrange
      cacheRepo.getUserPermissions.mockResolvedValue(null);

      userPermissionService.calculateAndCacheUserPermissions.mockResolvedValue({
        permissions: new Set(['admin:user:read', 'admin:user:write']),
      });

      // Act
      const result = await service.checkAnyPermission('user-1', 'tenant-1', [
        'admin:user:write',
        'admin:user:delete',
      ]);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('checkAllPermissions', () => {
    it('should return true when user has all permissions', async () => {
      // Arrange
      cacheRepo.getUserPermissions.mockResolvedValue([
        'admin:user:read',
        'admin:user:write',
        'admin:user:delete',
      ]);

      // Act
      const result = await service.checkAllPermissions('user-1', 'tenant-1', [
        'admin:user:read',
        'admin:user:write',
      ]);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when user is missing one permission', async () => {
      // Arrange
      cacheRepo.getUserPermissions.mockResolvedValue(['admin:user:read']);

      // Act
      const result = await service.checkAllPermissions('user-1', 'tenant-1', [
        'admin:user:read',
        'admin:user:write',
      ]);

      // Assert
      expect(result).toBe(false);
    });

    it('should return true when permission array is empty', async () => {
      // Act
      const result = await service.checkAllPermissions(
        'user-1',
        'tenant-1',
        []
      );

      // Assert
      expect(result).toBe(true); // No permissions required
      expect(cacheRepo.getUserPermissions).not.toHaveBeenCalled();
    });

    it('should calculate permissions on cache miss', async () => {
      // Arrange
      cacheRepo.getUserPermissions.mockResolvedValue(null);

      userPermissionService.calculateAndCacheUserPermissions.mockResolvedValue({
        permissions: new Set(['admin:user:read', 'admin:user:write']),
      });

      // Act
      const result = await service.checkAllPermissions('user-1', 'tenant-1', [
        'admin:user:read',
        'admin:user:write',
      ]);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('getUserPermissions', () => {
    it('should return cached permissions', async () => {
      // Arrange
      cacheRepo.getUserPermissions.mockResolvedValue([
        'admin:user:read',
        'admin:user:write',
      ]);

      // Act
      const result = await service.getUserPermissions('user-1', 'tenant-1');

      // Assert
      expect(result).toEqual(['admin:user:read', 'admin:user:write']);
      expect(
        userPermissionService.calculateAndCacheUserPermissions
      ).not.toHaveBeenCalled();
    });

    it('should calculate permissions on cache miss', async () => {
      // Arrange
      cacheRepo.getUserPermissions.mockResolvedValue(null);

      userPermissionService.calculateAndCacheUserPermissions.mockResolvedValue({
        permissions: new Set(['admin:user:read', 'admin:user:write']),
      });

      // Act
      const result = await service.getUserPermissions('user-1', 'tenant-1');

      // Assert
      expect(result).toEqual(['admin:user:read', 'admin:user:write']);
    });

    it('should return empty array on error', async () => {
      // Arrange
      cacheRepo.getUserPermissions.mockRejectedValue(new Error('Redis error'));

      // Act
      const result = await service.getUserPermissions('user-1', 'tenant-1');

      // Assert
      expect(result).toEqual([]);
    });
  });
});
