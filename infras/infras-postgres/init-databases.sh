#!/bin/bash

# Script to initialize multiple PostgreSQL databases if POSTGRES_DATABASES is set.
# This script creates each specified database and grants all privileges to the POSTGRES_USER.
# It uses parameter expansion to handle unset variables safely and exits on errors.

set -e  # Exit on any command failure
set -u  # Treat unset variables as errors

# Function to create a database and grant privileges to the user.
# @param {string} database - The name of the database to create.
# @returns {void} - Executes SQL commands to create the database and grant privileges.
function create_database_and_grant() {
  local database=$1
  echo "  Creating database '$database' and granting access to '$POSTGRES_USER'"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE "${database}";
    GRANT ALL PRIVILEGES ON DATABASE "${database}" TO "${POSTGRES_USER}";
EOSQL
}

# Check if POSTGRES_DATABASES is set and non-empty using parameter expansion.
# This avoids errors with 'set -u' if the variable is unset.
if [ -n "${POSTGRES_DATABASES:-}" ]; then
  echo "Multiple database creation requested: ${POSTGRES_DATABASES}"
  # Split the comma-separated list into individual database names.
  for db in $(echo "${POSTGRES_DATABASES}" | tr ',' ' '); do
    create_database_and_grant "$db"
  done
  echo "Multiple databases created"
fi
