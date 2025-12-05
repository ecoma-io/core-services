import { formatFiles, generateFiles, Tree } from '@nx/devkit';
import * as path from 'path';

/**
 * Schema for the library generator options.
 */
export interface ILibraryGeneratorSchema {
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
  options: ILibraryGeneratorSchema
) {
  const projectRoot = `apps/${options.name}`;
  generateFiles(tree, path.join(__dirname, 'files'), projectRoot, options);
  await formatFiles(tree);
}

export default libraryGenerator;
