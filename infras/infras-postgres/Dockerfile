# Use the official PostgreSQL image based on Alpine Linux for a lightweight base
FROM postgres:18-alpine

# Copy the custom entrypoint which waits for Postgres and runs initialization
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh

# Use our custom entrypoint which waits for Postgres to be ready and runs initialization
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["postgres"]
