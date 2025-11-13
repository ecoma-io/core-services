# Use the official PostgreSQL 16 image based on Alpine Linux for a lightweight base
FROM postgres:16-alpine

# Copy the database initialization script to the init directory
# This script will be executed when the container starts for the first time
COPY init-databases.sh /docker-entrypoint-initdb.d/
