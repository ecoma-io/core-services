import { MembershipsController } from './memberships.controller';
import { NotFoundException } from '@ecoma-io/nestjs-exceptions';
import { MembershipEntity } from '@ecoma-io/iam-infrastructure';

describe('MembershipsController', () => {
  let controller: MembershipsController;
  let mockHandler: {
    execute: jest.Mock;
  };

  beforeEach(() => {
    mockHandler = {
      execute: jest.fn(),
    };
    controller = new MembershipsController(mockHandler as any);
  });

  describe('getMembership', () => {
    it('should return membership when found', async () => {
      // Arrange
      const membershipId = '123e4567-e89b-12d3-a456-426614174000';
      const mockMembership: MembershipEntity = {
        membershipId,
        userId: '456e7890-e89b-12d3-a456-426614174001',
        tenantId: '789e0123-e89b-12d3-a456-426614174002',
        roleIds: ['role-id-1', 'role-id-2'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockHandler.execute.mockResolvedValue(mockMembership);

      // Act
      const result = await controller.getMembership(membershipId);

      // Assert
      expect(result).toEqual(mockMembership);
      expect(mockHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ membershipId })
      );
    });

    it('should throw NotFoundException when membership not found', async () => {
      // Arrange
      const membershipId = 'non-existent-id';
      mockHandler.execute.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.getMembership(membershipId)).rejects.toThrow(
        NotFoundException
      );
      await expect(controller.getMembership(membershipId)).rejects.toThrow(
        `Membership ${membershipId} not found`
      );
      expect(mockHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ membershipId })
      );
    });

    it('should propagate handler errors', async () => {
      // Arrange
      const membershipId = '123e4567-e89b-12d3-a456-426614174000';
      const error = new Error('Database connection failed');
      mockHandler.execute.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getMembership(membershipId)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });
});
