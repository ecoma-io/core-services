# nx-typescript

Nx plugin providing generators and executors for TypeScript projects in Nx workspaces.

This plugin offers generators for creating new TypeScript libraries and packages, along with executors for synchronizing repository versions across projects.

## Generators

### Library Generator (`library`)

Generates a new TypeScript library in the `libs/` directory.

**Schema:**

```typescript
interface IlibraryGeneratorSchema {
  name: string; // The name of the library to generate
}
```

**Usage:**

```bash
npx nx generate @ecoma-io/nx-typescript:library --name=my-lib
```

This will:

- Create a new library in `libs/my-lib/`
- Update `tsconfig.base.json` with path mapping
- Format the generated files

### Package Generator (`package`)

Generates a new TypeScript package in the `packages/` directory.

**Schema:**

```typescript
interface IpackageGeneratorSchema {
  name: string; // The name of the package to generate
}
```

**Usage:**

```bash
npx nx generate @ecoma-io/nx-typescript:package --name=my-package
```

This will:

- Create a new package in `packages/my-package/`
- Update `tsconfig.base.json` with path mapping
- Format the generated files

## Executors

### Publish (`publish`)

Publishes a package to npm with version sync from root package.json.

**Schema:**

```typescript
interface PublishExecutorOptions {
  root: string; // The root directory of the package to publish (default: {projectRoot}/dist)
  syncRepoVersion?: boolean; // Sync version from root package.json (default: false)
  dryRun?: boolean; // Run in dry-run mode (default: false)
  private?: boolean; // Publish as a private package (default: false)
}
```

**Usage:**

```json
{
  "executor": "@ecoma-io/nx-typescript:publish",
  "options": {
    "syncRepoVersion": true
  }
}
```

This executor:

- Reads the version from the root `package.json` when `sync-version` is true
- Updates the project's `package.json` with the synced version
- Runs `npm publish` with the appropriate tag based on version
- Supports dry-run mode for testing

## Build

Build the plugin:

```bash
npx nx build nx-typescript
```

## Tests

Run unit tests:

```bash
npx nx test nx-typescript
```

## Publishing

Publish to npm:

```bash
npx nx publish nx-typescript
```

## Contributing

- Ensure all generators and executors have comprehensive TSDoc documentation
- Add unit tests following AAA pattern for any new functionality
- Follow the monorepo's conventional commits and linting rules
