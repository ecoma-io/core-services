FROM alpine:3.22

ENV ADMINER_VERSION=5.4.1
ENV MEMORY=256M
ENV UPLOAD=2048M
ENV WORKERS=8
ENV PHP_CLI_SERVER_WORKERS=${WORKERS}

RUN echo '@community http://nl.alpinelinux.org/alpine/v3.22/community' >> /etc/apk/repositories && \
    apk update && \
    apk upgrade && \
    apk add --no-cache\
        wget=1.25.0-r2 \
        unzip=6.0-r16 \
        ca-certificates=20251003-r0 \
        php84@community=8.4.14-r0 \
        php84-session@community=8.4.14-r0 \
        php84-mysqli@community=8.4.14-r0 \
        php84-pgsql@community=8.4.14-r0 \
        php84-json@community=8.4.14-r0 \
        php84-pecl-mongodb@community=8.4.14-r0 \
        php84-sqlite3@community=8.4.14-r0 && \
    wget -q https://github.com/vrana/adminer/releases/download/v$ADMINER_VERSION/adminer-$ADMINER_VERSION-en.php -O /srv/index.php && \
    wget -q https://github.com/vrana/adminer/releases/download/v$ADMINER_VERSION/adminer-$ADMINER_VERSION.zip -O /tmp/adminer-$ADMINER_VERSION.zip && \
    unzip /tmp/adminer-$ADMINER_VERSION.zip -d /tmp && \
    mkdir -p /srv/adminer-plugins && \
    mv /tmp/adminer-$ADMINER_VERSION/plugins/*.php /srv/adminer-plugins 2>/dev/null || true && \
    mv /tmp/adminer-$ADMINER_VERSION/plugins/drivers/*.php /srv/adminer-plugins 2>/dev/null || true && \
    rm -rf /tmp/* && \
    ln -s /usr/bin/php84 /usr/bin/php && \
    apk del wget unzip ca-certificates && \
    rm -rf /var/cache/apk/* \
    rm -rf /srv/adminer-plugins/database-hide.php \
    rm -rf /srv/adminer-plugins/master-slave.php \
    rm -rf /srv/adminer-plugins/designs.php \
    rm -rf /srv/adminer-plugins/version-github.php \
    rm -rf /srv/adminer-plugins/dark-switcher.php \
    rm -rf /srv/adminer-plugins/version-noverify.php \
    rm -rf /srv/adminer-plugins/login-ssl.php \
    rm -rf /srv/adminer-plugins/login-ip.php \
    rm -rf /srv/adminer-plugins/login-servers.php \
    rm -rf /srv/adminer-plugins/login-otp.php \
    rm -rf /srv/adminer-plugins/login-password-less.php \
    rm -rf /srv/adminer-plugins/login-table.php

COPY plugins/ /srv/adminer-plugins
COPY adminer.css /srv/adminer.css
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /srv
EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
