# infras-elastic

This project provides a local development Elasticsearch instance (single-node).

Usage

- Configure host-level variables in the repository root `.env` file:

```dotenv
ELASTIC_PORT=9200
ELASTIC_PASSWORD=elastic
```

- Bring up the service from the repository root or from the `infras/infras-elastic` folder:

```bash
# from repo root
docker compose -f infras/infras-elastic/compose.yaml up -d

# or using nx target
npx nx run infras-elastic:up
```

Verify

```bash
curl -u elastic:${ELASTIC_PASSWORD} http://localhost:${ELASTIC_PORT}
curl -sS http://localhost:${ELASTIC_PORT}/_cluster/health
```

Notes

- This compose file uses the official Elasticsearch image `docker.elastic.co/elasticsearch/elasticsearch:8.10.0`.
- Security is enabled; `ELASTIC_PASSWORD` from the root `.env` is used to set the built-in `elastic` user password.
- The service runs as a single-node cluster (`discovery.type=single-node`).
- If you need to add custom plugins or configuration, add a `Dockerfile` and adjust the `project.json` lint/build targets accordingly.
