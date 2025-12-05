import { ExecutorContext, logger } from '@nx/devkit';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export interface IBuildExecutorOptions {
  /** The name of the Docker image */
  name: string;
  /** When true, load the image into the Docker daemon after building */
  load?: boolean;
  /** Path to the Dockerfile */
  dockerfile?: string;
  /** Additional arguments to pass to docker build */
  [key: string]: unknown;
}

/**
 * Nx executor that builds a Docker image.
 *
 * @param {IBuildExecutorOptions} options - Executor options.
 * @param {ExecutorContext} context - Nx executor context.
 * @returns {Promise<{ success: boolean }>} Result object indicating success or failure.
 */
export default async function buildExecutor(
  options: IBuildExecutorOptions,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  try {
    // interpolate placeholders in image name from workspace/project context
    const workspaceRoot = context.root;
    const projectName = context.projectName ?? '';
    const projectConfig = context.projectGraph.nodes[projectName]?.data;
    const projectRoot = join(workspaceRoot, projectConfig.root ?? '');
    const sourceRoot = join(workspaceRoot, projectConfig.sourceRoot ?? '');

    // Support placeholders: {workspaceRoot}, {projectRoot}, {projectName}, {sourceRoot}
    const replacements: Record<string, string> = {
      workspaceRoot,
      projectRoot,
      projectName,
      sourceRoot,
    };
    const {
      name = '{projectName}',
      load = true,
      dockerfile: dockerfileOption,
      ...extraArgs
    } = options;

    const dockerfile = dockerfileOption ?? `${projectRoot}/Dockerfile`;

    if (!existsSync(dockerfile)) {
      throw new Error(`Dockerfile not found at ${dockerfile}`);
    }

    const sanitize = (val: string) =>
      String(val)
        .replace(/^[/\\]+|[/\\]+$/g, '')
        .replace(/[/\\]+/g, '-');

    const interpolatedName = String(name)
      .replace('{workspaceRoot}', sanitize(replacements.workspaceRoot))
      .replace('{projectRoot}', sanitize(replacements.projectRoot))
      .replace('{projectName}', sanitize(replacements.projectName))
      .replace('{sourceRoot}', sanitize(replacements.sourceRoot));

    // Validate image name format
    const nameRegex = /^[a-z0-9]+([._-][a-z0-9]+)*$/;
    if (!nameRegex.test(interpolatedName)) {
      throw new Error(
        `Invalid image name "${interpolatedName}". Name must match ^[a-z0-9]+([._-][a-z0-9]+)*$`
      );
    }

    // Build docker build command
    let command = `docker build --load=${load ? 'true' : 'false'} -t ${interpolatedName} -f ${dockerfile}`;

    for (const [key, value] of Object.entries(extraArgs)) {
      command += ` ${key}=${value}`;
    }

    // Add context path (current directory by default)
    command += ' .';

    logger.debug(`\n${command}\n\n`);

    // Execute the docker build command
    execSync(command, {
      stdio: 'inherit',
      cwd: projectRoot,
    });

    logger.info(`Successfully built Docker image: ${interpolatedName}`);

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Build executor failed: ${message}`);
    return { success: false };
  }
}
