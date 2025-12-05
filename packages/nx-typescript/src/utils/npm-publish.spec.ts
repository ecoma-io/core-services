import { runNpmPublish } from './npm-publish';
import * as child_process from 'child_process';
import { logger } from '@nx/devkit';

jest.mock('child_process');
jest.mock('@nx/devkit');

describe('runNpmPublish', () => {
  const mockExecSync = child_process.execSync as jest.MockedFunction<
    typeof child_process.execSync
  >;
  const mockLoggerInfo = logger.info as jest.MockedFunction<typeof logger.info>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should run npm publish with correct args for public package', () => {
    const options = { root: '/dummy', private: false, dryRun: false };
    const packageJson = { name: 'test', version: '1.0.0' };

    runNpmPublish('/root', options, 'latest', packageJson);

    expect(mockLoggerInfo).toHaveBeenCalledWith('Publishing test:1.0.0');
    expect(mockExecSync).toHaveBeenCalledWith(
      'npm publish --access public --tag latest',
      { cwd: '/root', stdio: 'inherit' }
    );
  });

  it('should run npm publish with dry-run', () => {
    const options = { root: '/dummy', private: false, dryRun: true };
    const packageJson = { name: 'test', version: '1.0.0' };

    runNpmPublish('/root', options, 'beta', packageJson);

    expect(mockExecSync).toHaveBeenCalledWith(
      'npm publish --access public --tag beta --dry-run',
      { cwd: '/root', stdio: 'inherit' }
    );
  });

  it('should run npm publish for private package', () => {
    const options = { root: '/dummy', private: true, dryRun: false };
    const packageJson = { name: 'test', version: '1.0.0' };

    runNpmPublish('/root', options, 'latest', packageJson);

    expect(mockExecSync).toHaveBeenCalledWith(
      'npm publish --access restricted --tag latest',
      { cwd: '/root', stdio: 'inherit' }
    );
  });

  it('should handle missing package name gracefully', () => {
    const options = { root: '/dummy', private: false, dryRun: false };
    const packageJson = { version: '1.0.0' } as any;

    runNpmPublish('/root', options, 'latest', packageJson);

    expect(mockLoggerInfo).toHaveBeenCalledWith('Publishing <unknown>:1.0.0');
    expect(mockExecSync).toHaveBeenCalledWith(
      'npm publish --access public --tag latest',
      { cwd: '/root', stdio: 'inherit' }
    );
  });
});
