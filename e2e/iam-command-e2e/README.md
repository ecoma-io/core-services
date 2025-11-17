# iam-command-e2e

## Purpose

`iam-command-e2e` is the end-to-end test project for the IAM Command Service. It contains Jest e2e configuration and Testcontainers-based test environment helpers.

## Where to find the code

- Source: `e2e/iam-command-e2e/src`
- Jest config: `e2e/iam-command-e2e/jest-e2e.config.mjs`

## Running e2e tests

E2E tests require Docker and Testcontainers. Run:

```bash
npx nx e2e iam-command-e2e
```

If tests use a custom test environment, ensure Docker is running and required images are available.

## Environment variables (placeholders)

## Notes

## Running in CI / required envs

The integration test environment depends on a set of infra variables used by `BaseIntegrationEnvironment` and `TestEnvironment`. For local runs you typically supply these via the repository root `.env` or CI secrets.

Common variables the e2e test environment expects:

- `POSTGRES_PORT`, `POSTGRES_USERNAME`, `POSTGRES_PASSWORD`
- `MINIO_PORT`, `MINIO_KEY`, `MINIO_SECRET`
- `REDIS_PORT`, `REDIS_PASSWORD`
- `MAILDEV_WEB_PORT`

Quick checklist to run locally:

1. Ensure Docker is running.
2. Run:

```bash
npx nx e2e iam-command-e2e
```

If tests fail because containers cannot be pulled or started, check Docker daemon permissions and available images. In CI, prefer using prebuilt images or pull from your registry and inject credentials via the CI secrets manager.
