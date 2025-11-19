import { HealthCheckModule } from './health-check.module';
import { HealthCheckController } from './health-check.controller';
import { HealthCheckService } from './health-check.service';
import { DynamicModule, Type } from '@nestjs/common';
import { SuccessResponse, HealthDetails } from '@ecoma-io/common';

// Mock implementation for testing
class MockHealthCheckService implements HealthCheckService {
  async check(): Promise<SuccessResponse<HealthDetails>> {
    return { message: 'ok' };
  }
}

describe('HealthCheckModule', () => {
  test('register should return a valid DynamicModule with correct configuration (Arrange, Act, Assert)', () => {
    // Arrange: Define a mock implementation class
    const implementation: Type<HealthCheckService> = MockHealthCheckService;

    // Act: Call the register method
    const result: DynamicModule = HealthCheckModule.register(implementation);

    // Assert: Verify the returned DynamicModule structure
    expect(result).toHaveProperty('module', HealthCheckModule);
    expect(result.controllers).toEqual([HealthCheckController]);
    expect(result.providers).toEqual([
      { provide: HealthCheckService, useClass: implementation },
    ]);
    expect(result.exports).toEqual([HealthCheckService]);
  });

  test('register should handle different implementation classes correctly (Arrange, Act, Assert)', () => {
    // Arrange: Define another mock implementation class
    class AnotherMockHealthCheckService implements HealthCheckService {
      async check(): Promise<SuccessResponse<HealthDetails>> {
        return { message: 'another ok' };
      }
    }
    const implementation: Type<HealthCheckService> =
      AnotherMockHealthCheckService;

    // Act: Call the register method
    const result: DynamicModule = HealthCheckModule.register(implementation);

    // Assert: Verify the configuration uses the new implementation
    expect(result.providers).toEqual([
      { provide: HealthCheckService, useClass: implementation },
    ]);
    expect(
      (
        result.providers?.[0] as {
          provide: typeof HealthCheckService;
          useClass: Type<HealthCheckService>;
        }
      )?.useClass
    ).toBe(AnotherMockHealthCheckService);
  });

  test('register should return consistent structure for edge case with minimal implementation (Arrange, Act, Assert)', () => {
    // Arrange: Define a minimal mock implementation (edge case: class with no methods, but TypeScript ensures it implements the interface)
    class MinimalMockHealthCheckService implements HealthCheckService {
      async check(): Promise<SuccessResponse<HealthDetails>> {
        return {};
      }
    }
    const implementation: Type<HealthCheckService> =
      MinimalMockHealthCheckService;

    // Act: Call the register method
    const result: DynamicModule = HealthCheckModule.register(implementation);

    // Assert: Verify the structure remains correct even with minimal implementation
    expect(result.module).toBe(HealthCheckModule);
    expect(result.controllers).toHaveLength(1);
    expect(result.providers).toHaveLength(1);
    expect(result.exports).toHaveLength(1);
  });
});
