import { GetRoleHandler } from './get-role.handler';
import { RoleReadRepository } from '@ecoma-io/iam-infrastructure';
import { GetRoleQuery } from '../queries/get-role.query';

describe('GetRoleHandler', () => {
  let handler: GetRoleHandler;
  let mockRoleRepo: jest.Mocked<RoleReadRepository>;

  beforeEach(() => {
    mockRoleRepo = {
      findById: jest.fn(),
    } as any;

    handler = new GetRoleHandler(mockRoleRepo);
  });

  describe('execute', () => {
    it('should return role when found', async () => {
      // Arrange
      const roleId = 'role-123';
      const query: GetRoleQuery = { roleId };
      const mockRole = {
        roleId,
        tenantId: 'tenant-456',
        name: 'Admin',
        permissionKeys: ['admin:user:read'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRoleRepo.findById.mockResolvedValue(mockRole as any);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result).toEqual(mockRole);
      expect(mockRoleRepo.findById).toHaveBeenCalledWith(roleId);
    });

    it('should return null when role not found', async () => {
      // Arrange
      const roleId = 'non-existent';
      const query: GetRoleQuery = { roleId };
      mockRoleRepo.findById.mockResolvedValue(null);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result).toBeNull();
      expect(mockRoleRepo.findById).toHaveBeenCalledWith(roleId);
    });

    it('should propagate repository errors', async () => {
      // Arrange
      const roleId = 'role-123';
      const query: GetRoleQuery = { roleId };
      const error = new Error('Database error');
      mockRoleRepo.findById.mockRejectedValue(error);

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow(error);
    });
  });
});
