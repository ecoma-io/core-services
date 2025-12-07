FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY dist /app
WORKDIR /app

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile \
  && pnpm add tslib@^2.3.0
FROM base


COPY --from=prod-deps /app/node_modules /app/node_modules
ENV NODE_ENV=production
ENV APP_NAME=idm-query
ENTRYPOINT [ "node" ]
CMD [ "main.js" ]


