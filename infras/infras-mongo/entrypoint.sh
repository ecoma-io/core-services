#!/bin/sh

# Custom entrypoint for infras-mongo (POSIX sh)
# - Starts the upstream image entrypoint or `mongod` if necessary
# - Waits for mongod to accept connections via `mongosh`
# - Creates databases listed in `MONGO_DATABASES` (comma-separated)

set -eu

MONGO_USER=${MONGO_INITDB_ROOT_USERNAME:-}
MONGO_PASS=${MONGO_INITDB_ROOT_PASSWORD:-}
MONGO_HOST=127.0.0.1
MONGO_PORT=${MONGO_PORT:-27017}
WAIT_RETRIES=${MONGO_WAIT_RETRIES:-60}

start_upstream() {
  if [ -x /usr/local/bin/docker-entrypoint.sh ]; then
    /usr/local/bin/docker-entrypoint.sh mongod &
  elif [ -x /entrypoint.sh ]; then
    /entrypoint.sh mongod &
  else
    mongod --bind_ip_all &
  fi
  UP_PID=$!
}

wait_for_mongo() {
  echo "Waiting for MongoDB to accept connections on ${MONGO_HOST}:${MONGO_PORT}..."
  i=1
  while [ "$i" -le "$WAIT_RETRIES" ]; do
    if mongosh --quiet --host "$MONGO_HOST" --port "$MONGO_PORT" --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
      echo "MongoDB is available (after ${i}s)"
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  echo "Timed out waiting for MongoDB after ${WAIT_RETRIES}s" >&2
  return 1
}

create_databases_from_env() {
  if [ -z "${MONGO_DATABASES:-}" ]; then
    return 0
  fi

  echo "MONGO_DATABASES is set: ${MONGO_DATABASES}"
  for db in $(echo "${MONGO_DATABASES}" | tr ',' ' '); do
    # trim whitespace (portable)
    db=$(echo "$db" | awk '{gsub(/^ +| +$/,"",$0); print $0}')
    if [ -z "$db" ]; then
      continue
    fi

    echo "  Ensuring database '$db' exists"
    if [ -n "$MONGO_USER" ] && [ -n "$MONGO_PASS" ]; then
      mongosh --quiet --host "$MONGO_HOST" --port "$MONGO_PORT" --username "$MONGO_USER" --password "$MONGO_PASS" --authenticationDatabase admin <<EOF
use $db
db.createCollection('_init')
db._init.insertOne({ initialized: true, createdAt: new Date() })
EOF
    else
      mongosh --quiet --host "$MONGO_HOST" --port "$MONGO_PORT" <<EOF
use $db
db.createCollection('_init')
db._init.insertOne({ initialized: true, createdAt: new Date() })
EOF
    fi
  done
  echo "Database creation complete"
}

# If the first arg looks like mongod or options, start mongod path in background and init
case "${1:-}" in
  mongod|-[!-]*)
    start_upstream
    wait_for_mongo
    create_databases_from_env
    wait "$UP_PID"
    exit $?
    ;;
  -*)
    start_upstream
    wait_for_mongo
    create_databases_from_env
    wait "$UP_PID"
    exit $?
    ;;
  *)
    exec "$@"
    ;;
esac
