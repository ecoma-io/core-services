# MailDev - Email testing tool for development
# Base image from official MailDev
FROM maildev/maildev:2.2.1

USER root

RUN apk add --no-cache curl=~8 \
    && rm -rf /var/cache/apk/* /tmp/*

USER node

# Default command is inherited from base image
