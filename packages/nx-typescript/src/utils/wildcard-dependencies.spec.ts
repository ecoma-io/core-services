import { checkWildcardDependencies } from './wildcard-dependencies';
import * as fs from 'fs';
import { logger } from '@nx/devkit';
import { ExecutorContext } from '@nx/devkit';

jest.mock('fs');
jest.mock('@nx/devkit');

describe('checkWildcardDependencies', () => {
  const mockExistsSync = fs.existsSync as jest.MockedFunction<
    typeof fs.existsSync
  >;
  const mockReadFileSync = fs.readFileSync as jest.MockedFunction<
    typeof fs.readFileSync
  >;
  const mockWriteFileSync = fs.writeFileSync as jest.MockedFunction<
    typeof fs.writeFileSync
  >;
  const mockLoggerInfo = logger.info as jest.MockedFunction<typeof logger.info>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should do nothing if syncRepoVersion is false', () => {
    const options = { root: '/dummy', syncRepoVersion: false };
    const packageJson = { dependencies: { dep1: '*' } };
    const context = {} as unknown as ExecutorContext;

    checkWildcardDependencies(
      options,
      packageJson,
      context,
      '/path/package.json'
    );

    expect(mockLoggerInfo).not.toHaveBeenCalled();
  });

  it('should update wildcard dependencies', () => {
    const options = { root: '/dummy', syncRepoVersion: true };
    const packageJson = {
      dependencies: { dep1: '*' },
      devDependencies: { dep2: '*' },
    };
    const context = {
      root: '/workspace',
      projectsConfigurations: {
        projects: {
          proj1: { root: 'packages/proj1' },
          proj2: { root: 'packages/proj2' },
        },
      },
    } as unknown as ExecutorContext;

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync
      .mockReturnValueOnce(JSON.stringify({ name: 'dep1', version: '1.0.0' }))
      .mockReturnValueOnce(JSON.stringify({ name: 'dep2', version: '2.0.0' }));

    checkWildcardDependencies(
      options,
      packageJson,
      context,
      '/path/package.json'
    );

    expect(packageJson.dependencies['dep1']).toBe('1.0.0');
    expect(packageJson.devDependencies['dep2']).toBe('2.0.0');
    expect(mockWriteFileSync).toHaveBeenCalled();
  });
});
