#!/bin/sh

# POSIX entrypoint for infras-clickhouse
# - Starts upstream entrypoint / clickhouse server in background
# - Waits for ClickHouse to accept connections via clickhouse-client
# - Creates databases listed in CLICKHOUSE_DATABASES (comma-separated)

set -eu

CLICKHOUSE_HOST=127.0.0.1
CLICKHOUSE_TCP_PORT=9000
CLICKHOUSE_USER=${CLICKHOUSE_USER:-default}
CLICKHOUSE_PASSWORD=${CLICKHOUSE_PASSWORD:-}
WAIT_RETRIES=${CLICKHOUSE_WAIT_RETRIES:-60}

start_upstream() {
  # Try to start the original upstream entrypoint if present, otherwise start clickhouse-server
  if [ -x /entrypoint.sh ] && [ "$(readlink -f /entrypoint.sh)" != "$(readlink -f "$0")" ]; then
    /entrypoint.sh clickhouse-server &
  elif [ -x /usr/bin/clickhouse-server ]; then
    /usr/bin/clickhouse-server &
  else
    clickhouse-server &
  fi
  UP_PID=$!
}

wait_for_clickhouse() {
  echo "Waiting for ClickHouse at ${CLICKHOUSE_HOST}:${CLICKHOUSE_TCP_PORT}..."
  i=1
  while [ "$i" -le "$WAIT_RETRIES" ]; do
    if [ -n "${CLICKHOUSE_PASSWORD}" ]; then
      if clickhouse-client --host "$CLICKHOUSE_HOST" --port "$CLICKHOUSE_TCP_PORT" --user "$CLICKHOUSE_USER" --password "$CLICKHOUSE_PASSWORD" --query "SELECT 1" >/dev/null 2>&1; then
        echo "ClickHouse available (after ${i}s)"
        return 0
      fi
    else
      if clickhouse-client --host "$CLICKHOUSE_HOST" --port "$CLICKHOUSE_TCP_PORT" --user "$CLICKHOUSE_USER" --query "SELECT 1" >/dev/null 2>&1; then
        echo "ClickHouse available (after ${i}s)"
        return 0
      fi
    fi
    i=$((i + 1))
    sleep 1
  done
  echo "Timed out waiting for ClickHouse after ${WAIT_RETRIES}s" >&2
  return 1
}

create_databases_from_env() {
  if [ -z "${CLICKHOUSE_DATABASES:-}" ]; then
    return 0
  fi

  echo "CLICKHOUSE_DATABASES is set: ${CLICKHOUSE_DATABASES}"
  # Split comma-separated list
  OLD_IFS=$IFS
  IFS=','
  for db in $CLICKHOUSE_DATABASES; do
    IFS=$OLD_IFS
    # trim whitespace
    db=$(echo "$db" | awk '{gsub(/^ +| +$/,"",$0); print $0}')
    if [ -z "$db" ]; then
      IFS=','
      continue
    fi
    echo "  Ensuring ClickHouse database '$db' exists"
    if [ -n "${CLICKHOUSE_PASSWORD}" ]; then
      clickhouse-client --host "$CLICKHOUSE_HOST" --port "$CLICKHOUSE_TCP_PORT" --user "$CLICKHOUSE_USER" --password "$CLICKHOUSE_PASSWORD" --query "CREATE DATABASE IF NOT EXISTS \"${db}\""
    else
      clickhouse-client --host "$CLICKHOUSE_HOST" --port "$CLICKHOUSE_TCP_PORT" --user "$CLICKHOUSE_USER" --query "CREATE DATABASE IF NOT EXISTS \"${db}\""
    fi
    IFS=','
  done
  IFS=$OLD_IFS
  echo "ClickHouse database initialization complete"
}

# If invoked with mongod-like/server args, start server in background, wait and init
case "${1:-}" in
  ''|clickhouse-server|clickhouse-server-*)
    start_upstream
    wait_for_clickhouse
    create_databases_from_env
    wait "$UP_PID"
    exit $?
    ;;
  -*)
    start_upstream
    wait_for_clickhouse
    create_databases_from_env
    wait "$UP_PID"
    exit $?
    ;;
  *)
    exec "$@"
    ;;
esac
