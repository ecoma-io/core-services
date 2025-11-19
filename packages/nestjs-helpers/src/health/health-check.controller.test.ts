import { HealthCheckController } from './health-check.controller';
import { HealthCheckService } from './health-check.service';
import { SuccessResponse, HealthDetails } from '@ecoma-io/common';

describe('HealthCheckController', () => {
  let mockHealthService: Partial<HealthCheckService> & { check: jest.Mock };
  let controller: HealthCheckController;

  beforeEach(() => {
    mockHealthService = {
      check: jest.fn(),
    };
    controller = new HealthCheckController(
      mockHealthService as unknown as HealthCheckService
    );
  });

  test('liveness should return simple success payload (Arrange, Act, Assert)', () => {
    // Arrange: nothing to mock for liveness

    // Act: call liveness
    const result = controller.liveness();

    // Assert: expect the static success response
    expect(result).toEqual({ message: 'Service still alive' });
  });

  test('readiness should delegate to healthService.check and return its result (Arrange, Act, Assert)', async () => {
    // Arrange: prepare expected success payload
    const expected: SuccessResponse<HealthDetails> = {
      message: 'ok',
      data: { db: { healthy: true } } as unknown as HealthDetails,
    };
    mockHealthService.check.mockResolvedValue(expected);

    // Act: call readiness
    const result = await controller.readiness();

    // Assert: service called and result returned
    expect(mockHealthService.check).toHaveBeenCalledTimes(1);
    expect(result).toBe(expected);
  });

  test('readiness should propagate errors from healthService.check (Arrange, Act, Assert)', async () => {
    // Arrange: prepare a rejection from the health service
    const err = new Error('Dependency down');
    mockHealthService.check.mockRejectedValue(err);

    // Act & Assert: readiness should reject with the same error
    await expect(controller.readiness()).rejects.toThrow('Dependency down');
    expect(mockHealthService.check).toHaveBeenCalledTimes(1);
  });

  test('readiness should return edge-case payloads unchanged (Arrange, Act, Assert)', async () => {
    // Arrange: health service returns an "empty" or incomplete payload
    const edgePayload: SuccessResponse<HealthDetails> = {
      message: '',
      data: null as unknown as HealthDetails,
    };
    mockHealthService.check.mockResolvedValue(edgePayload);

    // Act: call readiness
    const result = await controller.readiness();

    // Assert: same object/value is returned
    expect(result).toBe(edgePayload);
    expect(result.message).toBe('');
    expect(result.data).toBeNull();
  });
});
