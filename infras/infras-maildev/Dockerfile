# MailDev - Email testing tool for development
# Base image from official MailDev
FROM maildev/maildev:2.0.5

USER root

RUN apk add --no-cache curl=~8 \
    && rm -rf /var/cache/apk/* /tmp/*

USER node

# Default command is inherited from base image
