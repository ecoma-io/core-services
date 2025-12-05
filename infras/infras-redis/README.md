# infras/redis — Redis (infras-redis)

Purpose

- Provide a local Redis instance for caching and ephemeral queues during development.

Contents

- `Dockerfile` — Redis image or configuration
- `compose.yaml` — Compose file using the external `dev-infras` network
- `project.json` — Nx project config (depends on `core-infras`)

How to run

- With Nx (recommended):

  npx nx run infras-redis:up

- With Docker Compose directly (requires `dev-infras`):

  cd infras/redis
  docker compose up --wait -d

Environment variables

- `REDIS_PORT` — host port mapped to container 6379
- `REDIS_PASSWORD` — optional password used by the Redis server and clients

Notes

- Healthcheck: Compose defines a healthcheck that pings Redis using the configured password.
- If you need a UI, `infras/tools/redis-commander` provides a Redis web UI (start `core-infras` first so Traefik can route it).

Troubleshooting

- Validate compose:

  docker compose -f infras/redis/compose.yaml config

- View logs:

  docker compose -f infras/redis/compose.yaml logs -f
