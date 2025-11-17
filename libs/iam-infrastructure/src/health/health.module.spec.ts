import { MODULE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import {
  HealthCheckController,
  HealthCheckService,
} from '@ecoma-io/nestjs-health';
import { HealthModule } from './health.module';
import { HealthService } from './health.service';

/**
 * Test suite for HealthModule.
 * @remarks This suite verifies the module's metadata, edge cases, and compilation behavior.
 */
describe('HealthModule', () => {
  /**
   * Test to verify correct module metadata with registered HealthCheckModule.
   * @remarks Ensures the module imports the expected DynamicModule with proper controllers, providers, and exports.
   */
  test('should have correct module metadata with the registered HealthCheckModule', () => {
    // Arrange: No special arrangement needed

    // Act: Retrieve the imports metadata from the module
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, HealthModule);

    // Assert: Verify the imports contain the expected DynamicModule from HealthCheckModule.register
    expect(imports).toHaveLength(1);
    const dynamicModule = imports[0];
    expect(dynamicModule).toHaveProperty('module', expect.any(Function)); // HealthCheckModule
    expect(dynamicModule.controllers).toEqual([HealthCheckController]);
    expect(dynamicModule.providers).toEqual([
      { provide: HealthCheckService, useClass: HealthService },
    ]);
    expect(dynamicModule.exports).toEqual([HealthCheckService]);
  });

  /**
   * Test to handle edge case where module metadata is accessed but module is not instantiable directly.
   * @remarks Verifies behavior when accessing invalid metadata and confirms the module remains a valid class.
   */
  test('should handle edge case where module metadata is accessed but module is not instantiable directly', () => {
    // Arrange: Attempt to access metadata for a non-existent property to simulate edge case
    const invalidMetadata = Reflect.getMetadata('INVALID_KEY', HealthModule);

    // Act: No act, just check the result

    // Assert: Verify that invalid metadata access returns undefined (edge case for metadata handling)
    expect(invalidMetadata).toBeUndefined();
    // Additionally, confirm the module is still a valid class
    expect(typeof HealthModule).toBe('function');
    expect(HealthModule.prototype).toBeDefined();
  });
});
