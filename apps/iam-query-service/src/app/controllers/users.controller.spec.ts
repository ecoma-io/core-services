import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { GetUserHandler } from '@ecoma-io/iam-query-interactor';
import { NotFoundException } from '@ecoma-io/nestjs-exceptions';

describe('UsersController', () => {
  let controller: UsersController;
  let getUserHandler: jest.Mocked<GetUserHandler>;

  beforeEach(async () => {
    const mockGetUserHandler = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: GetUserHandler,
          useValue: mockGetUserHandler,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    getUserHandler = module.get(GetUserHandler);
  });

  describe('getUser', () => {
    it('should return user when found', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUser = {
        userId,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: new Date(),
      };
      getUserHandler.execute.mockResolvedValue(mockUser as any);

      // Act
      const result = await controller.getUser(userId);

      // Assert
      expect(result).toEqual(mockUser);
      expect(getUserHandler.execute).toHaveBeenCalledWith({
        userId,
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      const userId = 'non-existent-user';
      getUserHandler.execute.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.getUser(userId)).rejects.toThrow(
        NotFoundException
      );
      await expect(controller.getUser(userId)).rejects.toThrow(
        `User ${userId} not found`
      );
    });

    it('should propagate handler errors', async () => {
      // Arrange
      const userId = 'user-123';
      const error = new Error('Database connection failed');
      getUserHandler.execute.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getUser(userId)).rejects.toThrow(error);
    });
  });
});
