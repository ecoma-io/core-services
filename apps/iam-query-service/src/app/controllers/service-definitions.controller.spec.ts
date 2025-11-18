import { Test, TestingModule } from '@nestjs/testing';
import { ServiceDefinitionsController } from './service-definitions.controller';
import { GetServiceDefinitionHandler } from '@ecoma-io/iam-query-interactor';
import { NotFoundException } from '@ecoma-io/nestjs-exceptions';

describe('ServiceDefinitionsController', () => {
  let controller: ServiceDefinitionsController;
  let handler: GetServiceDefinitionHandler;

  beforeEach(async () => {
    const mockHandler = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceDefinitionsController],
      providers: [
        {
          provide: GetServiceDefinitionHandler,
          useValue: mockHandler,
        },
      ],
    }).compile();

    controller = module.get<ServiceDefinitionsController>(
      ServiceDefinitionsController
    );
    handler = module.get<GetServiceDefinitionHandler>(
      GetServiceDefinitionHandler
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getServiceDefinition', () => {
    const serviceId = '550e8400-e29b-41d4-a716-446655440000';
    const mockService = {
      serviceId,
      name: 'resource-service',
      versions: [
        {
          version: '3.2.1',
          permissionsTree: { resources: { read: {}, write: {} } },
          publishedAt: '2025-11-18T08:00:00.000Z',
        },
        {
          version: '2.5.0',
          permissionsTree: { resources: { read: {} } },
          publishedAt: '2025-10-15T08:00:00.000Z',
        },
        {
          version: '1.9.3',
          permissionsTree: { resources: { list: {} } },
          publishedAt: '2025-09-01T08:00:00.000Z',
        },
      ],
      createdAt: new Date('2025-09-01T08:00:00.000Z'),
      updatedAt: new Date('2025-11-18T08:00:00.000Z'),
    };

    it('should return service definition when found', async () => {
      jest.spyOn(handler, 'execute').mockResolvedValue(mockService as any);

      const result = await controller.getServiceDefinition(serviceId);

      expect(result).toEqual(mockService);
      expect(handler.execute).toHaveBeenCalledWith({ serviceId });
    });

    it('should throw NotFoundException when service not found', async () => {
      jest.spyOn(handler, 'execute').mockResolvedValue(null);

      await expect(controller.getServiceDefinition(serviceId)).rejects.toThrow(
        new NotFoundException(`ServiceDefinition ${serviceId} not found`)
      );
    });

    it('should propagate handler errors', async () => {
      const error = new Error('Database connection failed');
      jest.spyOn(handler, 'execute').mockRejectedValue(error);

      await expect(controller.getServiceDefinition(serviceId)).rejects.toThrow(
        error
      );
    });
  });
});
