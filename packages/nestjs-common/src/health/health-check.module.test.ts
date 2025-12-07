import {
  HealthCheckModule,
  HEALTH_CHECK_SERVICES,
} from './health-check.module';
import { HealthCheckController } from './health-check.controller';

describe('healthCheckModule', () => {
  test('register returns DynamicModule with controller and providers', () => {
    // Arrange
    class DummyChecker {}

    // Act
    const mod = HealthCheckModule.register([DummyChecker as any], {
      imports: [],
      extras: [],
    } as any);

    // Assert
    expect(mod).toBeDefined();
    expect(mod.controllers).toContain(HealthCheckController);
    const found = (mod.providers || []).find(
      (p: any) => p && p.provide === HEALTH_CHECK_SERVICES
    );
    expect(found).toBeDefined();
    expect((found as any).useClass).toBe(DummyChecker);
  });
});
