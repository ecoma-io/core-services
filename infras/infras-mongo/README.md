# infras/mongo — MongoDB (infras-mongo)

Purpose

- Provide a local MongoDB database for development and tests.
- Configured as a single-node replica set for transaction support.

Contents

- `Dockerfile` — database image (from official MongoDB base image)
- `entrypoint.sh` — custom entrypoint to create databases
- `compose.yaml` — Compose file using the external `dev-infras` network
- `project.json` — Nx project config (depends on `infras-core`)

How to run

- With Nx (recommended):

  npx nx run infras-mongo:up

- With Docker Compose directly (requires `dev-infras`):

  cd infras/infras-mongo
  docker compose up --wait -d

Environment variables

- `MONGO_USERNAME` — DB root username
- `MONGO_PASSWORD` — DB root password
- `MONGO_PORT` — host port mapped to container 27017
- `MONGO_DATABASES` — comma-separated list of databases to create on startup (e.g., `test,myapp`)

Notes

- Persistent data: `compose.yaml` defines a volume `mongo_data` mounted at `/data/db`.
- The Compose file uses the external network `dev-infras`; ensure that network exists (start `infras-core` first or create it manually).
- MongoDB runs as a single-node replica set (`rs0`) to support transactions and change streams.
- Multiple databases are created automatically from `MONGO_DATABASES` environment variable.

Troubleshooting

- Validate compose:

  docker compose -f infras/infras-mongo/compose.yaml config

- View logs:

  docker compose -f infras/infras-mongo/compose.yaml logs -f
