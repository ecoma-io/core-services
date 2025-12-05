import { HealthChecker } from './health-checker';
import { ServiceHealthStatus } from '@ecoma-io/common';

class TestHealthChecker extends HealthChecker {
  readonly name = 'test-dep';
  async check(): Promise<ServiceHealthStatus> {
    return ServiceHealthStatus.UP;
  }
}

test('HealthChecker concrete implementation returns ServiceHealthStatus', async () => {
  // Arrange
  const c = new TestHealthChecker();

  // Act
  const status = await c.check();

  // Assert
  expect(status).toBe(ServiceHealthStatus.UP);
  expect(c.name).toBe('test-dep');
});
