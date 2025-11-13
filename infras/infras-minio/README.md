# infras/minio — MinIO (infras-minio)

Purpose

- Provide a local S3-compatible object store (MinIO) and a helper `minio-client` image to create buckets or seed data.

Contents

- `minio/` — Dockerfile for MinIO service
- `minio-client/` — Dockerfile and entrypoint for seeding buckets
- `compose.yaml` — Compose file grouping `minio` and `minio-client` on the external `dev-infras` network
- `project.json` — Nx project config (depends on `core-infras`)

How to run

- With Nx (recommended):

  npx nx run infras-minio:up

- With Docker Compose directly (requires `dev-infras`):

  cd infras/minio
  docker compose up --wait -d

Environment variables

- `MINIO_KEY` — MinIO root access key
- `MINIO_SECRET` — MinIO root secret key
- `MINIO_PORT` — host port for MinIO API (defaults may be set in environment)

Notes

- `minio-client` depends on `minio` healthy status; it can be used to create buckets/policies programmatically on startup.
- The Compose file includes Traefik labels so Traefik will route `minio.fbi.com` and `files.fbi.com` when Traefik is running.

Troubleshooting

- Validate compose:

  docker compose -f infras/minio/compose.yaml config

- View logs:

  docker compose -f infras/minio/compose.yaml logs -f
