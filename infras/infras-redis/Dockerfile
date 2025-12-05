FROM redis:8-alpine

# Add a small entrypoint that validates REDIS_PASSWORD and starts redis-server
COPY --chmod=755 entrypoint.sh /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["redis-server"]
