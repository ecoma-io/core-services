import { ExecutorContext } from '@nx/devkit';
import { setupExecutor, ExecutorSetupOptions } from './executor-setup';

jest.mock('@nx/devkit', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
  normalizePath: jest.fn((path: string) => path),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

jest.mock('@ecoma-io/parse-env-file', () => ({
  parseEnvFile: jest.fn(),
}));

jest.mock('@ecoma-io/expand-env', () => ({
  expandEnv: jest.fn(),
}));

describe('setupExecutor', () => {
  const mockContext: ExecutorContext = {
    projectGraph: {
      nodes: {
        'test-project': {
          data: {
            root: 'apps/test',
          },
        },
      },
      dependencies: {},
    } as unknown,
    projectName: 'test-project',
    root: '/workspace',
  } as ExecutorContext;

  beforeEach(async () => {
    jest.clearAllMocks();
    (require('fs').existsSync as jest.Mock).mockReturnValue(true);
    (
      require('@ecoma-io/parse-env-file').parseEnvFile as jest.Mock
    ).mockReturnValue({
      TEST_VAR: 'value',
    });
    (require('@ecoma-io/expand-env').expandEnv as jest.Mock).mockReturnValue({
      ...process.env,
      TEST_VAR: 'expanded',
    });
  });

  it('should return setup result when all valid', () => {
    // Arrange: Set up valid options and mock context
    const options: ExecutorSetupOptions = {
      dataSource: 'src/datasource.ts',
      tsConfig: 'tsconfig.json',
    };

    // Act: Call setupExecutor with valid inputs
    const result = setupExecutor(options, mockContext);

    // Assert: Verify the result contains expected values
    expect(result).toBeDefined();
    if (result) {
      expect(result.projectRoot).toBe('apps/test');
      expect(result.normalizedDataSource).toBe('src/datasource.ts');
      expect(result.dataSourcePath).toBe('/workspace/src/datasource.ts');
      expect(result.tsConfigPath).toBe('tsconfig.json');
      expect(result.envVars).toEqual({ ...process.env, TEST_VAR: 'expanded' });
    }
  });

  it('should return null if project root not found', () => {
    // Arrange: Create context without project root
    const context = {
      ...mockContext,
      projectGraph: { nodes: {}, dependencies: {} } as unknown,
    } as ExecutorContext;

    // Act: Call setupExecutor with invalid context
    const result = setupExecutor(
      { dataSource: 'src/datasource.ts', tsConfig: 'tsconfig.json' },
      context
    );

    // Assert: Verify null is returned and error is logged
    expect(result).toBeNull();
    expect(require('@nx/devkit').logger.error).toHaveBeenCalledWith(
      'Unable to determine project root.'
    );
  });

  it('should return null if datasource not found', () => {
    // Arrange: Mock existsSync to return false
    (require('fs').existsSync as jest.Mock).mockReturnValue(false);

    // Act: Call setupExecutor with non-existent datasource
    const result = setupExecutor(
      { dataSource: 'src/datasource.ts', tsConfig: 'tsconfig.json' },
      mockContext
    );

    // Assert: Verify null is returned and error is logged
    expect(result).toBeNull();
    expect(require('@nx/devkit').logger.error).toHaveBeenCalledWith(
      'DataSource file not found: /workspace/src/datasource.ts'
    );
  });

  it('should load env file if provided', () => {
    // Arrange: Set up options with envFile
    const options: ExecutorSetupOptions = {
      dataSource: 'src/datasource.ts',
      tsConfig: 'tsconfig.json',
      envFile: '.env',
    };

    // Act: Call setupExecutor with envFile option
    setupExecutor(options, mockContext);

    // Assert: Verify parseEnvFile was called and info logged
    expect(
      require('@ecoma-io/parse-env-file').parseEnvFile
    ).toHaveBeenCalledWith('.env', '/workspace');
    expect(require('@nx/devkit').logger.info).toHaveBeenCalledWith(
      'Loaded environment variables from .env'
    );
  });

  it('should warn if env file fails to load', () => {
    // Arrange: Mock parseEnvFile to throw error
    (
      require('@ecoma-io/parse-env-file').parseEnvFile as jest.Mock
    ).mockImplementation(() => {
      throw new Error('File not found');
    });
    const options: ExecutorSetupOptions = {
      dataSource: 'src/datasource.ts',
      tsConfig: 'tsconfig.json',
      envFile: '.env',
    };

    // Act: Call setupExecutor with failing envFile
    setupExecutor(options, mockContext);

    // Assert: Verify warning is logged
    expect(require('@nx/devkit').logger.warn).toHaveBeenCalledWith(
      'Failed to load env file .env: File not found'
    );
  });

  it('should include normalizedMigrationsDir if migrationsDir provided', () => {
    // Arrange: Set up options with migrationsDir
    const options: ExecutorSetupOptions = {
      dataSource: 'src/datasource.ts',
      tsConfig: 'tsconfig.json',
      migrationsDir: 'src/migrations',
    };

    // Act: Call setupExecutor with migrationsDir
    const result = setupExecutor(options, mockContext);

    // Assert: Verify normalizedMigrationsDir is set
    expect(result).toBeDefined();
    if (result) {
      expect(result.normalizedMigrationsDir).toBe('src/migrations');
    }
  });
});
