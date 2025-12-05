import { ExecutorContext, logger } from '@nx/devkit';
import { existsSync } from 'fs';
import { join } from 'path';
import { IPublishExecutorOptions } from '../executors/publish/publish';
import {
  IPackageJson,
  readPackageJson,
  writePackageJson,
} from './version-handling';

/**
 * Get list of dependency package names that have version "*".
 *
 * @param {IPackageJson} pkg - Package JSON object.
 * @returns {string[]} Array of package names with "*" version.
 */
function getDependenciesWithWildcard(pkg: IPackageJson): string[] {
  const deps = pkg.dependencies || {};
  const devDeps = pkg.devDependencies || {};
  const peerDeps = pkg.peerDependencies || {};
  const allDeps = { ...deps, ...devDeps, ...peerDeps };

  return Object.entries(allDeps)
    .filter(([_, version]) => version === '*')
    .map(([name, _]) => name);
}

/**
 * Check wildcard dependencies and scan project graph if needed.
 *
 * @param {IPublishExecutorOptions} options - Executor options.
 * @param {IPackageJson} packageJson - Package JSON object.
 * @param {ExecutorContext} context - Nx executor context.
 * @param {string} packageJsonPath - Path to the package.json file.
 */
export function checkWildcardDependencies(
  options: IPublishExecutorOptions,
  packageJson: IPackageJson,
  context: ExecutorContext,
  packageJsonPath: string
): void {
  if (!options.syncRepoVersion) return;

  const wildcardDeps = getDependenciesWithWildcard(packageJson);
  if (wildcardDeps.length > 0) {
    logger.info(
      `Found dependencies with "*" version: ${wildcardDeps.join(', ')}`
    );
    if (wildcardDeps.length > 1) {
      // Scan projectGraph for projects with package.json
      const projectsWithPackageJson: string[] = [];
      const packageVersionMap: Record<string, string | null> = {};
      if (context.projectsConfigurations?.projects) {
        for (const [projectName, projectConfig] of Object.entries(
          context.projectsConfigurations.projects
        )) {
          const projectPackageJsonPath = join(
            context.root,
            projectConfig.root,
            'package.json'
          );
          if (existsSync(projectPackageJsonPath)) {
            projectsWithPackageJson.push(projectName);
            try {
              const projPkg = readPackageJson(projectPackageJsonPath);
              packageVersionMap[projPkg.name || projectName] =
                projPkg.version || null;
            } catch {
              packageVersionMap[projectName] = null;
            }
          }
        }
      }
      if (projectsWithPackageJson.length > 0) {
        logger.info(
          `Projects with package.json: ${projectsWithPackageJson.join(', ')}`
        );
        const versionEntries = Object.entries(packageVersionMap)
          .map(([name, version]) => `${name}:${version || 'null'}`)
          .join(', ');
        logger.info(`Package version map: ${versionEntries}`);

        // Update wildcard dependencies with versions from map
        let updated = false;
        const deps = packageJson.dependencies || {};
        const devDeps = packageJson.devDependencies || {};
        const peerDeps = packageJson.peerDependencies || {};
        for (const dep of wildcardDeps) {
          if (
            packageVersionMap[dep] !== null &&
            packageVersionMap[dep] !== undefined
          ) {
            if (deps[dep] === '*') {
              deps[dep] = packageVersionMap[dep] as string;
              updated = true;
            }
            if (devDeps[dep] === '*') {
              devDeps[dep] = packageVersionMap[dep] as string;
              updated = true;
            }
            if (peerDeps[dep] === '*') {
              peerDeps[dep] = packageVersionMap[dep] as string;
              updated = true;
            }
          }
        }
        if (updated) {
          writePackageJson(packageJsonPath, packageJson);
          logger.info('Updated wildcard dependencies with resolved versions.');
        }
      }
    }
  }
}
