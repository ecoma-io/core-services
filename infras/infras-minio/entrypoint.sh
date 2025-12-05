#!/bin/sh

# Start MinIO in the background
minio server /data --address=":19000" &
MINIO_PID=$!

# Wait for MinIO to be ready
until curl -sS http://127.0.0.1:19000/minio/health/live; do
  sleep 1
done

# Configure mc alias
mc alias set local http://127.0.0.1:19000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD
/usr/bin/mc mb -p local/assets || true
/usr/bin/mc anonymous set none local/assets || true
/usr/bin/mc mb -p local/resources || true
/usr/bin/mc anonymous set download local/resources || true

# kill current minio process to let container run with original entrypoint
kill $MINIO_PID

exec minio "$@"
