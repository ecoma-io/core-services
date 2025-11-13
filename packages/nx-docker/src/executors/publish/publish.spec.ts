import { ExecutorContext, logger } from '@nx/devkit';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import publishExecutor, { PublishExecutorOptions } from './publish';

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
    (existsSync as jest.Mock).mockReturnValue(true);
    (readFileSync as jest.Mock).mockReturnValue(
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

  it('should push successfully with basic options', async () => {
    const options: PublishExecutorOptions = { name: 'my-image' };

    (execSync as jest.Mock).mockImplementation(() => undefined);

    const result = await publishExecutor(options, context as ExecutorContext);

    expect(result).toEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --push -t my-image -f /workspace/apps/test-project/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace/apps/test-project' }
    );
  });

  it('should interpolate placeholders with path sanitization', async () => {
    const options: PublishExecutorOptions = { name: '{projectRoot}/latest' };

    (execSync as jest.Mock).mockImplementation(() => undefined);

    const result = await publishExecutor(options, context as ExecutorContext);

    expect(result).toEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --push -t workspace-apps-test-project/latest -f /workspace/apps/test-project/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace/apps/test-project' }
    );
  });

  it('should sync version from package.json', async () => {
    const options: PublishExecutorOptions = {
      name: 'my-image',
      syncRepoVersion: true,
    };

    (execSync as jest.Mock).mockImplementation(() => undefined);

    const result = await publishExecutor(options, context as ExecutorContext);

    expect(result).toEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --push -t my-image:1.2.3 -f /workspace/apps/test-project/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace/apps/test-project' }
    );
  });

  it('should handle registry namespace in name', async () => {
    const options: PublishExecutorOptions = {
      name: 'myregistry.com/myuser/myimage',
    };

    (execSync as jest.Mock).mockImplementation(() => undefined);

    const result = await publishExecutor(options, context as ExecutorContext);

    expect(result).toEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --push -t myregistry.com/myuser/myimage -f /workspace/apps/test-project/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace/apps/test-project' }
    );
  });

  it('should sync version with registry namespace', async () => {
    const options: PublishExecutorOptions = {
      name: 'myregistry.com/myuser/myimage',
      syncRepoVersion: true,
    };

    (execSync as jest.Mock).mockImplementation(() => undefined);

    const result = await publishExecutor(options, context as ExecutorContext);

    expect(result).toEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build --push -t myregistry.com/myuser/myimage:1.2.3 -f /workspace/apps/test-project/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace/apps/test-project' }
    );
  });

  it('should handle dry run mode', async () => {
    const options: PublishExecutorOptions = { name: 'my-image', dryRun: true };

    (execSync as jest.Mock).mockImplementation(() => undefined);

    const result = await publishExecutor(options, context as ExecutorContext);

    expect(result).toEqual({ success: true });
    expect(execSync).toHaveBeenCalledWith(
      'docker build -t my-image -f /workspace/apps/test-project/Dockerfile .',
      { stdio: 'inherit', cwd: '/workspace/apps/test-project' }
    );
    expect(logger.info).toHaveBeenCalledWith(
      '\nSuccessfully pushed docker image: my-image (dry run) '
    );
  });

  it('should fail if dockerfile does not exist', async () => {
    const options: PublishExecutorOptions = { name: 'my-image' };

    (existsSync as jest.Mock).mockReturnValue(false);

    const result = await publishExecutor(options, context as ExecutorContext);

    expect(result).toEqual({ success: false });
  });

  it('should fail if name is invalid', async () => {
    const options: PublishExecutorOptions = { name: 'Invalid@Name!' };

    const result = await publishExecutor(options, context as ExecutorContext);

    expect(result).toEqual({ success: false });
  });

  it('should fail if name is missing', async () => {
    const options = {} as Partial<PublishExecutorOptions>;

    const result = await publishExecutor(
      options as PublishExecutorOptions,
      context as ExecutorContext
    );

    expect(result).toEqual({ success: false });
  });

  it('should fail on execSync error', async () => {
    const options: PublishExecutorOptions = { name: 'my-image' };

    (execSync as jest.Mock).mockImplementation(() => {
      throw new Error('Docker build failed');
    });

    const result = await publishExecutor(options, context as ExecutorContext);

    expect(result).toEqual({ success: false });
  });
});
