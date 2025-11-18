import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@ecoma-io/nestjs-exceptions';
import { TenantsController } from './tenants.controller';
import { GetTenantHandler } from '@ecoma-io/iam-query-interactor';
import { TenantEntity } from '@ecoma-io/iam-infrastructure';

describe('TenantsController', () => {
  let controller: TenantsController;
  let mockHandler: jest.Mocked<GetTenantHandler>;

  beforeEach(async () => {
    mockHandler = {
      execute: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        {
          provide: GetTenantHandler,
          useValue: mockHandler,
        },
      ],
    }).compile();

    controller = module.get<TenantsController>(TenantsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTenant', () => {
    it('should return tenant when found', async () => {
      // Arrange
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const tenantEntity: TenantEntity = {
        tenantId,
        name: 'Test Tenant',
        namespace: 'test-tenant',
        metadata: { tier: 'premium' },
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
      };

      mockHandler.execute.mockResolvedValue(tenantEntity);

      // Act
      const result = await controller.getTenant(tenantId);

      // Assert
      expect(mockHandler.execute).toHaveBeenCalledWith({ tenantId });
      expect(mockHandler.execute).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        id: tenantId,
        name: 'Test Tenant',
        namespace: 'test-tenant',
        metadata: { tier: 'premium' },
        createdAt: tenantEntity.createdAt,
        updatedAt: tenantEntity.updatedAt,
      });
    });

    it('should throw NotFoundException when tenant not found', async () => {
      // Arrange
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      mockHandler.execute.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.getTenant(tenantId)).rejects.toThrow(
        NotFoundException
      );
      await expect(controller.getTenant(tenantId)).rejects.toThrow(
        `Tenant ${tenantId} not found`
      );
      expect(mockHandler.execute).toHaveBeenCalledWith({ tenantId });
    });

    it('should propagate handler errors', async () => {
      // Arrange
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const error = new Error('Database connection failed');
      mockHandler.execute.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getTenant(tenantId)).rejects.toThrow(
        'Database connection failed'
      );
      expect(mockHandler.execute).toHaveBeenCalledWith({ tenantId });
    });
  });
});
