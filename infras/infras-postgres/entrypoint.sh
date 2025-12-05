#!/bin/sh

# Custom entrypoint for infras-postgres (POSIX shell)
# - Uses the upstream `/usr/local/bin/docker-entrypoint.sh` to start Postgres
# - Waits for Postgres to accept TCP connections
# - Creates databases listed in `POSTGRES_DATABASES` (comma-separated)
# - Grants privileges to `POSTGRES_USER`

set -eu

POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-}
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=${POSTGRES_PORT:-5432}
WAIT_RETRIES=60

psql_cmd() {
  PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --host "$POSTGRES_HOST" --port "$POSTGRES_PORT" "$@"
}

wait_for_postgres() {
  echo "Waiting for Postgres to accept connections on ${POSTGRES_HOST}:${POSTGRES_PORT}..."
  i=1
  while [ "$i" -le "$WAIT_RETRIES" ]; do
    if PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -c '\q' >/dev/null 2>&1; then
      echo "Postgres is available (after ${i}s)"
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  echo "Timed out waiting for Postgres after ${WAIT_RETRIES}s" >&2
  return 1
}

create_databases_from_env() {
  if [ -z "${POSTGRES_DATABASES:-}" ]; then
    return 0
  fi

  echo "POSTGRES_DATABASES is set: ${POSTGRES_DATABASES}"
  for db in $(echo "${POSTGRES_DATABASES}" | tr ',' ' '); do
    # trim whitespace (portable)
    db=$(echo "$db" | awk '{gsub(/^ +| +$/,"",$0); print $0}')
    if [ -z "$db" ]; then
      continue
    fi

    echo "  Ensuring database '$db' exists and granting access to '$POSTGRES_USER'"
    exists=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -tA -c "SELECT 1 FROM pg_database WHERE datname='${db}'") || true
    if [ "$exists" != '1' ]; then
      echo "    Creating database '$db'"
      psql_cmd -c "CREATE DATABASE \"${db}\";"
    else
      echo "    Database '$db' already exists"
    fi

    # Grant privileges (safe to run even if DB already existed)
    psql_cmd -c "GRANT ALL PRIVILEGES ON DATABASE \"${db}\" TO \"${POSTGRES_USER}\";"
  done
  echo "Database creation/granting complete"
}

# If the user asked to run postgres (or passed flags which we treat as postgres args),
# start the upstream docker-entrypoint in the background, wait for the server, run init, then wait.
case "${1:-}" in
  postgres|-[!-]*)
    echo "Starting upstream docker-entrypoint for Postgres in background..."
    /usr/local/bin/docker-entrypoint.sh postgres &
    DOCKER_ENTRYPOINT_PID=$!

    # Wait for postgres to be ready
    wait_for_postgres

    # Create databases as requested
    create_databases_from_env

    # Wait for the background process (Postgres) to exit, forwarding exit code
    wait "$DOCKER_ENTRYPOINT_PID"
    exit $?
    ;;
  -*)
    # option-only invocation also treated as postgres start
    echo "Starting upstream docker-entrypoint for Postgres in background..."
    /usr/local/bin/docker-entrypoint.sh "$@" &
    DOCKER_ENTRYPOINT_PID=$!
    wait_for_postgres
    create_databases_from_env
    wait "$DOCKER_ENTRYPOINT_PID"
    exit $?
    ;;
  *)
    # For any other command simply execute it
    exec "$@"
    ;;
esac

