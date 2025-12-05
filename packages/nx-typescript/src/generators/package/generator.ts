import { formatFiles, generateFiles, Tree, updateJson } from '@nx/devkit';
import * as path from 'path';

/**
 * Schema for the package generator options.
 */
export interface IPackageGeneratorSchema {
  /** The name of the package to generate. */
  name: string;
}

/**
 * Generates a new TypeScript package in the Nx workspace.
 *
 * @param tree - The virtual file system tree.
 * @param options - The generator options.
 */
export async function packageGenerator(
  tree: Tree,
  options: IPackageGeneratorSchema
) {
  const projectRoot = `packages/${options.name}`;
  const { version, name } = JSON.parse(tree.read('package.json', 'utf-8'));
  const org = name.split('/')[0];
  const interpolators = { version, org, ...options };

  generateFiles(
    tree,
    path.join(__dirname, 'files'),
    projectRoot,
    interpolators
  );
  updateJson(tree, 'tsconfig.base.json', (tsConfig) => {
    tsConfig['compilerOptions']['paths'][`${org}/${options.name}`] = [
      `packages/${options.name}/src/index.ts`,
    ];
    return tsConfig;
  });
  await formatFiles(tree);
}

export default packageGenerator;
