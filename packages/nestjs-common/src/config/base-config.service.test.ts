import { ClassConstructor } from 'class-transformer';
import {
  BaseConfigService,
  BaseProcessEnvironment,
} from './base-config.service';
import { expandEnv } from './expand-env';
import { validateConfig } from './validate-config';

// Mock external dependencies
jest.mock('./expand-env');
jest.mock('./validate-config');
// Note: don't mock 'class-transformer' here because decorators like `@Transform` are used
// in the imported `BaseProcessEnvironment` class and need the real implementation.

// Define a concrete subclass for testing since BaseConfigService is abstract
class TestConfigService extends BaseConfigService<
  BaseProcessEnvironment & { key: string }
> {
  constructor(
    validator: ClassConstructor<BaseProcessEnvironment & { key: string }>
  ) {
    super(validator as any);
  }

  public getEnvironments(): BaseProcessEnvironment & { key: string } {
    return this.environments as BaseProcessEnvironment & { key: string };
  }
}

describe('BaseConfigService', () => {
  let mockExpandEnv: jest.MockedFunction<typeof expandEnv>;
  let mockValidateConfig: jest.MockedFunction<typeof validateConfig>;
  let mockValidator: ClassConstructor<BaseProcessEnvironment & { key: string }>;

  beforeEach(() => {
    // Reset static property before each test
    (BaseConfigService as any).environments = undefined;

    mockExpandEnv = expandEnv as jest.MockedFunction<typeof expandEnv>;
    mockValidateConfig = validateConfig as jest.MockedFunction<
      typeof validateConfig
    >;
    mockValidator = {} as ClassConstructor<
      BaseProcessEnvironment & { key: string }
    >;

    // Mock process.env
    process.env = { TEST_KEY: 'test_value' };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize environments on first instantiation (happy path)', () => {
    // Arrange: Set up mocks for successful expansion and validation
    const expandedEnv = { key: 'expanded_value' };
    const validatedEnv = { key: 'validated_value' };
    mockExpandEnv.mockReturnValue(expandedEnv);
    mockValidateConfig.mockReturnValue(validatedEnv);

    // Act: Create an instance
    const service = new TestConfigService(mockValidator);

    // Assert: Check that environments are set and methods were called correctly
    expect(mockExpandEnv).toHaveBeenCalledWith(process.env);
    expect(mockValidateConfig).toHaveBeenCalledWith(expandedEnv, mockValidator);
    expect(service.getEnvironments()).toEqual(validatedEnv);
  });

  test('should not re-initialize environments on subsequent instantiations', () => {
    // Arrange: Set up mocks
    const validatedEnv = { key: 'validated_value' };
    mockExpandEnv.mockReturnValue({ key: 'expanded_value' });
    mockValidateConfig.mockReturnValue(validatedEnv);

    // Act: Create first instance
    const service1 = new TestConfigService(mockValidator);
    // Create second instance
    const service2 = new TestConfigService(mockValidator);

    // Assert: expandEnv and validateConfig should only be called once
    expect(mockExpandEnv).toHaveBeenCalledTimes(1);
    expect(mockValidateConfig).toHaveBeenCalledTimes(1);
    expect(service1.getEnvironments()).toEqual(validatedEnv);
    expect(service2.getEnvironments()).toEqual(validatedEnv);
  });

  test('should throw error if validateConfig fails (error handling)', () => {
    // Arrange: Mock validateConfig to throw an error
    const error = new Error('Validation failed');
    mockExpandEnv.mockReturnValue({ key: 'expanded_value' });
    mockValidateConfig.mockImplementation(() => {
      throw error;
    });

    // Act & Assert: Creating an instance should throw the error
    expect(() => new TestConfigService(mockValidator)).toThrow(error);
    expect(mockExpandEnv).toHaveBeenCalledWith(process.env);
    expect(mockValidateConfig).toHaveBeenCalledWith(
      { key: 'expanded_value' },
      mockValidator
    );
  });

  test('should handle empty process.env (edge case)', () => {
    // Arrange: Set process.env to empty and mock successful validation
    process.env = {};
    const expandedEnv = {};
    const validatedEnv = { key: 'default' };
    mockExpandEnv.mockReturnValue(expandedEnv);
    mockValidateConfig.mockReturnValue(validatedEnv);

    // Act: Create an instance
    const service = new TestConfigService(mockValidator);

    // Assert: Should still work with empty env
    expect(mockExpandEnv).toHaveBeenCalledWith({});
    expect(mockValidateConfig).toHaveBeenCalledWith(expandedEnv, mockValidator);
    expect(service.getEnvironments()).toEqual(validatedEnv);
  });

  test('should handle null process.env (edge case)', () => {
    // Arrange: Set process.env to null (though in reality it's an object, for edge case)
    // Note: process.env is always an object, but we can mock expandEnv to handle it
    const originalEnv = process.env;
    (process as any).env = null;
    const expandedEnv = {};
    const validatedEnv = { key: 'default' };
    mockExpandEnv.mockReturnValue(expandedEnv);
    mockValidateConfig.mockReturnValue(validatedEnv);

    // Act: Create an instance
    const service = new TestConfigService(mockValidator);

    // Assert: Should handle null env gracefully
    expect(mockExpandEnv).toHaveBeenCalledWith(null);
    expect(mockValidateConfig).toHaveBeenCalledWith(expandedEnv, mockValidator);
    expect(service.getEnvironments()).toEqual(validatedEnv);

    // Restore
    process.env = originalEnv;
  });
});
