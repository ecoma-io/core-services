import { ExecutorContext } from '@nx/devkit';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import buildExecutor, { BuildExecutorOptions } from './build';

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
    (existsSync as jest.Mock).mockReturnValue(true);
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

  it('should build successfully with basic options', async () => {
    const options: BuildExecutorOptions = { name: 'my-image' };

    (execSync as jest.Mock).mockReturnValue(undefined);

    const result = await buildExecutor(options, context as ExecutorContext);

    expect(result).toEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --load=true -t my-image -f /workspace/apps/test-project/Dockerfile .',
      {
        stdio: 'inherit',
        cwd: '/workspace/apps/test-project',
      }
    );
  });

  it('should use default name when not provided', async () => {
    const options = {} as BuildExecutorOptions;

    (execSync as jest.Mock).mockReturnValue(undefined);

    const result = await buildExecutor(options, context as ExecutorContext);

    expect(result).toEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --load=true -t test-project -f /workspace/apps/test-project/Dockerfile .',
      {
        stdio: 'inherit',
        cwd: '/workspace/apps/test-project',
      }
    );
  });

  it('should interpolate placeholders in name', async () => {
    const options: BuildExecutorOptions = {
      name: '{projectName}-{sourceRoot}',
    };

    (execSync as jest.Mock).mockReturnValue(undefined);

    const result = await buildExecutor(options, context as ExecutorContext);

    expect(result).toEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --load=true -t test-project-workspace-apps-test-project-src -f /workspace/apps/test-project/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace/apps/test-project' }
    );
  });

  it('should not add --load if load is false', async () => {
    const options: BuildExecutorOptions = { name: 'my-image', load: false };

    (execSync as jest.Mock).mockReturnValue(undefined);

    const result = await buildExecutor(options, context as ExecutorContext);

    expect(result).toEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --load=false -t my-image -f /workspace/apps/test-project/Dockerfile .',
      {
        stdio: 'inherit',
        cwd: '/workspace/apps/test-project',
      }
    );
  });

  it('should add extra args', async () => {
    const options = {
      name: 'my-image',
      extra: 'value',
      another: 'arg',
    } as BuildExecutorOptions;

    (execSync as jest.Mock).mockReturnValue(undefined);

    const result = await buildExecutor(options, context as ExecutorContext);

    expect(result).toEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --load=true -t my-image -f /workspace/apps/test-project/Dockerfile extra=value another=arg .',
      { stdio: 'inherit', cwd: '/workspace/apps/test-project' }
    );
  });

  it('should fail if dockerfile does not exist', async () => {
    const options: BuildExecutorOptions = { name: 'my-image' };

    (existsSync as jest.Mock).mockReturnValue(false);

    const result = await buildExecutor(options, context as ExecutorContext);

    expect(result).toEqual({ success: false });
  });

  it('should fail if name is invalid', async () => {
    const options: BuildExecutorOptions = { name: 'Invalid_Name!' };

    const result = await buildExecutor(options, context as ExecutorContext);

    expect(result).toEqual({ success: false });
  });

  it('should fail on execSync error', async () => {
    const options: BuildExecutorOptions = { name: 'my-image' };

    (execSync as jest.Mock).mockImplementation(() => {
      throw new Error('Docker build failed');
    });

    const result = await buildExecutor(options, context as ExecutorContext);

    expect(result).toEqual({ success: false });
  });
});
