/**
 * Helper utilities for computing Nx project tags.
 *
 * @packageDocumentation
 */

import { normalizePath, workspaceRoot } from '@nx/devkit';
import * as path from 'path';

/**
 * Compute the required type tag for an Nx project based on its file path.
 *
 * @remarks
 * The tag is derived from the top-level directory under the workspace root.
 * For example, `apps/my-app/project.json` -> `type:apps`.
 *
 * @param fileName - The absolute or relative path to the project.json file.
 * @param options - Optional configuration for tag prefix and base root.
 * @param options.tagPrefix - The prefix for the tag (default: `'type:'`).
 * @param options.baseRoot - The base root directory (default: workspace root or cwd).
 * @returns The computed tag string (e.g., `'type:apps'`).
 *
 * @example
 * ```typescript
 * const tag = computeRequiredTag('/repo/apps/my-app/project.json');
 * // Returns: 'type:apps'
 *
 * const tag2 = computeRequiredTag('/repo/libs/core/project.json', {
 *   tagPrefix: 'category:'
 * });
 * // Returns: 'category:libs'
 * ```
 */
export function computeRequiredTag(
  fileName: string,
  options?: { tagPrefix?: string; baseRoot?: string }
): string {
  const normalized = fileName.replace(/\\/g, '/');

  // Prefer using the workspace root when available, fall back to process.cwd()
  const baseRoot =
    options?.baseRoot ??
    (typeof workspaceRoot === 'string' && workspaceRoot
      ? normalizePath(workspaceRoot)
      : normalizePath(process.cwd()));

  // Use POSIX-style relative path computation for consistency
  const relativePath = path.posix.relative(
    baseRoot.replace(/\\/g, '/'),
    normalized.replace(/\\/g, '/')
  );

  // If path.relative returns empty string or starts with '..' (file is
  // outside root), fall back to the original normalized path
  const effective =
    !relativePath || relativePath.startsWith('..') ? normalized : relativePath;

  const parts = effective.replace(/^\/+/, '').split('/').filter(Boolean);
  const topFolder = parts.length > 0 ? parts[0] : 'unknown';
  const tagPrefix = options?.tagPrefix ?? 'type:';

  return `${tagPrefix}${topFolder}`;
}
