# Ecoma Core Services - ESLint Rules

This package provides custom ESLint rules specifically for this workspace and serves as an adapter to apply internal eslint-plugin-package rules through `@nx/eslint:workspace-rule-[rule-name]` installation.

## Installation

This package is part of the Nx monorepo and should be used within the workspace.

## Usage

The rules are automatically applied through the root `eslint.config.mjs` configuration.

## Current Status

Currently, this project has no custom rules and only serves as an adapter to connect to `eslint-plugin-monorepo` and apply it to this repository.

## Creating New Rules

To create a new custom ESLint rule for this workspace:

```bash
npx nx g @nx/eslint:workspace-rule {{ NEW_RULE_NAME }}
```

This will generate a new rule in the `rules/` directory and automatically configure it for use in the workspace.

## Development

To develop or test rules:

```bash
npx nx lint eslint-rules
npx nx test eslint-rules
```

## Building

```bash
npx nx build eslint-rules
```
