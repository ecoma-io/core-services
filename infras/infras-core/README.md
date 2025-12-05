# infras/core — Traefik reverse proxy (core-infras)

Purpose

- Provide Traefik as the reverse proxy and TLS termination for local development.
- Host shared TLS certificates and dynamic routing configuration for developer services.

Contents

- `traefik.yml` — static Traefik configuration
- `dynamic.yml` — dynamic configuration (TLS certificates and stores)
- `cert.crt`, `cert.key` — TLS certificate and key used for HTTPS
- `Dockerfile` — builds a Traefik image that copies configuration and certs
- `compose.yaml` — Docker Compose file to run Traefik (creates the `dev-infras` network)

How to run

- With Nx (recommended):

  npx nx run core-infras:up

- With Docker Compose directly:

  cd infras/core
  docker compose up --wait -d

Notes

- Network: this project creates the `dev-infras` Docker network. Other infra projects use this network as `external: name: dev-infras`. Ensure `core-infras` is started before services that expect the external network, or create the network manually:

  docker network create dev-infras

- Traefik only routes containers that expose Traefik labels (e.g. `traefik.enable=true`) on the shared network. If Traefik is not running, those labels have no effect.

Troubleshooting

- View logs:

  docker compose -f infras/core/compose.yaml logs -f

- Validate compose config:

  docker compose -f infras/core/compose.yaml config

- If Traefik doesn’t discover a service: confirm the service is on the `dev-infras` network and has the correct Traefik labels.

Other notes

- Import `cert.crt` into your OS/browser if you want to avoid warnings from the self-signed certificate.
- Kiểm tra logs:
