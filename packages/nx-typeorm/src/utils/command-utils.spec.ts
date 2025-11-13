import { buildTypeOrmCommand, executeTypeOrmCommand } from './command-utils';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('buildTypeOrmCommand', () => {
  it('should build command array with args', () => {
    // Arrange: Set up parameters with args
    const tsConfigPath = 'tsconfig.json';
    const dataSource = 'src/datasource.ts';
    const command = 'schema:drop';
    const args = ['--dry-run'];

    // Act: Call buildTypeOrmCommand with args
    const commands = buildTypeOrmCommand(
      tsConfigPath,
      dataSource,
      command,
      args
    );

    // Assert: Verify the command array is built correctly
    expect(commands).toEqual([
      'ts-node -r tsconfig-paths/register',
      '--project tsconfig.json',
      './node_modules/typeorm/cli.js',
      '-d src/datasource.ts',
      'schema:drop',
      '--dry-run',
    ]);
  });

  it('should build command array without args', () => {
    // Arrange: Set up parameters without args
    const tsConfigPath = 'tsconfig.json';
    const dataSource = 'src/datasource.ts';
    const command = 'migration:run';

    // Act: Call buildTypeOrmCommand without args
    const commands = buildTypeOrmCommand(tsConfigPath, dataSource, command);

    // Assert: Verify the command array is built correctly
    expect(commands).toEqual([
      'ts-node -r tsconfig-paths/register',
      '--project tsconfig.json',
      './node_modules/typeorm/cli.js',
      '-d src/datasource.ts',
      'migration:run',
    ]);
  });
});

describe('executeTypeOrmCommand', () => {
  it('should call execSync with correct params', () => {
    // Arrange: Set up command parameters
    const commands = ['ts-node', 'command'];
    const envVars = { NODE_ENV: 'test' };
    const cwd = '/workspace';

    // Act: Call executeTypeOrmCommand
    executeTypeOrmCommand(commands, envVars, cwd);

    // Assert: Verify execSync was called with correct parameters
    expect(require('child_process').execSync).toHaveBeenCalledWith(
      'ts-node command',
      {
        stdio: 'inherit',
        cwd: '/workspace',
        env: envVars,
      }
    );
  });
});
