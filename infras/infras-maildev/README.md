# infras/maildev — MailDev (infras-maildev)

Purpose

- Run MailDev for capturing outgoing emails during local development and providing a web UI to inspect messages.

Contents

- `Dockerfile` — image for MailDev
- `compose.yaml` — Compose file that attaches MailDev to the shared `dev-infras` network
- `project.json` — Nx project to start MailDev; it depends on `core-infras` so Traefik is started first

How to run

- With Nx (recommended):

  npx nx run infras-maildev:up

- With Docker Compose directly (requires `dev-infras` network):

  cd infras/maildev
  docker compose up --wait -d

Environment variables

- `MAILDEV_PORT` — SMTP port exposed on localhost (default defined in your environment)
- `MAILDEV_WEB_PORT` — Web UI port
- `MAILDEV_USER`, `MAILDEV_PASSWORD` — credentials if configured

Notes

- Network: this Compose expects the external network `dev-infras` to exist. Start `core-infras` first or create the network manually:

  docker network create dev-infras

- Traefik: MailDev includes Traefik labels so Traefik (running in `core-infras`) can route `mail.fbi.com` to the web UI.

Troubleshooting

- Validate the compose file:

  docker compose -f infras/maildev/compose.yaml config

- View logs:

  docker compose -f infras/maildev/compose.yaml logs -f
