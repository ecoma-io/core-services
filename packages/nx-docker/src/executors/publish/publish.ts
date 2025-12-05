import { ExecutorContext, logger } from '@nx/devkit';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface IPublishExecutorOptions {
  /** The name of the Docker image */
  name: string;
  /** Path to the Dockerfile */
  dockerfile?: string;
  /** When true, run in dry-run mode without actually pushing */
  dryRun?: boolean;
  /** When true, sync version from root package.json */
  syncRepoVersion?: boolean;
  /** Additional arguments to pass to docker build */
  [key: string]: unknown;
}

/**
 * Nx executor that publishes a Docker image.
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
    // interpolate placeholders in image name from workspace/project context
    const workspaceRoot = context.root;
    const projectName = context.projectName ?? '';
    const projectConfig = context.projectGraph.nodes[projectName]?.data;
    const projectRoot = join(workspaceRoot, projectConfig.root ?? '');
    const sourceRoot = join(workspaceRoot, projectConfig.sourceRoot ?? '');

    if (!options.name) {
      throw new Error('Docker image name (options.name) is required.');
    }

    // Support placeholders: {workspaceRoot}, {projectRoot}, {projectName}, {sourceRoot}
    const replacements: Record<string, string> = {
      workspaceRoot,
      projectRoot,
      projectName,
      sourceRoot,
    };

    const {
      name,
      dryRun,
      dockerfile: dockerfileOption,
      syncRepoVersion = false,
    } = options;

    const dockerfile = dockerfileOption ?? `${projectRoot}/Dockerfile`;

    if (!existsSync(dockerfile)) {
      throw new Error(`Dockerfile not found at ${dockerfile}`);
    }

    let finalName = name;
    if (syncRepoVersion) {
      const packageJsonPath = join(workspaceRoot, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const version = packageJson.version;
      finalName = `${name}:${version}`;
    }

    const sanitize = (val: string) =>
      String(val)
        .replace(/^[/\\]+|[/\\]+$/g, '')
        .replace(/[/\\]+/g, '-');

    const interpolatedName = String(finalName)
      .replace('{workspaceRoot}', sanitize(replacements.workspaceRoot))
      .replace('{projectRoot}', sanitize(replacements.projectRoot))
      .replace('{projectName}', sanitize(replacements.projectName))
      .replace('{sourceRoot}', sanitize(replacements.sourceRoot));

    // Validate image name format
    const nameRegex = /^[a-z0-9._/:-]+$/;
    if (!nameRegex.test(interpolatedName)) {
      throw new Error(
        `Invalid image name "${interpolatedName}". Name must match ^[a-z0-9._/:-]+$`
      );
    }

    // Build docker build command with --push
    const command = `docker build${dryRun ? '' : ' --push'} -t ${interpolatedName} -f ${dockerfile}`;

    logger.debug(`\n${command}\n\n`);

    // Execute the docker build command
    execSync(command + ' .', {
      stdio: 'inherit',
      cwd: projectRoot,
    });

    logger.info(
      `\nSuccessfully pushed docker image: ${interpolatedName}${dryRun ? ' (dry run)' : ''} `
    );

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Publish executor failed: ${message}`);
    return { success: false };
  }
}
