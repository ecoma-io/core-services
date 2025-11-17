import { Test, TestingModule } from '@nestjs/testing';
import { Redis } from 'ioredis';
import { PermissionCacheRepository } from './permission-cache.repository';

describe('PermissionCacheRepository', () => {
  let repository: PermissionCacheRepository;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as unknown as jest.Mocked<Redis>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionCacheRepository,
        {
          provide: Redis,
          useValue: mockRedis,
        },
      ],
    }).compile();

    repository = module.get<PermissionCacheRepository>(
      PermissionCacheRepository
    );
  });

  describe('getUserPermissions', () => {
    it('should return cached permissions', async () => {
      // Arrange
      const userId = 'user-123';
      const tenantId = 'tenant-456';
      const permissions = ['read:users', 'write:users'];
      mockRedis.get.mockResolvedValue(JSON.stringify(permissions));

      // Act
      const result = await repository.getUserPermissions(userId, tenantId);

      // Assert
      expect(result).toEqual(permissions);
      expect(mockRedis.get).toHaveBeenCalledWith(
        `user_perms:${userId}:${tenantId}`
      );
    });

    it('should return null if not cached', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);

      // Act
      const result = await repository.getUserPermissions(
        'user-123',
        'tenant-456'
      );

      // Assert
      expect(result).toBeNull();
    });

    it('should return null if JSON parse fails', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue('invalid-json');

      // Act
      const result = await repository.getUserPermissions(
        'user-123',
        'tenant-456'
      );

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('setUserPermissions', () => {
    it('should cache permissions with TTL', async () => {
      // Arrange
      const userId = 'user-123';
      const tenantId = 'tenant-456';
      const permissions = ['read:users', 'write:users'];
      mockRedis.setex.mockResolvedValue('OK');

      // Act
      await repository.setUserPermissions(userId, tenantId, permissions);

      // Assert
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `user_perms:${userId}:${tenantId}`,
        3600,
        JSON.stringify(permissions)
      );
    });
  });

  describe('invalidateUserPermissions', () => {
    it('should delete cached permissions', async () => {
      // Arrange
      const userId = 'user-123';
      const tenantId = 'tenant-456';
      mockRedis.del.mockResolvedValue(1);

      // Act
      await repository.invalidateUserPermissions(userId, tenantId);

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(
        `user_perms:${userId}:${tenantId}`
      );
    });
  });

  describe('getProjectionCheckpoint', () => {
    it('should return checkpoint as BigInt', async () => {
      // Arrange
      const projectorName = 'UserProjector';
      const checkpoint = '12345';
      mockRedis.get.mockResolvedValue(checkpoint);

      // Act
      const result = await repository.getProjectionCheckpoint(projectorName);

      // Assert
      expect(result).toBe(BigInt(12345));
      expect(mockRedis.get).toHaveBeenCalledWith(
        `projection:${projectorName}:checkpoint`
      );
    });

    it('should return null if checkpoint not found', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);

      // Act
      const result = await repository.getProjectionCheckpoint('UserProjector');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null if checkpoint format is invalid', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue('invalid');

      // Act
      const result = await repository.getProjectionCheckpoint('UserProjector');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('setProjectionCheckpoint', () => {
    it('should set checkpoint', async () => {
      // Arrange
      const projectorName = 'UserProjector';
      const position = BigInt(12345);
      mockRedis.set.mockResolvedValue('OK');

      // Act
      await repository.setProjectionCheckpoint(projectorName, position);

      // Assert
      expect(mockRedis.set).toHaveBeenCalledWith(
        `projection:${projectorName}:checkpoint`,
        '12345'
      );
    });
  });

  describe('waitForProjection', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return true when checkpoint is reached', async () => {
      // Arrange
      const projectorName = 'UserProjector';
      const targetPosition = BigInt(100);
      mockRedis.get.mockResolvedValue('100');

      // Act
      const promise = repository.waitForProjection(
        projectorName,
        targetPosition,
        1000
      );
      await jest.advanceTimersByTimeAsync(0);
      const result = await promise;

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when timeout is reached', async () => {
      // Arrange
      const projectorName = 'UserProjector';
      const targetPosition = BigInt(100);
      mockRedis.get.mockResolvedValue('50');

      // Act
      const promise = repository.waitForProjection(
        projectorName,
        targetPosition,
        500
      );
      await jest.advanceTimersByTimeAsync(600);
      const result = await promise;

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getCombinedPermissionsTree', () => {
    it('should return cached permissions tree', async () => {
      // Arrange
      const tree = { service1: { read: true } };
      mockRedis.get.mockResolvedValue(JSON.stringify(tree));

      // Act
      const result = await repository.getCombinedPermissionsTree();

      // Assert
      expect(result).toEqual(tree);
    });
  });

  describe('setCombinedPermissionsTree', () => {
    it('should cache permissions tree with TTL', async () => {
      // Arrange
      const tree = { service1: { read: true } };
      mockRedis.setex.mockResolvedValue('OK');

      // Act
      await repository.setCombinedPermissionsTree(tree);

      // Assert
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'permissions:combined-tree',
        3600,
        JSON.stringify(tree)
      );
    });
  });
});
