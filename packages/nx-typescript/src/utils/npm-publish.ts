import { logger } from '@nx/devkit';
import { execSync, ExecSyncOptions } from 'child_process';
import { IPublishExecutorOptions } from '../executors/publish/publish';
import { IPackageJson } from './version-handling';

/**
 * Run npm publish command.
 */
export function runNpmPublish(
  resolvedRoot: string,
  options: IPublishExecutorOptions,
  tag: string,
  packageJson: IPackageJson
): void {
  logger.info(
    `Publishing ${packageJson.name ?? '<unknown>'}:${packageJson.version}`
  );

  const execOptions: ExecSyncOptions = {
    cwd: resolvedRoot,
    stdio: 'inherit',
  };

  execSync(
    `npm publish --access ${options.private ? 'restricted' : 'public'} --tag ${tag}${options.dryRun ? ' --dry-run' : ''}`,
    execOptions
  );
}
