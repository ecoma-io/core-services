# Use the official MongoDB 8 image based on Ubuntu Noble
FROM mongo:8.2.1-noble

# Copy our custom entrypoint which will start mongod, wait, and create DBs
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Use our custom entrypoint
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["mongod"]

# Expose MongoDB default port
EXPOSE 27017


