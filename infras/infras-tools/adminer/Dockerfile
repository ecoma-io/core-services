ARG ADMINER_VERSION=5.4.1

FROM docker.io/adminer:${ADMINER_VERSION}

USER root
COPY login-env-vars.php /var/www/html/plugins/
RUN chmod 644 /var/www/html/plugins/login-env-vars.php

ENV ADMINER_PLUGINS="login-env-vars"
USER adminer
