# @ecoma-io/expand-env

A lightweight, framework-agnostic utility for expanding environment variables in configuration objects. Supports variable substitution with default values, similar to shell parameter expansion.

## Features

- **Variable Expansion**: Replace `${VAR}` placeholders with actual values from the config object.
- **Default Values**: Use `${VAR:-default}` syntax to provide fallbacks.
- **Cross-Reference Resolution**: Handles interdependent variables across multiple passes.
- **Case-Insensitive Matching**: Tries exact, uppercase, and lowercase variants for flexibility.
- **Zero Dependencies**: Pure TypeScript/JavaScript with no external libraries.
- **TypeScript Support**: Full type definitions included.

## Installation

```bash
npm install @ecoma-io/expand-env
```

or

```bash
yarn add @ecoma-io/expand-env
```

or

```bash
pnpm add @ecoma-io/expand-env
```

## Usage

```typescript
import { expandEnv } from '@ecoma-io/expand-env';

const config = {
  HOST: 'localhost',
  PORT: '3000',
  URL: 'http://${HOST}:${PORT}/api',
  TIMEOUT: '${TIMEOUT:-5000}', // default to 5000 if not set
};

const expanded = expandEnv(config);
console.log(expanded.URL); // 'http://localhost:3000/api'
console.log(expanded.TIMEOUT); // '5000' (if TIMEOUT was not defined)
```

### Cross-Reference Example

```typescript
const config = {
  BASE_URL: 'https://api.example.com',
  API_VERSION: 'v1',
  FULL_URL: '${BASE_URL}/${API_VERSION}/endpoint',
};

const expanded = expandEnv(config);
console.log(expanded.FULL_URL); // 'https://api.example.com/v1/endpoint'
```

### Default Values

```typescript
const config = {
  DATABASE_URL: '${DB_URL:-postgresql://localhost:5432/default}',
  CACHE_SIZE: '${CACHE_SIZE:-100}',
};

const expanded = expandEnv(config);
// Uses provided values or defaults
```

## API

### `expandEnv(config: Record<string, string>): Record<string, string>`

Expands environment variables in the provided configuration object.

- **Parameters**:
  - `config`: An object with string keys and string values containing variable placeholders.
- **Returns**: A new object with all placeholders expanded. The original object is not mutated.
- **Throws**: Never throws; unresolved variables without defaults become empty strings.

## Building

Run `npx nx build expand-env` to build the library.

## Running unit tests

Run `npx nx test expand-env` to execute the unit tests via [Jest](https://jestjs.io).
