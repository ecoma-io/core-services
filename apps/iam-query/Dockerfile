FROM node:22-alpine

RUN npm i -g pnpm

ENV PORT=80
EXPOSE $PORT

COPY dist /app

WORKDIR /app

RUN pnpm install \
  && pnpm add tslib

CMD [ "node", "main.js" ]


