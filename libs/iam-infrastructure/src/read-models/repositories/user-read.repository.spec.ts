import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserReadRepository } from './user-read.repository';
import { UserEntity } from '../entities/user.entity';

describe('UserReadRepository', () => {
  let repository: UserReadRepository;
  let mockRepo: jest.Mocked<Repository<UserEntity>>;

  beforeEach(async () => {
    mockRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserEntity>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserReadRepository,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockRepo,
        },
      ],
    }).compile();

    repository = module.get<UserReadRepository>(UserReadRepository);
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      // Arrange
      const userId = 'user-123';
      const user: UserEntity = {
        userId,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        status: 'Active',
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepo.findOne.mockResolvedValue(user);

      // Act
      const result = await repository.findById(userId);

      // Assert
      expect(result).toEqual(user);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { userId } });
    });

    it('should return null if user not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act
      const result = await repository.findById('nonexistent');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      // Arrange
      const email = 'test@example.com';
      const user: UserEntity = {
        userId: 'user-123',
        email,
        status: 'Active',
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepo.findOne.mockResolvedValue(user);

      // Act
      const result = await repository.findByEmail(email);

      // Assert
      expect(result).toEqual(user);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { email } });
    });
  });

  describe('findBySocialProvider', () => {
    it('should find user by social provider', async () => {
      // Arrange
      const provider = 'google';
      const providerId = 'google-123';
      const user: UserEntity = {
        userId: 'user-123',
        email: 'test@example.com',
        status: 'Active',
        mfaEnabled: false,
        socialLinks: [{ provider, providerId }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(user),
      };
      mockRepo.createQueryBuilder.mockReturnValue(
        queryBuilder as unknown as ReturnType<
          Repository<UserEntity>['createQueryBuilder']
        >
      );

      // Act
      const result = await repository.findBySocialProvider(
        provider,
        providerId
      );

      // Assert
      expect(result).toEqual(user);
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'user.social_links @> :link::jsonb',
        { link: JSON.stringify([{ provider, providerId }]) }
      );
    });
  });

  describe('save', () => {
    it('should save user', async () => {
      // Arrange
      const user: UserEntity = {
        userId: 'user-123',
        email: 'test@example.com',
        status: 'Active',
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepo.save.mockResolvedValue(user);

      // Act
      await repository.save(user);

      // Assert
      expect(mockRepo.save).toHaveBeenCalledWith(user);
    });
  });

  describe('delete', () => {
    it('should delete user by ID', async () => {
      // Arrange
      const userId = 'user-123';
      mockRepo.delete.mockResolvedValue({ affected: 1, raw: {} });

      // Act
      await repository.delete(userId);

      // Assert
      expect(mockRepo.delete).toHaveBeenCalledWith({ userId });
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      // Arrange
      const users: UserEntity[] = [
        {
          userId: 'user-1',
          email: 'user1@example.com',
          status: 'Active',
          mfaEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          userId: 'user-2',
          email: 'user2@example.com',
          status: 'Active',
          mfaEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockRepo.findAndCount.mockResolvedValue([users, 2]);

      // Act
      const result = await repository.findAll({ skip: 0, take: 10 });

      // Assert
      expect(result).toEqual({ users, total: 2 });
      expect(mockRepo.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        order: { createdAt: 'DESC' },
      });
    });
  });
});
