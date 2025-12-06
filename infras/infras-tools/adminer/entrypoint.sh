#!/bin/bash
set -Eeo pipefail

if [ "${ADMINER_DEBUG}" = "1" ]; then
  set -o xtrace
fi

echo "[adminer] Loading Adminer..."

# Set default values if not provided
MEMORY=${MEMORY:-256M}
UPLOAD=${UPLOAD:-2048M}

echo "[adminer] Starting PHP server (http://0.0.0.0:80 in Docker):"
echo "-> memory_limit=${MEMORY}"
echo "-> upload_max_filesize=${UPLOAD}"
echo "-> post_max_size=${UPLOAD}"

# Execute PHP server
exec php \
    -d "memory_limit=${MEMORY}" \
    -d "upload_max_filesize=${UPLOAD}" \
    -d "post_max_size=${UPLOAD}" \
    -S 0.0.0.0:80
