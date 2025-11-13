import { interpolatePath, resolvePackageRoot } from './path-resolution';
import { ExecutorContext } from '@nx/devkit';

describe('interpolatePath', () => {
  it('should replace {workspaceRoot}', () => {
    const context = { root: '/workspace' } as unknown as ExecutorContext;
    expect(interpolatePath('{workspaceRoot}/dist', context)).toBe(
      '/workspace/dist'
    );
  });

  it('should replace {projectRoot}', () => {
    const context = {
      root: '/workspace',
      projectName: 'my-project',
      projectsConfigurations: {
        projects: {
          'my-project': { root: 'apps/my-project' },
        },
      },
    } as unknown as ExecutorContext;
    expect(interpolatePath('{projectRoot}/dist', context)).toBe(
      'apps/my-project/dist'
    );
  });

  it('should replace {projectName}', () => {
    const context = { projectName: 'my-project' } as unknown as ExecutorContext;
    expect(interpolatePath('{projectName}/dist', context)).toBe(
      'my-project/dist'
    );
  });

  it('should handle multiple replacements', () => {
    const context = {
      root: '/workspace',
      projectName: 'my-project',
      projectsConfigurations: {
        projects: {
          'my-project': { root: 'apps/my-project' },
        },
      },
    } as unknown as ExecutorContext;
    expect(
      interpolatePath('{workspaceRoot}/{projectRoot}/{projectName}', context)
    ).toBe('/workspace/apps/my-project/my-project');
  });
});

describe('resolvePackageRoot', () => {
  it('should resolve root using interpolators', () => {
    const options = { root: '{workspaceRoot}/packages/my-package' };
    const context = { root: '/workspace' } as unknown as ExecutorContext;
    expect(resolvePackageRoot(options, context)).toBe(
      '/workspace/packages/my-package'
    );
  });
});
