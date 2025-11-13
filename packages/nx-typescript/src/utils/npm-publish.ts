import { logger } from '@nx/devkit';
import { execSync, ExecSyncOptions } from 'child_process';
import { PublishExecutorOptions } from '../executors/publish/publish';
import { PackageJson } from './version-handling';

/**
 * Run npm publish command.
 */
export function runNpmPublish(
  resolvedRoot: string,
  options: PublishExecutorOptions,
  tag: string,
  packageJson: PackageJson
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
