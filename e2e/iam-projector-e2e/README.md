# IAM Projector E2E

E2E tests validating projection flow for Tenant vertical slice.

## Scope

- Start infrastructure containers (Postgres, Redis, RabbitMQ, EventStoreDB)
- Start `iam-command-service` and `iam-projector-worker`
- Issue `CreateTenant` command
- Verify row appears in `tenants_read_model` (RYOW polling)

## Run

```bash
pnpm nx e2e iam-projector-e2e
```

## Notes

- Uses `ProjectorTestEnvironment` extending base integration environment.
- Polling timeout is 8s; adjust if CI is slower.
