import { ExecutorContext } from '@nx/devkit';
import { IPublishExecutorOptions } from '../executors/publish/publish';

/**
 * Replace supported placeholders in a path with values from the Nx ExecutorContext.
 *
 * @remarks
 * Supported placeholders:
 * - {workspaceRoot} -> context.root
 * - {projectRoot} -> project's configured root (if available)
 * - {projectName} -> context.projectName
 *
 * @param {string} path - The path template containing optional placeholders.
 * @param {ExecutorContext} context - Nx executor context providing workspace/project info.
 * @returns {string} The interpolated path.
 */
export function interpolatePath(
  path: string,
  context: ExecutorContext
): string {
  const projectName = context.projectName ?? '';
  const projectRoot =
    context.projectsConfigurations?.projects?.[projectName]?.root ?? '';

  return path
    .replace('{workspaceRoot}', context.root)
    .replace('{projectRoot}', projectRoot)
    .replace('{projectName}', projectName);
}

/**
 * Resolve the package root path using interpolators.
 */
export function resolvePackageRoot(
  options: IPublishExecutorOptions,
  context: ExecutorContext
): string {
  return interpolatePath(options.root, context);
}
