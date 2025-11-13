---
applyTo: '**/*.{test|spec}.ts'
description: TypeScript Testing Best Practices with Jest based on TypeScript best practices and conventions
---

This file provides Jest-focused testing rules that inherit from `ts.instructions.md`. It contains pragmatic relaxations and additions specifically for tests: filename conventions, AAA structure, async patterns, Jest resolver/path alias guidance, and CI/lint notes.

## Mandatory Rules (Strictly Follow AAA Pattern)

1.  **Testing Framework:** Strictly use **Jest**.
2.  **File Format:** Test file names must use one of these patterns: `*.test.ts`, `*.test.tsx`, `*.spec.ts`, or `*.spec.tsx`. Prefer `*.test.*` for unit tests and `*.e2e.spec.ts` (or the repo e2e convention) for end-to-end tests. If your project uses a different pattern, ensure `jest.config` maps it.
3.  **Structure (AAA Pattern):** Every test block (`it` or `test`) should follow the **Arrange, Act, Assert** pattern, documented with short comments for each section. For longer or complex tests, split logic into small helpers and test those helpers individually.

```javascript
test('should return the sum of two numbers', () => {
  // Arrange: define variables & mock dependencies
  const a = 10;
  const b = 5;

  // Act: execute the function being tested
  const result = sum(a, b);

  // Assert: verify the result
  expect(result).toBe(15);
});
```

4.  **Test Cases:**
    - Test for **successful execution** (happy path).
    - Test for **error handling/exceptions**.
    - Test **edge cases** for input (e.g., null, empty values, boundary conditions).
5.  **Mocking:** Use `jest.mock()` or `jest.spyOn()` to mock dependencies. Reset or restore mocks between tests (`afterEach(() => jest.resetAllMocks())`) to keep tests isolated.

### Interaction with `ts.instructions.md` (TSDoc & style)

- The rules in `ts.instructions.md` apply to tests, but tests may use a pragmatic relaxation:
  - Small, focused tests do not need full TSDoc on every test function. Clear test names and AAA comments are sufficient for readability.
  - Shared test helpers, utilities, or exported functions used across tests must follow `ts.instructions.md` fully (TSDoc, explicit types, no `any`).

### Async, Promises and Timing in Tests

- Use `async/await` in tests and prefer `await expect(...).resolves` / `await expect(...).rejects` for Promise assertions. Annotate return types when helpful: `async (): Promise<void>`.
- Example:

```ts
test('async resolves correctly', async (): Promise<void> => {
  // Arrange
  const p = someAsyncFunction();

  // Act & Assert
  await expect(p).resolves.toEqual(expected);
});

test('async rejects on bad input', async (): Promise<void> => {
  // Arrange
  const input = 'bad';

  // Act & Assert
  await expect(someAsyncFunctionBad(input)).rejects.toThrow('Invalid');
});
```

- Do not mix `.then()` and `await` inside the same test. Use fake timers (`jest.useFakeTimers()`) for time-based tests and document their semantics.

### Jest config, path aliases and resolver

- In this Nx monorepo (with TS path aliases `@ecoma-io/*`), ensure `jest.config.*` (root or per-project) includes `moduleNameMapper` or `ts-jest` path mapping for `@ecoma-io/*`. Tests should import shared packages via path aliases, not via relative cross-project paths.

### Isolation, setup/teardown and CI

- Use `beforeEach`/`afterEach` for isolation. For expensive global setup (e.g., Testcontainers), isolate into `e2e` or `integration` suites and run them separately in CI.
- Mark network-dependent tests as integration/e2e. Unit tests must not hit external networks.
- CI tip: run `npx nx lint <project>` and `npx nx test <project>` as part of validation.

### Examples & templates

```ts
test('adds two numbers', () => {
  // Arrange
  const a = 1;
  const b = 2;

  // Act
  const result = sum(a, b);

  // Assert
  expect(result).toBe(3);
});

test('async rejects on bad input', async (): Promise<void> => {
  // Arrange
  const bad = 'x';

  // Act & Assert
  await expect(asyncFn(bad)).rejects.toThrow('Invalid');
});
```

### Linting and test-run conventions

- Before committing tests run: `eslint --fix` and `npx nx test <project>` for the projects you changed.
- If you find path alias issues, update the project's `jest.config.*` `moduleNameMapper` or the root Jest config.

### Summary of pragmatic exceptions

- Tests: small tests may omit full TSDoc, but shared helpers must follow `ts.instructions.md` fully.
- Filename patterns: prefer `*.test.*` for unit tests and `*.e2e.spec.ts` (or project convention) for e2e.

If you want, I can now scan the repository to list test files that deviate from these rules and prepare suggested renames or fixes.

### Minimal, high-impact additions (naming, runtime, mocking, NestJS & ESLint)

Below are short, practical rules and examples that improve readability, determinism and type-safety in tests.

Naming & organization

- Use `describe('<UnitName>')` to group related tests and `test('should <expected> when <condition>')` or `it('returns X when Y')` for individual cases. Prefer readable, behavior-focused titles over implementation details.
- Keep tests small (one assertion intent per test). Use nested `describe` sparingly — only to group clearly related behaviors.
- Place unit tests next to implementation (`*.test.ts`) and keep integration/e2e tests in dedicated projects (e.g., `apps/*-e2e`).

Recommended Jest runtime flags/config

- Consider enabling these in your `jest.preset.js` or project `jest.config.*` for safer tests:

```js
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  testTimeout: 10000, // adjust per project
```

- Use `--runInBand` only for debugging or when CI flakiness requires serial execution. Prefer parallel workers for speed in CI.

Mocking in TypeScript (practical)

- Prefer typed mocks to avoid `any`. Examples:

```ts
// jest.spyOn example
const svc = new MyService();
jest.spyOn(svc, 'doWork').mockResolvedValue('ok');

// typed jest mock
type Svc = { doWork(): Promise<string> };
const mockSvc = { doWork: jest.fn() } as jest.Mocked<Svc>;
mockSvc.doWork.mockResolvedValue('ok');
```

- Use `jest.mock()` for module-level mocks and `jest.spyOn()` when you want to partially mock an instance or preserve other behavior.

NestJS testing pattern (minimal example)

```ts
import { Test } from '@nestjs/testing';
import { MyController } from './my.controller';
import { MyService } from './my.service';

describe('MyController', () => {
  let controller: MyController;
  let svc: jest.Mocked<MyService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MyController],
      providers: [{ provide: MyService, useValue: { get: jest.fn() } }],
    }).compile();

    controller = moduleRef.get(MyController);
    svc = moduleRef.get(MyService) as jest.Mocked<MyService>;
  });

  afterEach(async () => {
    // clean up if you created app/test containers
  });

  test('should return value', async () => {
    svc.get.mockResolvedValue('value');
    await expect(controller.get()).resolves.toBe('value');
  });
});
```

ESLint/Jest rules to enable (recommended)

- Consider enabling these rules in your ESLint config to keep tests healthy:
  - `jest/no-focused-tests` (prevent .only)
  - `jest/no-disabled-tests` (prevent skipped tests left in code)
  - `jest/valid-title` (consistent test titles)
  - `jest/expect-expect` (ensure tests have assertions)

If you want, I can commit these minimal additions to the file (already staged here) and then run a focused scan to (a) list tests missing typed mocks or (b) surface tests that mix `.then()` and `await`. Which scan should I run next: "typed-mock audit" or "async-pattern audit"? Or both?
