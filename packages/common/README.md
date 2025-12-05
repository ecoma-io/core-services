# @ecoma-io/common

Shared utilities and types used across Ecoma projects (backend, web, mobile, desktop).

This package centralizes common response shapes, exceptions, and small helpers intended to be imported by services, adapters and frontends so that all apps follow the same API/response contracts.

## Contents

- Entry point: `src/index.ts`
- Helpers: `src/lib/utils.ts`
- Shared primitives: `src/lib/common.ts`
- Exceptions: `src/lib/exceptions` (example: `intrinsic.exception.ts`)
- Response shapes & metadata: `src/lib/responses` (health details, paging metadata, success/error response shapes)

## Goals

- Provide consistent Success / Error response shapes for HTTP and non-HTTP transports.
- Provide small, well-tested helpers that work in Node and browser (keep utilities dependency-free and tree-shakeable).
- Provide shared exception types for consistent error handling and mapping to transport-level errors.

## Install

This package is part of the monorepo. From the repository root:

```bash
pnpm install
```

When using in other workspace projects, import via workspace path (Nx) or from the published package name when published to a registry:

```ts
import { IntrinsicException, successResponse } from '@ecoma-io/common';
```

Or (local import during development):

```ts
import { IntrinsicException } from '../../packages/common/src/lib/exceptions/intrinsic.exception';
```

## Quick Start — Node example

```ts
import { successResponse } from '@ecoma-io/common';

function handler(req, res) {
  const payload = { hello: 'world' };
  res.json(successResponse(payload));
}
```

## Quick Start — Browser / Frontend usage

This package is kept small and should be usable in bundlers. When bundling for the web, import only the helpers you need to keep bundle size minimal:

```ts
import { offsetPagingMetadata } from '@ecoma-io/common';

const meta = offsetPagingMetadata(100, 10, 3);
```

## API / Exports (high level)

- `successResponse<T>(data: T, metadata?)` — standardize successful responses.
- `errorResponse(error, code?)` — standard error shape.
- `IntrinsicException` — base exception for predictable business-level errors.
- Paging metadata helpers: `cursorPagingMetadata`, `offsetPagingMetadata`.
- `healthDetails()` — health-check response helpers.

See the actual source for full signatures in `src/lib`.

## Build & Test

Build the package with Nx:

```bash
npx nx build common
```

Run unit tests:

```bash
npx nx test common
```

Run unit tests with coverage report:

```bash
npx nx test common --coverage
```

## Contributing

- Keep public API stable and document any breaking changes in this README.
- Add unit tests for any utility or response shape you add.
- Follow repo linting and commit hooks (ESLint, Husky) when contributing.

## Usage notes for different platforms

- Backend (Node/Nest): import shapes and exceptions to standardize controllers, interceptors and error mappers.
- Web (React/Vue/Angular): import only runtime helpers (paging/metadata, response parsing). Avoid importing backend-only utilities.
- Mobile / Desktop (React Native / Electron): use the same lightweight helpers as web; prefer tree-shakeable imports.

## Where to look in the repo

- `packages/common/src/index.ts` — package exports
- `packages/common/src/lib/utils.ts` — utilities and unit tests (`utils.spec.ts`)
- `packages/common/src/lib/exceptions/intrinsic.exception.ts` — example exception
- `packages/common/src/lib/responses` — response shapes and tests
