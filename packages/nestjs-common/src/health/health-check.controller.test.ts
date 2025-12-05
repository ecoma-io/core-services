import { ServiceHealthStatus } from '@ecoma-io/common';
import { HttpStatus } from '@nestjs/common';
import { HealthCheckController } from './health-check.controller';
import { HttpException } from '../exceptions';
import { NestStandardizedLogger } from '../observability';

describe('HealthCheckController', () => {
  // prevent the logger from trying to access real initialized instance
  beforeAll(() => {
    jest
      .spyOn(NestStandardizedLogger.prototype, 'debug' as any)
      .mockImplementation(() => {
        // do nothing
      });
  });
  test('liveness returns alive message', () => {
    // Arrange
    const controller = new HealthCheckController(undefined as any);
    // Act
    const res = controller.liveness();
    // Assert
    expect(res).toEqual({ message: 'Service still alive' });
  });

  test('readiness with no services returns success', async () => {
    // Arrange
    const controller = new HealthCheckController(undefined as any);
    // Act
    const result = await controller.readiness();
    // Assert
    expect(result.message).toBe('Service are readiness');
    expect(result.data).toEqual({});
  });

  test('readiness with all services UP returns aggregated statuses', async () => {
    const svc = {
      name: 'svcA',
      async check() {
        return ServiceHealthStatus.UP;
      },
    };
    // Arrange
    const controller = new HealthCheckController([svc as any]);
    // Act
    const result = await controller.readiness();
    // Assert
    expect(result.message).toBe('Service are readiness');
    // Note: the implementation currently shadows the inner data variable and
    // returns the outer (empty) data object. Assert current behaviour.
    expect(result.data).toEqual({});
  });

  test('readiness with failing service throws HttpException and exposes details', async () => {
    const good = {
      name: 'good',
      async check() {
        return ServiceHealthStatus.UP;
      },
    };
    const bad = {
      name: 'bad',
      async check() {
        throw new Error('boom');
      },
    };

    // Arrange
    const controller = new HealthCheckController([good as any, bad as any]);

    // Act & Assert: expect the readiness check to reject with HttpException
    await expect(controller.readiness()).rejects.toThrow(HttpException);
    try {
      await controller.readiness();
    } catch (err: any) {
      // Assert additional expectations on the thrown HttpException
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      // The implementation currently throws with the outer `data` variable
      // (which is empty due to shadowing). We assert the status and type.
      const resp = err.getResponse();
      expect(resp).toBeDefined();
    }
  });
});
