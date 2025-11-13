---
applyTo: 'apps/*-e2e/**/*.{test,spec}.ts'
---

This file contains only e2e-specific rules and clarifications. It inherits the general TypeScript rules from `ts.instructions.md` and the Jest/testing rules from `ts-jest.instructions.md`.

Do not duplicate rules that are already stated in those files (TSDoc, general AAA test structure, typing, import ordering, etc.). Below are the e2e-specific expectations and explicit overrides where behaviour differs from unit tests.

## Scope & Inheritance

- Inherits: `/.github/instructions/ts.instructions.md` (TypeScript best practices) and `/.github/instructions/ts-jest.instructions.md` (Jest test conventions).
- This file only documents e2e-specific constraints, environment patterns, and behaviours that differ from unit/integration tests.

## E2E-specific Rules (concise)

1) File naming and placement
   - Place e2e tests under `apps/*-e2e/` and use a clear e2e suffix such as `*.e2e.spec.ts` (project may accept other patterns; ensure `jest.config` maps them). This clarifies intent in CI.

2) Environment & lifecycle
   - Use `TestEnvironment` or a repository `BaseIntegrationEnvironment` subclass to manage containers and proxies.
   - Start containers in `beforeAll` (timeout ~60s) and stop in `afterAll` (timeout ~30s). Document setup/teardown with short comments.
   - Define a typed `Context` interface for shared handles (e.g., baseUrl: string, proxies, dataSources, clients).
   - Prefer real containers for dependencies (Postgres, Redis, S3/minio). Enable proxies by default to support chaos tests.

3) AAA + idempotency (short reminder)
   - Tests must follow Arrange / Act / Assert (brief comments are sufficient; full AAA guidance lives in `ts-jest.instructions.md`).
   - Tests must be idempotent: reset DB state between tests or use isolated schemas/containers.

4) Required e2e scenarios
   - Happy path (end-to-end success and side effects verified).
   - Error handling (invalid input, upstream failures).
   - Edge/boundary cases (non-existent resources, pagination bounds).
   - Chaos scenarios via proxies: disable/reenable services and inject toxics (latency, bandwidth, etc.).
   - Persistence verification: confirm DB state or storage objects after operations.

5) Mocking policy
   - Minimize module-level mocking. Prefer real containers and proxies. If mocking external HTTP APIs is necessary, use `jest.mock()` for the HTTP client and restrict mocks to a single test scope.

6) Type safety & docs (overrides)
   - The stricter TSDoc and typing requirements from `ts.instructions.md` apply. Additionally, e2e-specific artifacts (environment classes, helpers, context types) must have TSDoc and explicit types — these are shared/complex pieces and must be documented.
   - Individual small test functions may use concise comments (per `ts-jest.instructions.md`), but exported helpers and environment classes must be fully typed and documented.

7) Timeouts & reliability
   - Use generous timeouts for container startup and network operations. Annotate long waits and consider polling with timeouts rather than blind sleeps.

## Example skeleton (short)

```ts
describe('Service e2e', () => {
  const env = new TestEnvironment();
  type Context = { baseUrl: string; dbName: string };
  let ctx: Context;

  beforeAll(async () => {
    // Setup: start containers and initialize ctx
    await env.start();
    ctx = { baseUrl: env.url, dbName: env.dbName };
  }, 60000);

  afterAll(async () => {
    await env.stop();
  }, 30000);

  test('happy path (arrange/act/assert)', async (): Promise<void> => {
    // Arrange: prepare resources in DB
    // Act: perform HTTP request
    // Assert: verify response and DB state
  });
});
```

## Notes

- This file intentionally omits full TSDoc and type/style rules already defined in `ts.instructions.md`. When a rule here contradicts the parent instructions, the more specific e2e requirement should be followed.
- Keep this file focused: add only e2e-specific clarifications or exceptions to the base rules.
