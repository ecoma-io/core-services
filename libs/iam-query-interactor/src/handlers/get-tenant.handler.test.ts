import { Test, TestingModule } from '@nestjs/testing';
import { GetTenantHandler } from './get-tenant.handler';
import { TenantReadRepository } from '@ecoma-io/iam-infrastructure';
import { TenantEntity } from '@ecoma-io/iam-infrastructure';
import { GetTenantQuery } from '../queries/get-tenant.query';

describe('GetTenantHandler', () => {
  let handler: GetTenantHandler;
  let mockRepository: jest.Mocked<TenantReadRepository>;

  beforeEach(async () => {
    // Create mock repository
    mockRepository = {
      findById: jest.fn(),
      findByNamespace: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetTenantHandler,
        {
          provide: TenantReadRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    handler = module.get<GetTenantHandler>(GetTenantHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return tenant when found', async () => {
      // Arrange
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const query: GetTenantQuery = { tenantId };
      const expectedTenant: TenantEntity = {
        tenantId,
        name: 'Test Tenant',
        namespace: 'test-tenant',
        metadata: { tier: 'premium' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(expectedTenant);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(mockRepository.findById).toHaveBeenCalledWith(tenantId);
      expect(mockRepository.findById).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedTenant);
    });

    it('should return null when tenant not found', async () => {
      // Arrange
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const query: GetTenantQuery = { tenantId };

      mockRepository.findById.mockResolvedValue(null);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(mockRepository.findById).toHaveBeenCalledWith(tenantId);
      expect(mockRepository.findById).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it('should propagate repository errors', async () => {
      // Arrange
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const query: GetTenantQuery = { tenantId };
      const error = new Error('Database connection failed');

      mockRepository.findById.mockRejectedValue(error);

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow(
        'Database connection failed'
      );
      expect(mockRepository.findById).toHaveBeenCalledWith(tenantId);
    });
  });
});
