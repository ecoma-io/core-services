import { ExecutorContext, logger, normalizePath } from '@nx/devkit';
import { existsSync } from 'fs';
import { join } from 'path';
// ignore this because unit test using require for mocking
// eslint-disable-next-line @nx/enforce-module-boundaries
import { parseEnvFile } from '@ecoma-io/parse-env-file';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { expandEnv } from '@ecoma-io/expand-env';

/**
 * Options for setting up the executor environment.
 */
export interface ExecutorSetupOptions {
  /** Path to the TypeORM data source file. */
  dataSource: string;
  /** Path to the TypeScript configuration file. */
  tsConfig: string;
  /** Optional path to an environment file to load variables from. */
  envFile?: string;
  /** Optional directory containing migration files. */
  migrationsDir?: string;
}

/**
 * Result of the executor setup process.
 */
export interface ExecutorSetupResult {
  /** Root directory of the project. */
  projectRoot: string;
  /** Normalized path to the data source file. */
  normalizedDataSource: string;
  /** Full path to the data source file. */
  dataSourcePath: string;
  /** Environment variables loaded from files and expanded. */
  envVars: Record<string, string>;
  /** Path to the TypeScript configuration file. */
  tsConfigPath: string;
  /** Optional normalized path to the migrations directory. */
  normalizedMigrationsDir?: string;
}

/**
 * Sets up the executor environment by validating options, loading environment variables, and preparing paths.
 *
 * @param options - The setup options.
 * @param context - The Nx executor context.
 * @returns The setup result or null if setup fails.
 */
export function setupExecutor(
  options: ExecutorSetupOptions,
  context: ExecutorContext
): ExecutorSetupResult | null {
  // Get project root
  const projectRoot =
    context.projectGraph.nodes[context.projectName]?.data?.root;
  if (!projectRoot) {
    logger.error('Unable to determine project root.');
    return null;
  }

  // Normalize paths
  const normalizedDataSource = normalizePath(options.dataSource);
  const dataSourcePath = join(context.root, normalizedDataSource);

  // Check dataSource
  if (!existsSync(dataSourcePath)) {
    logger.error(`DataSource file not found: ${dataSourcePath}`);
    return null;
  }

  // Load env
  let envVars = { ...process.env };
  if (options.envFile) {
    try {
      const envFileVars = parseEnvFile(options.envFile, context.root);
      envVars = { ...envVars, ...envFileVars };
      logger.info(`Loaded environment variables from ${options.envFile}`);
    } catch (error) {
      logger.warn(
        `Failed to load env file ${options.envFile}: ${error.message}`
      );
    }
  }
  envVars = expandEnv(envVars);

  // tsConfig
  const tsConfigPath = normalizePath(options.tsConfig);

  const result: ExecutorSetupResult = {
    projectRoot,
    normalizedDataSource,
    dataSourcePath,
    envVars,
    tsConfigPath,
  };

  if (options.migrationsDir) {
    result.normalizedMigrationsDir = normalizePath(options.migrationsDir);
  }

  return result;
}
