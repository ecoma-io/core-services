import { ExecutorContext, logger } from '@nx/devkit';
import { join } from 'path';
import { validateOptions } from '../../utils/validation';
import { resolvePackageRoot } from '../../utils/path-resolution';
import { ensurePackageJsonExists } from '../../utils/file-check';
import {
  getValidVersion,
  determineTag,
  updatePackageVersion,
} from '../../utils/version-handling';
import { runNpmPublish } from '../../utils/npm-publish';
import { checkWildcardDependencies } from '../../utils/wildcard-dependencies';

export interface IPublishExecutorOptions {
  /**
   * Root path template for the package to publish. May contain interpolators:
   * - {workspaceRoot}
   * - {projectRoot}
   * - {projectName}
   */
  root: string;
  /** When true, sync version from root package.json. */
  syncRepoVersion?: boolean;
  /** When true, run npm publish with --dry-run. */
  dryRun?: boolean;
  /** When true, publish as a private package. */
  private?: boolean;
}

/**
 * Nx executor that updates package.json version and runs `npm publish`.
 *
 * @param {IPublishExecutorOptions} options - Executor options.
 * @param {ExecutorContext} context - Nx executor context.
 * @returns {Promise<{ success: boolean }>} Result object indicating success or failure.
 */
export default async function publishExecutor(
  options: IPublishExecutorOptions,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  try {
    validateOptions(options);

    const resolvedRoot = resolvePackageRoot(options, context);
    const packageJsonPath = join(resolvedRoot, 'package.json');

    ensurePackageJsonExists(packageJsonPath);

    const validVersion = getValidVersion(options, context, packageJsonPath);
    const tag = determineTag(validVersion);

    const packageJson = updatePackageVersion(packageJsonPath, validVersion);

    checkWildcardDependencies(options, packageJson, context, packageJsonPath);

    runNpmPublish(resolvedRoot, options, tag, packageJson);

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Publish executor failed: ${message}`);
    return { success: false };
  }
}
