import {
  CORE_PRODUCT_REQUIRED_ENV_VARS,
  validateEnvVars,
} from './required-env-vars';

describe('validateEnvVars', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Preserve original environment to avoid leaking between tests
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment and reset module cache
    process.env = originalEnv;
    jest.resetModules();
  });

  test('does not throw when all required env vars are set', () => {
    // Arrange
    for (const name of CORE_PRODUCT_REQUIRED_ENV_VARS) {
      process.env[name] = 'present';
    }

    // Act & Assert
    expect(() => validateEnvVars()).not.toThrow();
  });

  test('throws when the first required env var is missing', () => {
    // Arrange
    for (const name of CORE_PRODUCT_REQUIRED_ENV_VARS) {
      process.env[name] = 'present';
    }
    const missing = CORE_PRODUCT_REQUIRED_ENV_VARS[0];
    delete process.env[missing];

    // Act & Assert
    expect(() => validateEnvVars()).toThrow(
      new Error(`Environment variable ${missing} is required but not set`)
    );
  });

  test('throws when a middle required env var is missing', () => {
    // Arrange
    for (const name of CORE_PRODUCT_REQUIRED_ENV_VARS) {
      process.env[name] = 'present';
    }
    const idx = Math.floor(CORE_PRODUCT_REQUIRED_ENV_VARS.length / 2);
    const missing = CORE_PRODUCT_REQUIRED_ENV_VARS[idx];
    delete process.env[missing];

    // Act & Assert
    expect(() => validateEnvVars()).toThrow(
      `Environment variable ${missing} is required but not set`
    );
  });
});
