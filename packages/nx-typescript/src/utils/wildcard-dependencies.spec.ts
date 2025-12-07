import { checkWildcardDependencies } from './wildcard-dependencies';
import * as fs from 'fs';
import { logger } from '@nx/devkit';
import { ExecutorContext } from '@nx/devkit';

jest.mock('fs');
jest.mock('@nx/devkit');

describe('checkWildcardDependencies', () => {
  const mockExistsSync = jest.mocked(fs.existsSync);
  const mockReadFileSync = jest.mocked(fs.readFileSync);
  const mockWriteFileSync = jest.mocked(fs.writeFileSync);
  const mockLoggerInfo = jest.mocked(logger.info);

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

  it('should log info when a single wildcard dependency is found and not scan projects', () => {
    const options = { root: '/dummy', syncRepoVersion: true };
    const packageJson = { dependencies: { onlydep: '*' } };
    const context = { root: '/workspace' } as unknown as ExecutorContext;

    mockExistsSync.mockReturnValue(false);

    checkWildcardDependencies(
      options,
      packageJson,
      context,
      '/path/package.json'
    );

    expect(mockLoggerInfo).toHaveBeenCalled();
  });

  it('should not write package.json when no projects with package.json are found', () => {
    const options = { root: '/dummy', syncRepoVersion: true };
    const packageJson = { dependencies: { a: '*', b: '*' } };
    const context = {
      root: '/workspace',
      projectsConfigurations: {
        projects: {
          proj1: { root: 'packages/proj1' },
          proj2: { root: 'packages/proj2' },
        },
      },
    } as unknown as ExecutorContext;

    mockExistsSync.mockReturnValue(false);

    checkWildcardDependencies(
      options,
      packageJson,
      context,
      '/path/package.json'
    );

    // nothing should be written because no project package.json files exist
    const fsWrite = (jest.mocked(require('fs').writeFileSync)) || jest.fn();
    expect(fsWrite).not.toHaveBeenCalled();
  });

  it('should handle a project package.json read error and still update resolvable deps', () => {
    const options = { root: '/dummy', syncRepoVersion: true };
    const packageJson = { dependencies: { dep1: '*', dep2: '*' } };
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
    // First project has valid package.json, second project read throws
    mockReadFileSync
      .mockReturnValueOnce(JSON.stringify({ name: 'dep1', version: '1.2.3' }))
      .mockImplementationOnce(() => {
        throw new Error('read error');
      });

    checkWildcardDependencies(
      options,
      packageJson,
      context,
      '/path/package.json'
    );

    expect(packageJson.dependencies['dep1']).toBe('1.2.3');
    expect(packageJson.dependencies['dep2']).toBe('*');
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it('should update peerDependencies with resolved versions', () => {
    const options = { root: '/dummy', syncRepoVersion: true };
    const packageJson = {
      dependencies: { depA: '*' },
      peerDependencies: { depPeer: '*' },
    };
    const context = {
      root: '/workspace',
      projectsConfigurations: {
        projects: {
          projA: { root: 'packages/projA' },
          projPeer: { root: 'packages/projPeer' },
        },
      },
    } as unknown as ExecutorContext;

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync
      .mockReturnValueOnce(JSON.stringify({ name: 'depA', version: '1.0.0' }))
      .mockReturnValueOnce(
        JSON.stringify({ name: 'depPeer', version: '3.2.1' })
      );

    checkWildcardDependencies(
      options,
      packageJson,
      context,
      '/path/package.json'
    );

    expect(packageJson.dependencies['depA']).toBe('1.0.0');
    expect(packageJson.peerDependencies['depPeer']).toBe('3.2.1');
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it('should handle missing projectsConfigurations gracefully', () => {
    const options = { root: '/dummy', syncRepoVersion: true };
    const packageJson = { dependencies: { a: '*', b: '*' } };
    // context has no projectsConfigurations -> should not throw
    const context = { root: '/workspace' } as unknown as ExecutorContext;

    mockExistsSync.mockReturnValue(false);

    checkWildcardDependencies(
      options,
      packageJson,
      context,
      '/path/package.json'
    );

    // nothing should be written and function should complete
    const fsWrite = (jest.mocked(require('fs').writeFileSync)) || jest.fn();
    expect(fsWrite).not.toHaveBeenCalled();
  });

  it('should use projectName when package.json has no name and skip undefined map entries', () => {
    const options = { root: '/dummy', syncRepoVersion: true };
    const packageJson = { dependencies: { depX: '*', depY: '*' } };
    const context = {
      root: '/workspace',
      projectsConfigurations: {
        projects: {
          projX: { root: 'packages/projX' },
        },
      },
    } as unknown as ExecutorContext;

    // only projX exists
    mockExistsSync.mockImplementation((p: string) => p.includes('projX'));
    // projX package.json has version but no name
    mockReadFileSync.mockReturnValueOnce(JSON.stringify({ version: '9.9.9' }));

    checkWildcardDependencies(
      options,
      packageJson,
      context,
      '/path/package.json'
    );

    // Because the project package.json had no `name`, the code uses the project
    // name as the key in the packageVersionMap. That means depX will not be
    // resolved (unless the project `name` equals the dependency name). So
    // depX remains '*' and no write occurs.
    expect(packageJson.dependencies['depX']).toBe('*');
    expect(packageJson.dependencies['depY']).toBe('*');
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('should not update when projects exist but no matching package names are found', () => {
    const options = { root: '/dummy', syncRepoVersion: true };
    const packageJson = { dependencies: { a: '*', b: '*' } };
    const context = {
      root: '/workspace',
      projectsConfigurations: {
        projects: {
          proj1: { root: 'packages/proj1' },
        },
      },
    } as unknown as ExecutorContext;

    mockExistsSync.mockReturnValue(true);
    // proj1 package.json exists but has a different name
    mockReadFileSync.mockReturnValueOnce(
      JSON.stringify({ name: 'other', version: '1.2.3' })
    );

    checkWildcardDependencies(
      options,
      packageJson,
      context,
      '/path/package.json'
    );

    // No matching dep names found in packageVersionMap, so nothing updated
    expect(packageJson.dependencies['a']).toBe('*');
    expect(packageJson.dependencies['b']).toBe('*');
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('should record null for project package.json without version and skip updates', () => {
    const options = { root: '/dummy', syncRepoVersion: true };
    const packageJson = { dependencies: { x: '*', y: '*' } };
    const context = {
      root: '/workspace',
      projectsConfigurations: {
        projects: {
          projX: { root: 'packages/projX' },
        },
      },
    } as unknown as ExecutorContext;

    mockExistsSync.mockReturnValue(true);
    // projX package.json has name but no version
    mockReadFileSync.mockReturnValueOnce(JSON.stringify({ name: 'projX' }));

    checkWildcardDependencies(
      options,
      packageJson,
      context,
      '/path/package.json'
    );

    // projX had no version -> mapped to null and deps remain unresolved
    expect(packageJson.dependencies['x']).toBe('*');
    expect(packageJson.dependencies['y']).toBe('*');
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('should do nothing when there are no wildcard dependencies', () => {
    const options = { root: '/dummy', syncRepoVersion: true };
    const packageJson = { dependencies: { a: '1.0.0', b: '2.0.0' } };
    const context = { root: '/workspace' } as unknown as ExecutorContext;

    mockExistsSync.mockReturnValue(false);

    checkWildcardDependencies(
      options,
      packageJson,
      context,
      '/path/package.json'
    );

    // no wildcard deps -> should not log found message or write
    expect(mockLoggerInfo).not.toHaveBeenCalled();
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('should resolve peerDependencies when dependencies is undefined (and multiple wildcards exist)', () => {
    const options = { root: '/dummy', syncRepoVersion: true };
    // include an extra wildcard so wildcardDeps.length > 1 and the scan runs
    const packageJson = {
      dependencies: { other: '*' },
      peerDependencies: { peerPkg: '*' },
    } as any;
    const context = {
      root: '/workspace',
      projectsConfigurations: {
        projects: {
          peerProject: { root: 'packages/peerProject' },
        },
      },
    } as unknown as ExecutorContext;

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValueOnce(
      JSON.stringify({ name: 'peerPkg', version: '5.5.5' })
    );

    checkWildcardDependencies(
      options,
      packageJson,
      context,
      '/path/package.json'
    );

    expect(packageJson.peerDependencies['peerPkg']).toBe('5.5.5');
    expect(mockWriteFileSync).toHaveBeenCalled();
  });
});
