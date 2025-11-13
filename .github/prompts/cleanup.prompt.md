---
description: Code cleanup and refactoring prompt following repository conventions
mode: edit
---

# Code Cleanup & Refactoring Instructions

## Goal

Clean up and refactor TypeScript code following the strict conventions defined in `.github/instructions/`. Improve code quality, type safety, readability, and maintainability while preserving existing behavior.

## Mandatory Instruction Files (Read First)

Before making ANY changes, **read and apply** these instruction files in order:

1. **`/.github/instructions/ts.instructions.md`** — Base TypeScript rules (TSDoc, types, imports, async/await)
2. **`/.github/instructions/ts-jest.instructions.md`** — Unit test conventions (AAA pattern, mocking, async testing)
3. **`/.github/instructions/ts-e2e.instructions.md`** — E2E test overrides (Testcontainers, environment setup)
4. **`/.github/instructions/shell.instructions.md`** — Shell script conventions (if editing `.sh` files)
5. **`/.github/instructions/docker.instruction.md`** — Dockerfile best practices (if editing Dockerfiles)

**Conflict resolution**: When a more specific file conflicts with a general one, follow the more specific file.

## Cleanup Checklist (Execute in Order)

### 1. Type Safety & Documentation

- [ ] Add complete TSDoc to all functions, classes, and complex variables
- [ ] Replace all `any` types with `unknown` or proper interfaces/types
- [ ] Add explicit parameter and return types to exported functions
- [ ] Use utility types (`Readonly<T>`, `Partial<T>`, `Record<K,V>`, etc.) where appropriate
- [ ] Define type guards for `unknown` type narrowing

### 2. Import Organization

- [ ] Organize imports in order: side-effects, node built-ins, third-party, workspace aliases (`@ecoma-io/*`), local
- [ ] Replace relative cross-project imports with path aliases from `tsconfig.base.json`
- [ ] Remove unused imports
- [ ] Add blank lines between import groups

### 3. Code Quality

- [ ] Remove unused variables, parameters, and dead code
- [ ] Rename vague identifiers to be descriptive and meaningful
- [ ] Extract deeply nested conditionals into small helper functions
- [ ] Use modern syntax: `const`/`let`, arrow functions, destructuring, `?.`, `??`
- [ ] Replace `==` with `===` (strict equality)
- [ ] Add brief comments for complex logic sections

### 4. Async/Await & Error Handling

- [ ] Use `async/await` consistently (don't mix with `.then()`)
- [ ] Wrap async operations in try/catch blocks
- [ ] Add explicit Promise return types (e.g., `Promise<T>`)
- [ ] Validate inputs and add meaningful error messages
- [ ] Use `Promise.all()` for independent parallel tasks

### 5. Immutability & Access Modifiers

- [ ] Use `readonly` for properties that shouldn't change
- [ ] Use `ReadonlyArray<T>` or `readonly T[]` for arrays
- [ ] Add explicit access modifiers (`public`, `private`, `protected`) to class members
- [ ] Prefer `as const` for literal types

### 6. Test-Specific Cleanup (if editing test files)

- [ ] Follow AAA pattern (Arrange, Act, Assert) with clear comments
- [ ] Use typed mocks instead of `any`
- [ ] Add return type `Promise<void>` to async tests
- [ ] Reset mocks in `afterEach(() => jest.resetAllMocks())`
- [ ] Ensure tests have proper assertions
- [ ] Use `await expect(...).resolves` / `rejects` for Promise assertions

### 7. Path Aliases & Workspace Conventions

- [ ] Import from `@ecoma-io/nestjs-exceptions` instead of NestJS built-in exceptions
- [ ] Import from `@ecoma-io/common` for shared types
- [ ] Import from `@ecoma-io/nestjs-filters` for GlobalExceptionsFilter
- [ ] Verify path aliases match `tsconfig.base.json`

## Validation Steps (Run After Edits)

Execute these commands and report results:

```bash
# 1. Lint the changed files
npx nx lint <project>

# 2. Type check
npx nx build <project> --skip-nx-cache

# 3. Run unit tests
npx nx test <project>

# 4. Run E2E tests (if applicable)
npx nx e2e <project>-e2e
```

## Output Format

After completing the cleanup, provide:

1. **Summary**: One paragraph stating which instruction files were applied and the scope of changes
2. **Changes Made**: Bullet list of key improvements (max 5-7 items)
3. **Validation Results**: Pass/fail status for lint, build, test, e2e (or note if not run)
4. **Warnings**: Any potential breaking changes or areas needing manual review

## Important Notes

- **Preserve behavior**: Do not change business logic unless fixing a bug
- **Minimal changes**: Focus on quality improvements, avoid unnecessary refactoring
- **Breaking changes**: If behavior change is required, add/update tests first
- **No console.log**: Replace with NestJS `Logger` in application code
- **Conventional Commits**: Use proper commit message format when committing changes
