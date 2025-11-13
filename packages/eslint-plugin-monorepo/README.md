# eslint-plugin-monorepo

## Building

Run `npx nx build eslint-plugin-monorepo` to build the library.

## Running unit tests

Run `npx nx test eslint-plugin-monorepo` to execute the unit tests via [Jest](https://jestjs.io).

## Added Rules

### `enforce-project-tag-type`

Ensures every `project.json` file has a `tags` array containing a `type:<segment>` tag where `<segment>` is the top-level folder (e.g. `apps`, `libs`, `packages`, `infras`, `tools`, `e2e`).

Auto-fix behaviors:

- If `tags` is missing, inserts `"tags": ["type:<segment>"]`.
- If `tags` is not an array, replaces its value with `["type:<segment>"]`.
- If array is present but missing the required tag, **normalizes** the array by:
  - Removing any incorrect `type:*` tags
  - Preserving all non-type tags
  - Ensuring exactly one correct `type:<segment>` tag

Examples:

- `e2e/my-test/project.json` with `["type:apps", "type:unknown"]` → `["type:e2e"]`
- `packages/util/project.json` with `["custom", "type:apps", "type:libs"]` → `["custom", "type:packages"]`

Options:

```jsonc
"@nx/workspace-enforce-project-tag-type": ["error", {
	"ignore": ["apps/**/legacy/project.json"],
	"tagPrefix": "type:" // optional override
}]
```

### `enforce-scope`

Validates package.json `name` properties against a configurable scoped pattern.

### `no-package-version`

Disallows `version` property in package.json (managed externally) with safe removal fix.

### `no-specific-internal-deps-version`

Prevents hard-coding specific internal dependency versions; encourages workspace-managed versions.
