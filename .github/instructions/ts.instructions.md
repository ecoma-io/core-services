---
applyTo: '**/*.ts'
description: 'TypeScript best practices and conventions'
---

You are an expert in authoring concise, maintainable, and type-safe TypeScript. Write all documentation, comments, and code in English. Apply the mandatory rules below to selected TypeScript code to improve quality, safety, readability, and maintainability.

## Scope

This file defines base rules for all TypeScript files (`.ts`) in the repo. Test and framework-specific instruction files may extend or override these rules.

## Mandatory Actions

### 1. TSDoc & Type Safety

1.  TSDoc: Add complete TSDoc to functions, classes, and complex vars. Use TSDoc only.
    - Include a short `@remarks`.
    - Document every `@param {Type}` and describe it.
    - Document `@returns {Type}` with a short description.
2.  Types:
    - Avoid `any`. Use `unknown` and narrow with type guards or define interfaces/types.
    - Exported and complex functions must have explicit parameter and return types (e.g., `function foo(a: string): Promise<number>`).
    - Use utility types (`Readonly<T>`, `ReadonlyArray<T>`, `Partial<T>`, `Record<K,V>`, `Omit`, `Pick`) where appropriate. Workspace common types (`@ecoma-io/common`) are allowed.
3.  Style: Prefer modern syntax and strict equality (`===`).

### 2. Code Clarity & Cleanup

1.  Remove unused imports, variables, and dead code.
2.  Use descriptive identifiers; rename vague names to reflect intent.
3.  Extract deeply nested or long conditionals into small helpers.
4.  Use const/let, arrow functions, destructuring, optional chaining (`?.`), nullish coalescing (`??`), and logical operators (`||`, `&&`) as appropriate.
5.  Group related logic and add brief high-level comments.

### 3. Import Rules & Path Aliases

1.  Import order: side-effects, node built-ins, third-party, workspace aliases (`@ecoma-io/...`), then local/relative. Separate groups with one blank line.
2.  Use path aliases from `tsconfig.base.json` for cross-project imports (`@ecoma-io/*`). Do not use relative imports to reach other packages.
3.  No relative cross-project imports (e.g., `../..` across projects). Export shared utilities from libs/packages and import via `@ecoma-io/<name>`.
4.  Avoid circular dependencies; extract shared types/utilities to a neutral package if needed.

Example:

```ts
import 'reflect-metadata'; // side-effect
import fs from 'fs'; // node builtin
import express from 'express'; // third-party
import { ErrorResponse } from '@ecoma-io/common'; // workspace alias
import { localUtil } from './local-util'; // local
```

### 4. Performance & Error Handling

1.  Watch for algorithmic complexity; prefer linear or better where feasible.
2.  Add explicit error handling (validate inputs, use try/catch for async operations) and wrap errors with context.

### 5. Async/Await & Promises

1.  Handle rejections: await inside try/catch or otherwise handle rejections.
2.  Annotate Promise return types (e.g., `async function f(): Promise<T>`).
3.  Do not mix `await` with `.then()` in the same function.
4.  Use `Promise.all` for independent parallel tasks; use `Promise.allSettled` when partial failures are acceptable and document semantics.
5.  Consider timeouts or `AbortController` for long-running operations and document behavior.

Example:

```ts
/**
 * Fetch and parse resource data.
 * @returns {Promise<Resource>} The parsed resource
 */
async function fetchResource(): Promise<Resource> {
  try {
    const data = await fetch(url);
    return await data.json();
  } catch (err) {
    throw new Error(`Failed to fetch resource: ${String(err)}`);
  }
}
```

### 6. Readonly, Immutability & Access Modifiers

1.  Prefer immutable shapes: `readonly`, `ReadonlyArray<T>`, `as const` when applicable.
2.  Use explicit access modifiers (`public`, `private`, `protected`, `readonly`) on class members and constructor params.
3.  Favor pure functions and avoid shared mutable state.

### 7. Examples: unknown narrowing & type guards

Use `unknown` then narrow with user-defined guards.

#### 7.1 Parse JSON then narrow:

```ts
/**
 * Parse JSON as unknown.
 */
function parseJson(input: string): unknown {
  return JSON.parse(input);
}

type Resource = { id: string; name: string };

function isResource(obj: unknown): obj is Resource {
  return typeof obj === 'object' && obj !== null && 'id' in obj && typeof (obj as any).id === 'string' && 'name' in obj && typeof (obj as any).name === 'string';
}

const raw = parseJson('{"id":"1","name":"a"}');
if (isResource(raw)) {
  // raw is Resource
  console.log(raw.id, raw.name);
} else {
  // handle invalid shape
}
```

#### 7.2 Discriminated union guard:

```ts
type Event = { type: 'created'; payload: { id: string } } | { type: 'deleted'; payload: { id: string } };

function isCreatedEvent(e: Event): e is { type: 'created'; payload: { id: string } } {
  return e.type === 'created';
}

function handle(e: Event) {
  if (isCreatedEvent(e)) {
    // e.payload is { id: string }
  } else {
    // other kinds
  }
}
```

### 8. Quick TSDoc example (concise)

```ts
/**
 * Loads user from repository, throwing NotFoundError if nonexistent.
 * @param {string} id - The user id.
 * @returns {Promise<User>} The user entity.
 */
export async function getUserById(id: string): Promise<User> {
  // implementation...
}
```

### 9. ESLint, tsconfig & Tooling

Follow ESLint rules in `eslint.config.mjs`/`tsconfig.base.json` on workspace root and `eslint.config.mjs`/`tsconfig.json` on project root. After changes run:

- eslint: `eslint --fix`
- Nx lint/test: `npx nx lint <project>` and `npx nx test <project>`

Run `nx` targets (`lint`, `test`, `build`, `e2e`) as part of PR validation.

Note: Use workspace conventions (path aliases, shared exceptions, ConfigModule patterns) and prefer shared libs for cross-project utilities.
