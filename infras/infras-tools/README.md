# infras/tools — Developer tools and UIs

Purpose

- Group developer-facing utilities (Adminer, Redis Commander, docs server, nx-graph) that are not required for automated tests but are helpful while developing.

Contents

- `compose.yaml` — Compose file to run the tools (expects `dev-infras` network and `core-infras` to be available)
- Subfolders: `adminer`, `redis-commander`, `docs`, `nx-graph` (each contains its Dockerfile and local config)
- `project.json` — Nx project wrapper to start the tools if present

How to run

- With Nx (recommended):

  npx nx run tools:up

- With Docker Compose directly (requires `dev-infras`):

  cd infras/tools
  docker compose up --wait -d

Notes

- Network & Traefik: these tools often include Traefik labels for routing (e.g. `adminer.fbi.com`, `redis.fbi.com`). Ensure `core-infras` (Traefik) is running and the `dev-infras` network exists.
- These services are optional for CI/e2e and can be started on-demand to debug or inspect state.

Troubleshooting

- Validate compose:

  docker compose -f infras/tools/compose.yaml config

- View logs:

  docker compose -f infras/tools/compose.yaml logs -f
