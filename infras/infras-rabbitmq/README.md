# infras/rabbitmq — RabbitMQ (infras-rabbitmq)

Purpose

- Provide a local RabbitMQ broker (with management UI and STOMP/ws endpoints) for development and integration tests.

Contents

- `Dockerfile` — image for RabbitMQ and plugins
- `compose.yaml` — Compose file using the external `dev-infras` network
- `project.json` — Nx project config (depends on `core-infras`)

How to run

- With Nx (recommended):

  npx nx run infras-rabbitmq:up

- With Docker Compose directly (requires `dev-infras`):

  cd infras/rabbitmq
  docker compose up --wait -d

Environment variables

- `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD` — default user/password
- `RABBITMQ_AMQP_PORT`, `RABBITMQ_MANAGEMENT_PORT`, `RABBITMQ_WEB_STOM_PORT` — host ports mapped to container ports

Notes

- The Compose file defines `rabbitmq_data` for persistent state; if you need a fresh broker, remove the volume and recreate.

Troubleshooting

- Validate compose:

  docker compose -f infras/rabbitmq/compose.yaml config

- View logs:

  docker compose -f infras/rabbitmq/compose.yaml logs -f

- If plugins or management UI fail to start, check `rabbitmq-diagnostics status` inside the container.
