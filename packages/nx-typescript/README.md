# nx-typescript

An internal Nx plugin providing generators and an executor to scaffold and publish TypeScript packages following this monorepo's conventions.

Source: `packages/nx-typescript`

## Overview

`nx-typescript` includes:

- Generators: `application`, `e2e`, `library`, `package` (see `src/generators/`)
- Executor: `publish` (see `src/executors/publish`)

Purpose: standardize scaffolding for applications, libraries and e2e projects, and provide a publisher executor for npm/registry workflows.

## Installation / Usage

This package is intended to run inside the monorepo. If the plugin is linked or published, you can invoke its generators and executor via the Nx CLI.

Examples:

- Generate a new application with the local plugin:

```
npx nx generate nx-typescript:application --name=my-app
```

- If the plugin is published under a scope (replace `@scope` with the actual scope):

```
npx nx generate @scope/nx-typescript:application --name=my-app
```

- Run the `publish` executor on a built project:

```
npx nx run <projectName>:publish
```

Refer to each generator's schema to see available options: `src/generators/*/schema.json`.

## Generators

- `application` — scaffold a new application using templates in `src/generators/application/files/`.
- `e2e` — scaffold an end-to-end test project.
- `library` — create a standard library (TS config, linting, Jest setup).
- `package` — scaffold a publishable package (package.json template, build config).

Each generator exposes a JSON schema under its directory to document options and defaults.

## Executor: publish

- `publish` — helper executor for packaging and publishing packages to npm or a configured registry. See `src/executors/publish/publish.ts` and its `schema.json` for behavior and options.

Typical steps performed by the executor include running pre-publish checks, building the package, and publishing to the configured registry. Review the executor code to confirm exact steps and environment variables supported.

## Development & Testing

- Install workspace dependencies:

```bash
pnpm install
```

- Run this package's unit tests:

```bash
npx nx test nx-typescript --codeCoverage
```

- Unit tests for generators and executor are located under `src/**` as `*.spec.ts` files.

## Important files & directories

- `src/generators/` — generator implementations and template files
- `src/executors/` — executor implementation(s) (e.g. `publish`)
- `src/utils/` — helper utilities used by generators/executor
- `schema.json` — option schemas for each generator/executor

## Operational notes

- When templates or APIs change, run and update unit tests and any dependent projects.
- If publishing this plugin, ensure `package.json` `name` and publishing config are correct.
