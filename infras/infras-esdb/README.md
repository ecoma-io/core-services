# infras/esdb — EventStoreDB (infras-esdb)

Purpose

- Provide a local EventStoreDB instance for event sourcing development and tests.

Contents

- `Dockerfile` — EventStoreDB image (from official EventStore base image)
- `compose.yaml` — Compose file using the external `dev-infras` network
- `project.json` — Nx project config (depends on `infras-core`)

How to run

- With Nx (recommended):

  npx nx run infras-esdb:up

- With Docker Compose directly (requires `dev-infras`):

  cd infras/infras-esdb
  docker compose up --wait -d

Environment variables

- `ESDB_HTTP_PORT` — host port mapped to container 2113 (HTTP API and Web UI)

Access

- Web UI: http://localhost:${ESDB_HTTP_PORT}
- Web UI (via Traefik): https://events.fbi.com
- HTTP API: http://localhost:${ESDB_HTTP_PORT}/
- gRPC Client: localhost:${ESDB_HTTP_PORT} (uses HTTP/2)

Notes

- Persistent data: `compose.yaml` defines a volume `esdb-data` mounted at `/var/lib/eventstore`.
- The Compose file uses the external network `dev-infras`; ensure that network exists (start `infras-core` first or create it manually).
- Running in insecure mode for development (authentication disabled).
- Standard projections are enabled by default.
- Traefik routing is configured for `events.fbi.com` domain.

Troubleshooting

- Validate compose:

  docker compose -f infras/infras-esdb/compose.yaml config

- View logs:

  docker compose -f infras/infras-esdb/compose.yaml logs -f

- Access Web UI to check EventStoreDB status and streams
