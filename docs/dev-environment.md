````markdown
# Development Environment — Devcontainer & Dev Infrastructure

This document explains how to set up and run the local development environment for the `core-services` monorepo. It covers:

- Using VS Code Dev Containers (devcontainer)
- Starting and inspecting the development infrastructure services (Postgres, Redis, MinIO, RabbitMQ, Elasticsearch, EventStore, MailDev, Traefik)
- Example `.env` variables for local development
- Troubleshooting and tips

---

## Devcontainer (VS Code)

Recommended workflow:

- Use the **Dev Containers** extension in VS Code to open the repository in a reproducible development container. This ensures consistent Node/pnpm versions and a Docker-enabled environment for Testcontainers and other integrations.
- Recommended extensions to install in the container: `ms-vscode-remote.remote-containers` (Dev Containers), `nrwl.angular-console` or `nx-console` (optional), `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`, `ms-azuretools.vscode-docker`.
- Typical devcontainer benefits:
  - Preinstalled toolchain (Node, pnpm, nx)
  - `pnpm install` executed automatically via `postCreateCommand`
  - Consistent environment for running `npx nx serve`, Testcontainers-based E2E tests, and Docker Compose commands

How to open in devcontainer:

1. Install the Dev Containers extension in VS Code.
2. Command Palette -> `Dev Containers: Clone Repository in Container Volume...` or `Dev Containers: Reopen in Container` if already cloned.
3. Choose the recommended branch (typically `dev`).

Notes:

- The repository includes instructions and UX flows assuming the devcontainer will manage dependencies and local tools. If you don't use a devcontainer, ensure you replicate the same Node/pnpm versions as the workflows.
- After the container starts, run `pnpm install` (if not run automatically) and then start infrastructure services as described below.

---

## Development infrastructure (infras)

The `infras/` folder contains modular Docker Compose projects for development infrastructure. The `infras/core` project runs Traefik and creates the shared `dev-infras` Docker network. Other infra projects attach to that network.

Recommended start order:

1. Start the core infra (creates `dev-infras` network and Traefik):

```bash
docker compose -f infras/infras-core/compose.yaml up -d --wait
```

2. Start additional infra services (examples below). You can start them individually or in groups.

```bash
docker compose -f infras/infras-postgres/compose.yaml up -d --wait
docker compose -f infras/infras-redis/compose.yaml up -d --wait
docker compose -f infras/infras-minio/compose.yaml up -d --wait
docker compose -f infras/infras-rabbitmq/compose.yaml up -d --wait
docker compose -f infras/infras-elastic/compose.yaml up -d --wait
docker compose -f infras/infras-esdb/compose.yaml up -d --wait
docker compose -f infras/infras-maildev/compose.yaml up -d --wait
```

Alternatively, use the Nx helper (if configured in workspace) to bring up core infra:

```bash
npx nx run core-infras:up
```

### Services & typical ports

The compose files expose ports via environment variables. Example service endpoints you will commonly use:

- Traefik dashboard: `https://traefik.fbi.com` (ports 80/443 forwarded by Traefik)
- Postgres: `${POSTGRES_PORT}` → container port `5432` (example default: `5432`)
- Redis: `${REDIS_PORT}` → container port `6379` (example default: `6379`)
- MinIO (S3 compatible): `${MINIO_PORT}` → container port `9000` (console `:9001` exposed) — accessible via `http://minio.fbi.com` when Traefik routes are active
- RabbitMQ AMQP: `${RABBITMQ_AMQP_PORT}` → `5672`, management UI: `${RABBITMQ_MANAGEMENT_PORT}` → `15672`
- Elasticsearch: `${ELASTIC_PORT}` → `9200`
- EventStore DB: `${ESDB_HTTP_PORT}` → `2113` (web UI and HTTP API) — routed at `events.fbi.com`
- MailDev SMTP: `${MAILDEV_PORT}` → `1025`, web UI: `${MAILDEV_WEB_PORT}` → `1080` (routed at `mail.fbi.com`)

Note: Compose files use environment variables (e.g., `${POSTGRES_PORT}`, `${MINIO_KEY}`) — see the example `.env` below for recommended local values.

### Example `.env` for local development (do NOT commit)

Create a file such as `infras/.env.local` or a repo-root `.env.local` and add values like below. These are sample defaults — choose secure values for your environment.

```env
# Postgres
POSTGRES_PORT=5432
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DATABASES=postgres

# Redis
REDIS_PORT=6379
REDIS_PASSWORD=redispass

# MinIO
MINIO_PORT=9000
MINIO_KEY=minioadmin
MINIO_SECRET=minioadmin

# MailDev
MAILDEV_PORT=1025
MAILDEV_WEB_PORT=1080
MAILDEV_USER=
MAILDEV_PASSWORD=

# RabbitMQ
RABBITMQ_AMQP_PORT=5672
RABBITMQ_MANAGEMENT_PORT=15672
RABBITMQ_WEB_STOM_PORT=15674
RABBITMQ_USERNAME=guest
RABBITMQ_PASSWORD=guest

# Elasticsearch
ELASTIC_PORT=9200
ELASTIC_PASSWORD=changeme

# EventStore DB
ESDB_HTTP_PORT=2113

# Other
# Add other variables required by services
```

Place this file in the directory where you run `docker compose` commands or export the variables into your shell before starting the compose projects.

### Using Traefik routing and self-signed certificate

- Traefik is configured to route services under `*.fbi.com` (for example `minio.fbi.com`, `mail.fbi.com`, `events.fbi.com`). To avoid browser TLS warnings, import `infras/infras-core/cert.crt` into your OS/browser trust store as documented in `docs/getting-started.md`.

---

## Common commands & troubleshooting

- View logs for a particular compose project:

```bash
docker compose -f infras/infras-postgres/compose.yaml logs -f
```

- View all running infra containers:

```bash
docker ps --filter network=dev-infras
```

- If a compose file expects the `dev-infras` network but it doesn't exist, create it:

```bash
docker network create dev-infras
```

- Recreate a service with fresh volumes (data loss):

```bash
docker compose -f infras/infras-postgres/compose.yaml down -v
docker compose -f infras/infras-postgres/compose.yaml up -d
```

- If Testcontainers-based E2E tests fail in CI or locally, ensure Docker is running and the devcontainer has access to the host Docker daemon (bind `/var/run/docker.sock` or use Docker-in-Docker strategy).

---

## Tips & best practices

- Start `infras/core` first to ensure the shared `dev-infras` network and Traefik are available.
- Keep a single `.env.local` for local development and add it to `.gitignore`.
- Protect sensitive credentials — do not commit them to the repo. Use a secret manager for shared developer credentials if necessary.
- Increase Docker Desktop resources (CPU/RAM) when running Testcontainers or multiple services locally.

---

If you want, I can:

- Add a `infras/.env.example` file with the variables above.
- Add an Nx target or a small script `scripts/dev-infra-up.sh` that starts core infra and the common services in the recommended order.

Tell me which follow-up you'd like.
````
