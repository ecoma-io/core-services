#!/bin/bash

# Script to initialize MongoDB replica set and create multiple databases if MONGO_DATABASES is set.
# This script initializes a single-node replica set and creates databases with the root user.
# It uses parameter expansion to handle unset variables safely and exits on errors.

set -e  # Exit on any command failure
set -u  # Treat unset variables as errors

echo "Waiting for MongoDB to be ready..."
# Wait for MongoDB to be ready (it's already started by the base image)
until mongosh --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
  sleep 1
done

echo "Initializing replica set rs0..."
# Initialize the replica set (single node)
mongosh --quiet <<EOF
rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "localhost:27017" }]
});
EOF

echo "Waiting for replica set to be ready..."
# Wait for replica set to become primary
until mongosh --quiet --eval "rs.status().myState" | grep -q "1"; do
  sleep 1
done

# Function to create a database
# @param {string} database - The name of the database to create.
# @returns {void} - Executes MongoDB commands to create the database.
function create_database() {
  local database=$1
  echo "  Creating database '$database'"
  mongosh --quiet <<EOF
use ${database}
db.createCollection('_init')
db._init.insertOne({ initialized: true, createdAt: new Date() })
EOF
}

# Check if MONGO_DATABASES is set and non-empty using parameter expansion.
# This avoids errors with 'set -u' if the variable is unset.
if [ -n "${MONGO_DATABASES:-}" ]; then
  echo "Multiple database creation requested: ${MONGO_DATABASES}"
  # Split the comma-separated list into individual database names.
  for db in $(echo "${MONGO_DATABASES}" | tr ',' ' '); do
    create_database "$db"
  done
  echo "Multiple databases created"
fi

echo "MongoDB initialization complete"
