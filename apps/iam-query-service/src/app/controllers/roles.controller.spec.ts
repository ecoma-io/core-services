import { Test, TestingModule } from '@nestjs/testing';
import { RolesController } from './roles.controller';
import { GetRoleHandler } from '@ecoma-io/iam-query-interactor';
import { NotFoundException } from '@ecoma-io/nestjs-exceptions';

describe('RolesController', () => {
  let controller: RolesController;
  let getRoleHandler: jest.Mocked<GetRoleHandler>;

  beforeEach(async () => {
    const mockGetRoleHandler = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        {
          provide: GetRoleHandler,
          useValue: mockGetRoleHandler,
        },
      ],
    }).compile();

    controller = module.get<RolesController>(RolesController);
    getRoleHandler = module.get(GetRoleHandler);
  });

  describe('getRole', () => {
    it('should return role when found', async () => {
      // Arrange
      const roleId = 'role-123';
      const mockRole = {
        roleId,
        tenantId: 'tenant-456',
        name: 'Admin',
        permissionKeys: ['admin:user:read', 'admin:user:write'],
        createdAt: new Date(),
      };
      getRoleHandler.execute.mockResolvedValue(mockRole as any);

      // Act
      const result = await controller.getRole(roleId);

      // Assert
      expect(result).toEqual(mockRole);
      expect(getRoleHandler.execute).toHaveBeenCalledWith({
        roleId,
      });
    });

    it('should throw NotFoundException when role not found', async () => {
      // Arrange
      const roleId = 'non-existent-role';
      getRoleHandler.execute.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.getRole(roleId)).rejects.toThrow(
        NotFoundException
      );
      await expect(controller.getRole(roleId)).rejects.toThrow(
        `Role ${roleId} not found`
      );
    });

    it('should propagate handler errors', async () => {
      // Arrange
      const roleId = 'role-123';
      const error = new Error('Database connection failed');
      getRoleHandler.execute.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getRole(roleId)).rejects.toThrow(error);
    });
  });
});
