FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/plugin-api/package.json packages/plugin-api/package.json
RUN npm ci

COPY apps/server apps/server
COPY packages/plugin-api packages/plugin-api
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app

COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/server/package.json ./apps/server/package.json
COPY --from=build --chown=node:node /app/apps/server/dist ./apps/server/dist
COPY --from=build --chown=node:node /app/packages/plugin-api/package.json ./packages/plugin-api/package.json
COPY --from=build --chown=node:node /app/packages/plugin-api/dist ./packages/plugin-api/dist
COPY --chown=node:node plugins ./plugins

RUN npx playwright install --with-deps chromium \
  && chown -R node:node /ms-playwright

RUN mkdir -p /vault /app/data /app/tmp \
  && chown -R node:node /vault /app/data /app/tmp

USER node
EXPOSE 8080

CMD ["node", "apps/server/dist/main.js"]
