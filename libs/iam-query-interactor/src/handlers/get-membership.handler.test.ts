import { GetMembershipHandler } from './get-membership.handler';
import { GetMembershipQuery } from '../queries/get-membership.query';
import { MembershipEntity } from '@ecoma-io/iam-infrastructure';

describe('GetMembershipHandler', () => {
  let handler: GetMembershipHandler;
  let mockRepository: {
    findById: jest.Mock;
  };

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
    };
    // Cast to any to bypass TypeScript strict checking for mock
    handler = new GetMembershipHandler(mockRepository as any);
  });

  describe('execute', () => {
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
      mockRepository.findById.mockResolvedValue(mockMembership);

      const query = new GetMembershipQuery(membershipId);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result).toEqual(mockMembership);
      expect(mockRepository.findById).toHaveBeenCalledWith(membershipId);
      expect(mockRepository.findById).toHaveBeenCalledTimes(1);
    });

    it('should return null when membership not found', async () => {
      // Arrange
      const membershipId = 'non-existent-id';
      mockRepository.findById.mockResolvedValue(null);

      const query = new GetMembershipQuery(membershipId);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result).toBeNull();
      expect(mockRepository.findById).toHaveBeenCalledWith(membershipId);
    });

    it('should propagate repository errors', async () => {
      // Arrange
      const membershipId = '123e4567-e89b-12d3-a456-426614174000';
      const error = new Error('Database connection failed');
      mockRepository.findById.mockRejectedValue(error);

      const query = new GetMembershipQuery(membershipId);

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow(
        'Database connection failed'
      );
      expect(mockRepository.findById).toHaveBeenCalledWith(membershipId);
    });
  });
});
