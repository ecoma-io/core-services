import 'reflect-metadata';
import { validateConfig } from './validate-config';
import { IntrinsicException } from '@ecoma-io/common';
import { IsString, IsNumber, IsOptional } from 'class-validator';

class TestConfig {
  @IsString()
  requiredString!: string;

  @IsNumber()
  requiredNumber!: number;

  @IsOptional()
  @IsString()
  optionalString?: string;
}

describe('validateConfig', () => {
  test('should return validated config object for valid environment variables', () => {
    // Arrange: Define valid environment variables and the config class.
    const env = {
      requiredString: 'test',
      requiredNumber: '42',
      optionalString: 'optional',
    };

    // Act: Call validateConfig with the env and class.
    const result = validateConfig(env, TestConfig);

    // Assert: Verify the result is an instance of TestConfig with correct values.
    expect(result).toBeInstanceOf(TestConfig);
    expect(result.requiredString).toBe('test');
    expect(result.requiredNumber).toBe(42);
    expect(result.optionalString).toBe('optional');
  });

  test('should throw IntrinsicException for invalid environment variables', () => {
    // Arrange: Define invalid environment variables (missing required field).
    const env = {
      requiredNumber: '42',
      // requiredString is missing
    };

    // Act & Assert: Call validateConfig and expect it to throw IntrinsicException.
    expect(() => validateConfig(env, TestConfig)).toThrow(IntrinsicException);
    expect(() => validateConfig(env, TestConfig)).toThrow(
      'Process environment validation failed:'
    );
  });

  test('should throw IntrinsicException for type mismatch in environment variables', () => {
    // Arrange: Define environment variables with type mismatch (string instead of number).
    const env = {
      requiredString: 'test',
      requiredNumber: 'not-a-number',
    };

    // Act & Assert: Call validateConfig and expect it to throw IntrinsicException.
    expect(() => validateConfig(env, TestConfig)).toThrow(IntrinsicException);
    expect(() => validateConfig(env, TestConfig)).toThrow(
      'Process environment validation failed:'
    );
  });

  test('should handle empty environment variables object', () => {
    // Arrange: Define empty environment variables.
    const env = {};

    // Act & Assert: Call validateConfig and expect it to throw IntrinsicException due to missing required fields.
    expect(() => validateConfig(env, TestConfig)).toThrow(IntrinsicException);
  });

  test('should handle null environment variables', () => {
    // Arrange: Define null environment variables (though Record<string, string> expects object, test edge case).
    const env = null as any;

    // Act & Assert: Call validateConfig and expect it to throw IntrinsicException or handle gracefully.
    expect(() => validateConfig(env, TestConfig)).toThrow(IntrinsicException);
  });
});
