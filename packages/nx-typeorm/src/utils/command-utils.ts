import { execSync } from 'child_process';

/**
 * Builds the TypeORM CLI command array for execution.
 *
 * @param tsConfigPath - Path to the TypeScript configuration file.
 * @param dataSource - Path to the data source file.
 * @param command - The TypeORM command to run (e.g., 'migration:generate').
 * @param args - Optional additional arguments for the command.
 * @returns An array of command parts to be joined and executed.
 */
export function buildTypeOrmCommand(
  tsConfigPath: string,
  dataSource: string,
  command: string,
  args?: string[]
): string[] {
  return [
    'ts-node -r tsconfig-paths/register',
    `--project ${tsConfigPath}`,
    `./node_modules/typeorm/cli.js`,
    `-d ${dataSource}`,
    command,
    ...(args ?? []),
  ];
}

/**
 * Executes the TypeORM command using child_process.execSync.
 *
 * @param commands - Array of command parts to join and execute.
 * @param envVars - Environment variables to set for the command.
 * @param cwd - Current working directory for the command.
 */
export function executeTypeOrmCommand(
  commands: string[],
  envVars: Record<string, string>,
  cwd: string
): void {
  execSync(commands.join(' '), {
    stdio: 'inherit',
    cwd,
    env: envVars,
  });
}
