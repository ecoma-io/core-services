FROM clickhouse:25.10

# Copy our custom entrypoint which will start the server, wait, and initialize DBs
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["clickhouse-server"]

EXPOSE 8123 9000 9009
