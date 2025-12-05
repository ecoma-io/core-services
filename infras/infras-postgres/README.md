# infras/postgres — PostgreSQL (infras-postgres)

Purpose

- Provide a local PostgreSQL database for development and tests.

Contents

- `Dockerfile` — database image (from official Postgres base image)
- `entrypoint .sh` — custom entrypoint script to create multiple databases
- `compose.yaml` — Compose file using the external `dev-infras` network
- `project.json` — Nx project config (depends on `core-infras`)

How to run

- With Nx (recommended):

  npx nx run infras-postgres:up

- With Docker Compose directly (requires `dev-infras`):

  cd infras/postgres
  docker compose up --wait -d

Environment variables

- `POSTGRES_USERNAME` — DB username
- `POSTGRES_PASSWORD` — DB password
- `POSTGRES_DATABASES` — database name(s) to create (separated by commas)
- `POSTGRES_PORT` — host port mapped to container 5432

Notes

- Persistent data: `compose.yaml` defines a volume `postgres_data` mounted at `/var/lib/postgresql/data`.
- The Compose file uses the external network `dev-infras`; ensure that network exists (start `infras-core` first or create it manually).

Troubleshooting

- Validate compose:

  docker compose -f infras/postgres/compose.yaml config

- View logs:

  docker compose -f infras/postgres/compose.yaml logs -f
