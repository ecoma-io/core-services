# @ecoma-io/common

Shared TypeScript types, response shapes and small runtime utilities used across
Ecoma microservices. This package centralizes common DTOs, paging metadata
types, lightweight runtime helpers and small factories so services and clients
share a single contract.

This README explains the public API, quick usage examples, and how to run the
local tests.

## Contents

- Types and interfaces: `SuccessResponse`, `ErrorResponse`, paging metadata
  types (`CursorPagingMetadata`, `OffsetPagingMetadata`), and entity helper
  types.
- Runtime helpers: `deepClone`, `sleep`, `isPrimitiveValue`, `isObjectValue`.
- Response factories: `createSuccessResponse`, `createErrorResponse`.
- Small runtime type guards for a few payload shapes (e.g. `isHealthDetails`).

## Importing

From another package in the monorepo, prefer the path alias used by the
workspace:

```ts
import { SuccessResponse, ErrorResponse, createSuccessResponse, createErrorResponse, deepClone, sleep } from '@ecoma-io/ecoma-common';
```

When working directly in this package (or when browsing the source), imports are
relative to the `src` folder, e.g. `from './lib/utils'`.

## Usage examples

Create a typed success response:

```ts
import { createSuccessResponse, OffsetPagingMetadata } from '@ecoma-io/ecoma-common';

const paging: OffsetPagingMetadata = {
  totalItems: 100,
  itemCount: 10,
  itemsPerPage: 10,
  totalPages: 10,
  currentPage: 1,
};

const resp = createSuccessResponse({ id: 'u1' }, 'ok', paging);
// resp: SuccessResponse<{ id: string }, OffsetPagingMetadata>
```

Create an error response:

```ts
import { createErrorResponse } from '@ecoma-io/ecoma-common';

const err = createErrorResponse('Not found', { code: 'NOT_FOUND' });
```

Use runtime helpers:

```ts
import { deepClone, sleep } from '@ecoma-io/ecoma-common';

const copy = deepClone({ a: 1, b: { c: 2 } });
await sleep(100); // pause for 100ms
```

## Testing

Unit tests use Jest and are configured via Nx. Run tests for this package with:

```bash
npx nx test common
```

To run tests and generate coverage:

```bash
npx nx test common --coverage
```

## Contributing

- Keep this package small and framework-agnostic: prefer types and tiny helpers.
- When changing exported types (breaking changes), bump the package version and
  communicate to downstream consumers — type changes are breaking by design.

## Development

- Build: `npx nx build common`
- Test: `npx nx test common`
- Linting and formatting are handled at the workspace level; run the root
  commands or CI pipeline as usual.
