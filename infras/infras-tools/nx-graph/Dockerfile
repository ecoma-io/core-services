FROM node:24-alpine

RUN corepack enable \
  && apk add --no-cache git=~2 \
  && rm -rf /var/cache/apk/* /tmp/*

USER node
WORKDIR /node/app

ENTRYPOINT [ "npx" ]
CMD [ "nx", "graph", "--host", "0.0.0.0", "--port", "8080" ]
