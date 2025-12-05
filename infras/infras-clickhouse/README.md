# infras-clickhouse

Simple ClickHouse infrastructure for local development.

Services:

- `clickhouse` - ClickHouse server exposing HTTP (8123) and native TCP (9000).

Quick start:

```bash
# Start ClickHouse
docker compose -f infras/infras-clickhouse/compose.yaml up --wait -d

# Stop ClickHouse
docker compose -f infras/infras-clickhouse/compose.yaml down
```

Configuration

- Data persisted under `infras/infras-clickhouse/data`.
- Add additional server configs under `infras/infras-clickhouse/configs` if needed.
