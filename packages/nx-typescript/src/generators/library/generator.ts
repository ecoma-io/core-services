import { formatFiles, generateFiles, Tree, updateJson } from '@nx/devkit';
import * as path from 'path';

/**
 * Schema for the library generator options.
 */
export interface IlibraryGeneratorSchema {
  /** The name of the library to generate. */
  name: string;
}

/**
 * Generates a new TypeScript library in the Nx workspace.
 *
 * @param tree - The virtual file system tree.
 * @param options - The generator options.
 */
export async function libraryGenerator(
  tree: Tree,
  options: IlibraryGeneratorSchema
) {
  const projectRoot = `libs/${options.name}`;
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
      `libs/${options.name}/src/index.ts`,
    ];
    return tsConfig;
  });
  await formatFiles(tree);
}

export default libraryGenerator;
