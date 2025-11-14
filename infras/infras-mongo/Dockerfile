# Use the official MongoDB 8 image based on Ubuntu Noble
FROM mongo:8.0-noble

# Copy the database initialization script to the init directory
# This script will be executed when the container starts for the first time
COPY init-databases.sh /docker-entrypoint-initdb.d/

# Expose MongoDB default port
EXPOSE 27017

# Set the default command to run MongoDB with replica set
CMD ["mongod", "--replSet", "rs0", "--bind_ip_all"]
