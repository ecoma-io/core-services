import { ExecutorContext } from '@nx/devkit';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import buildExecutor, { IBuildExecutorOptions } from './build';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

jest.mock('@nx/devkit', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('buildExecutor', () => {
  let context: Partial<ExecutorContext>;

  beforeEach(() => {
    jest.clearAllMocks();
    (jest.mocked(existsSync)).mockReturnValue(true);
    context = {
      root: '/workspace',
      projectName: 'test-project',
      projectGraph: {
        nodes: {
          'test-project': {
            type: 'app',
            name: 'test-project',
            data: {
              root: 'apps/test-project',
              sourceRoot: 'apps/test-project/src',
            },
          },
        },
        dependencies: {},
      },
      cwd: '/workspace/apps/test-project',
    };
  });

  afterEach(() => {
    // Reset mocks between tests for isolation
    jest.resetAllMocks();
  });

  it('should build successfully with basic options', async () => {
    // Arrange
    const options: IBuildExecutorOptions = { name: 'my-image' };
    (jest.mocked(execSync)).mockReturnValue(undefined);

    // Act
    const result = await buildExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --load=true -t my-image -f /workspace/apps/test-project/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace/apps/test-project' }
    );
  });

  it('should use default name when not provided', async () => {
    // Arrange
    const options = {} as IBuildExecutorOptions;
    (jest.mocked(execSync)).mockReturnValue(undefined);

    // Act
    const result = await buildExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --load=true -t test-project -f /workspace/apps/test-project/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace/apps/test-project' }
    );
  });

  it('should interpolate placeholders in name', async () => {
    // Arrange
    const options: IBuildExecutorOptions = {
      name: '{projectName}-{sourceRoot}',
    };
    (jest.mocked(execSync)).mockReturnValue(undefined);

    // Act
    const result = await buildExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --load=true -t test-project-workspace-apps-test-project-src -f /workspace/apps/test-project/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace/apps/test-project' }
    );
  });

  it('should not add --load if load is false', async () => {
    // Arrange
    const options: IBuildExecutorOptions = { name: 'my-image', load: false };
    (jest.mocked(execSync)).mockReturnValue(undefined);

    // Act
    const result = await buildExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --load=false -t my-image -f /workspace/apps/test-project/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace/apps/test-project' }
    );
  });

  it('should add extra args', async () => {
    // Arrange
    const options = {
      name: 'my-image',
      extra: 'value',
      another: 'arg',
    } as IBuildExecutorOptions;
    (jest.mocked(execSync)).mockReturnValue(undefined);

    // Act
    const result = await buildExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --load=true -t my-image -f /workspace/apps/test-project/Dockerfile extra=value another=arg .',
      { stdio: 'inherit', cwd: '/workspace/apps/test-project' }
    );
  });

  it('should fail if dockerfile does not exist', async () => {
    // Arrange
    const options: IBuildExecutorOptions = { name: 'my-image' };
    (jest.mocked(existsSync)).mockReturnValue(false);

    // Act
    const result = await buildExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: false });
  });

  it('should fail if name is invalid', async () => {
    // Arrange
    const options: IBuildExecutorOptions = { name: 'Invalid_Name!' };

    // Act
    const result = await buildExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: false });
  });

  it('should fail on execSync error', async () => {
    // Arrange
    const options: IBuildExecutorOptions = { name: 'my-image' };
    (jest.mocked(execSync)).mockImplementation(() => {
      throw new Error('Docker build failed');
    });

    // Act
    const result = await buildExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: false });
  });

  it('should return failure when project node is missing', async () => {
    // Arrange
    const options: IBuildExecutorOptions = { name: 'my-image' };
    (jest.mocked(execSync)).mockReturnValue(undefined);

    // simulate missing node key which causes executor to error
    (context as any).projectName = 'missing';
    (context as any).projectGraph.nodes = {} as any;

    // Act
    const result = await buildExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: false });
  });

  it('should handle projectConfig missing root/sourceRoot by using workspace defaults', async () => {
    // Arrange
    const options: IBuildExecutorOptions = { name: 'my-image' };
    (jest.mocked(execSync)).mockReturnValue(undefined);

    // make project data present but without root/sourceRoot
    (context as any).projectGraph.nodes['test-project'].data = {} as any;

    // Act
    const result = await buildExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --load=true -t my-image -f /workspace/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace' }
    );
  });

  it('should handle non-Error thrown from execSync', async () => {
    // Arrange
    const options: IBuildExecutorOptions = { name: 'my-image' };
    (jest.mocked(execSync)).mockImplementation(() => {
      // throw a non-Error to exercise String(err) path
      throw 'unexpected';
    });

    // Act
    const result = await buildExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: false });
  });

  it('should handle missing projectName by using workspaceRoot', async () => {
    // Arrange
    const options: IBuildExecutorOptions = { name: '{workspaceRoot}' };
    (jest.mocked(execSync)).mockReturnValue(undefined);

    // simulate missing projectName
    (context as any).projectName = undefined;
    // create minimal node to avoid property access errors
    (context as any).projectGraph.nodes[''] = {
      data: { root: '', sourceRoot: '' },
    } as any;

    // Act
    const result = await buildExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --load=true -t workspace -f /workspace/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace' }
    );
  });

  it('should respect provided dockerfile option', async () => {
    // Arrange
    const options = {
      name: 'my-image',
      dockerfile: '/tmp/Dockerfile',
    } as IBuildExecutorOptions;
    (jest.mocked(execSync)).mockReturnValue(undefined);

    // Act
    const result = await buildExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --load=true -t my-image -f /tmp/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace/apps/test-project' }
    );
  });
});
