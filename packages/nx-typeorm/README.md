# nx-typeorm

Nx plugin providing executors for TypeORM database operations in Nx workspaces.

This plugin offers a set of executors to manage TypeORM migrations and schema operations directly within your Nx monorepo. It integrates seamlessly with Nx's build system and supports environment variable loading for flexible configuration.

## Executors

### Migration Generate (`migration-generate`)

Generates new TypeORM migration files based on entity changes.

**Schema:**

```typescript
interface MigrationGenerateExecutorSchema {
  tsConfig: string; // Path to TypeScript config
  dataSource: string; // Path to TypeORM data source
  migrationsDir: string; // Directory for migrations
  name: string; // Migration name
  args?: string[]; // Additional CLI args
  envFile?: string; // Optional env file
}
```

**Usage:**

```json
{
  "executor": "@ecoma-io/nx-typeorm:migration-generate",
  "options": {
    "tsConfig": "tsconfig.json",
    "dataSource": "src/datasource.ts",
    "migrationsDir": "src/migrations",
    "name": "add-user-table"
  }
}
```

### Migration Run (`migration-run`)

Runs pending TypeORM migrations.

**Schema:**

```typescript
interface MigrationRunExecutorSchema {
  tsConfig: string;
  dataSource: string;
  migrationsDir: string;
  args?: string[];
  envFile?: string;
}
```

**Usage:**

```json
{
  "executor": "@ecoma-io/nx-typeorm:migration-run",
  "options": {
    "tsConfig": "tsconfig.json",
    "dataSource": "src/datasource.ts",
    "migrationsDir": "src/migrations"
  }
}
```

### Migration Revert (`migration-revert`)

Reverts the last executed TypeORM migration.

**Schema:**

```typescript
interface MigrationRevertExecutorSchema {
  tsConfig: string;
  dataSource: string;
  migrationsDir: string;
  args?: string[];
  envFile?: string;
}
```

**Usage:**

```json
{
  "executor": "@ecoma-io/nx-typeorm:migration-revert",
  "options": {
    "tsConfig": "tsconfig.json",
    "dataSource": "src/datasource.ts",
    "migrationsDir": "src/migrations"
  }
}
```

### Schema Drop (`schema-drop`)

Drops the entire database schema.

**Schema:**

```typescript
interface SchemaDropExecutorSchema {
  tsConfig: string;
  dataSource: string;
  args?: string[];
  envFile?: string;
}
```

**Usage:**

```json
{
  "executor": "@ecoma-io/nx-typeorm:schema-drop",
  "options": {
    "tsConfig": "tsconfig.json",
    "dataSource": "src/datasource.ts"
  }
}
```

## Environment Variables

All executors support loading environment variables from `.env` files:

- Specify `envFile` option to load variables from a custom file
- Variables are expanded using `@ecoma-io/expand-env` for interpolation
- Falls back to `process.env` if no file is specified

## Utilities

### parseEnvFile

Parses environment variables from `.env` files.

```typescript
import { parseEnvFile } from '@ecoma-io/nx-typeorm';

const envVars = parseEnvFile('.env', '/custom/cwd');
```

### Executor Utils

Internal utilities for setting up executor environments:

- `setupExecutor()`: Validates options and prepares execution context
- `buildTypeOrmCommand()`: Constructs TypeORM CLI commands
- `executeTypeOrmCommand()`: Runs commands with proper environment

## Build

Build the plugin:

```bash
npx nx build nx-typeorm
```

## Tests

Run unit tests:

```bash
npx nx test nx-typeorm
```

## Publishing

Publish to npm:

```bash
npx nx publish nx-typeorm
```

## Contributing

- Ensure all executors have comprehensive TSDoc documentation
- Add unit tests following AAA pattern for any new functionality
- Follow the monorepo's conventional commits and linting rules
