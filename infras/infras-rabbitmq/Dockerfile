FROM rabbitmq:management-alpine

# Install necessary tools
RUN apk update \
  && apk add --no-cache curl=~8 \
  && rm -rf /var/cache/apk/* /tmp/*

# Download and install the delayed message exchange plugin
RUN set -eux; \
  curl -fsSL -o /opt/rabbitmq/plugins/rabbitmq_delayed_message_exchange-4.2.0.ez https://github.com/rabbitmq/rabbitmq-delayed-message-exchange/releases/download/v4.2.0/rabbitmq_delayed_message_exchange-4.2.0.ez; \
  chown rabbitmq:rabbitmq /opt/rabbitmq/plugins/rabbitmq_delayed_message_exchange-4.2.0.ez; \
  chmod 644 /opt/rabbitmq/plugins/rabbitmq_delayed_message_exchange-4.2.0.ez

# Enable plugins
RUN rabbitmq-plugins enable --offline \
  rabbitmq_web_stomp \
  rabbitmq_delayed_message_exchange

# Expose ports
EXPOSE 5672 15672 15674

# Set the entrypoint
CMD ["rabbitmq-server"]
