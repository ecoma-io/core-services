#!/bin/sh
set -eu

# Simple entrypoint for development: require REDIS_PASSWORD and start redis-server

if [ -z "${REDIS_PASSWORD:-}" ]; then
  echo "REDIS_PASSWORD environment variable must be set" >&2
  exit 1
fi

# If first arg is an option (starts with -), prepend redis-server
if [ "${1:-}" ] && [ "${1#-}" != "$1" ]; then
  set -- redis-server "$@"
fi

# Exec redis-server with requirepass and any additional args
exec "$@" --requirepass "${REDIS_PASSWORD}"
