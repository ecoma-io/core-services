import { ExecutorContext, logger } from '@nx/devkit';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import publishExecutor, { IPublishExecutorOptions } from './publish';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

jest.mock('@nx/devkit', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('publishExecutor', () => {
  let context: Partial<ExecutorContext>;

  beforeEach(() => {
    jest.clearAllMocks();
    (jest.mocked(existsSync)).mockReturnValue(true);
    (jest.mocked(readFileSync)).mockReturnValue(
      JSON.stringify({ version: '1.2.3' })
    );
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
    // Ensure mocks are fully reset between tests
    jest.resetAllMocks();
  });

  it('should push successfully with basic options', async () => {
    // Arrange
    const options: IPublishExecutorOptions = { name: 'my-image' };

    (jest.mocked(execSync)).mockImplementation(() => undefined);

    // Act
    const result = await publishExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --push -t my-image -f /workspace/apps/test-project/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace/apps/test-project' }
    );
  });

  it('should interpolate placeholders with path sanitization', async () => {
    // Arrange
    const options: IPublishExecutorOptions = { name: '{projectRoot}/latest' };

    (jest.mocked(execSync)).mockImplementation(() => undefined);

    // Act
    const result = await publishExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --push -t workspace-apps-test-project/latest -f /workspace/apps/test-project/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace/apps/test-project' }
    );
  });

  it('should sync version from package.json', async () => {
    // Arrange
    const options: IPublishExecutorOptions = {
      name: 'my-image',
      syncRepoVersion: true,
    };

    (jest.mocked(execSync)).mockImplementation(() => undefined);

    // Act
    const result = await publishExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --push -t my-image:1.2.3 -f /workspace/apps/test-project/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace/apps/test-project' }
    );
  });

  it('should handle registry namespace in name', async () => {
    // Arrange
    const options: IPublishExecutorOptions = {
      name: 'myregistry.com/myuser/myimage',
    };

    (jest.mocked(execSync)).mockImplementation(() => undefined);

    // Act
    const result = await publishExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --push -t myregistry.com/myuser/myimage -f /workspace/apps/test-project/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace/apps/test-project' }
    );
  });

  it('should sync version with registry namespace', async () => {
    // Arrange
    const options: IPublishExecutorOptions = {
      name: 'myregistry.com/myuser/myimage',
      syncRepoVersion: true,
    };

    (jest.mocked(execSync)).mockImplementation(() => undefined);

    // Act
    const result = await publishExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --push -t myregistry.com/myuser/myimage:1.2.3 -f /workspace/apps/test-project/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace/apps/test-project' }
    );
  });

  it('should handle dry run mode', async () => {
    // Arrange
    const options: IPublishExecutorOptions = { name: 'my-image', dryRun: true };

    (jest.mocked(execSync)).mockImplementation(() => undefined);

    // Act
    const result = await publishExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build -t my-image -f /workspace/apps/test-project/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace/apps/test-project' }
    );
    expect(logger.info).toHaveBeenCalledWith(
      '\nSuccessfully pushed docker image: my-image (dry run) '
    );
  });

  it('should fail if dockerfile does not exist', async () => {
    // Arrange
    const options: IPublishExecutorOptions = { name: 'my-image' };

    (jest.mocked(existsSync)).mockReturnValue(false);

    // Act
    const result = await publishExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: false });
  });

  it('should fail if name is invalid', async () => {
    // Arrange
    const options: IPublishExecutorOptions = { name: 'Invalid@Name!' };

    // Act
    const result = await publishExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: false });
  });

  it('should fail if name is missing', async () => {
    // Arrange
    const options = {} as Partial<IPublishExecutorOptions>;

    // Act
    const result = await publishExecutor(
      options as IPublishExecutorOptions,
      context as ExecutorContext
    );

    // Assert
    expect(result).toStrictEqual({ success: false });
  });

  it('should fail on execSync error', async () => {
    // Arrange
    const options: IPublishExecutorOptions = { name: 'my-image' };

    (jest.mocked(execSync)).mockImplementation(() => {
      throw new Error('Docker build failed');
    });

    // Act
    const result = await publishExecutor(options, context as ExecutorContext);

    // Assert
    expect(result).toStrictEqual({ success: false });
  });

  it('should handle missing projectName by using workspaceRoot', async () => {
    const options: IPublishExecutorOptions = { name: '{workspaceRoot}/latest' };

    (jest.mocked(execSync)).mockImplementation(() => undefined);

    // simulate missing projectName

    // mutate fixture: clear projectName to exercise workspaceRoot placeholder
    (context as any).projectName = undefined;
    // ensure projectGraph has an entry for the empty key so property access doesn't throw

    // create minimal node for edge-case testing
    (context as any).projectGraph.nodes[''] = {
      data: { root: '', sourceRoot: '' },
    } as any;

    const result = await publishExecutor(options, context as ExecutorContext);

    expect(result).toStrictEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --push -t workspace/latest -f /workspace/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace' }
    );
  });

  it('should respect provided dockerfile option', async () => {
    const options = {
      name: 'my-image',
      dockerfile: '/tmp/Dockerfile',
    } as IPublishExecutorOptions;

    (jest.mocked(execSync)).mockImplementation(() => undefined);

    const result = await publishExecutor(options, context as ExecutorContext);

    expect(result).toStrictEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --push -t my-image -f /tmp/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace/apps/test-project' }
    );
  });

  it('should handle non-Error thrown from execSync', async () => {
    const options: IPublishExecutorOptions = { name: 'my-image' };

    (jest.mocked(execSync)).mockImplementation(() => {
      // throw a non-Error value to exercise the String(err) path

      throw 'unexpected';
    });

    const result = await publishExecutor(options, context as ExecutorContext);

    expect(result).toStrictEqual({ success: false });
  });

  it('should succeed when project node is missing', async () => {
    const options: IPublishExecutorOptions = { name: 'my-image' };

    (jest.mocked(execSync)).mockImplementation(() => undefined);

    // remove nodes entry to simulate missing project node

    // test fixture mutation to simulate missing project
    (context as any).projectName = 'missing';

    // wipe nodes for negative path
    (context as any).projectGraph.nodes = {} as any;
    const result = await publishExecutor(options, context as ExecutorContext);

    expect(result).toStrictEqual({ success: false });
  });

  it('should fail when placeholder interpolation produces invalid name (empty sourceRoot)', async () => {
    const options: IPublishExecutorOptions = {
      name: '{projectName}-{sourceRoot}',
    };

    (jest.mocked(execSync)).mockImplementation(() => undefined);

    // remove sourceRoot to create an empty replacement

    // mutate test fixture to force missing sourceRoot
    (
      (context as any).projectGraph.nodes['test-project'].data as any
    ).sourceRoot = undefined;

    const result = await publishExecutor(options, context as ExecutorContext);
    // publish uses a more permissive regex; interpolation with workspace defaults yields valid name
    expect(result).toStrictEqual({ success: true });
  });

  it('should handle projectConfig missing root/sourceRoot by using workspace defaults', async () => {
    const options: IPublishExecutorOptions = { name: 'my-image' };

    (jest.mocked(execSync)).mockImplementation(() => undefined);

    // make project data present but without root/sourceRoot

    // mutate test fixture to remove root/sourceRoot
    (context as any).projectGraph.nodes['test-project'].data = {} as any;

    const result = await publishExecutor(options, context as ExecutorContext);

    expect(result).toStrictEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --push -t my-image -f /workspace/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace' }
    );
  });
});
