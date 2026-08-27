# repfuel — Multi-stage Build: Frontend statisch bauen, Server kompilieren,
# schlankes Runtime-Image mit ausgeliefertem SPA-Build.

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/server apps/server
COPY apps/web apps/web

RUN pnpm --filter @repfuel/shared build \
  && pnpm --filter @repfuel/web build \
  && pnpm --filter @repfuel/server build

# Produktions-Abhängigkeiten des Servers isoliert auflösen
RUN pnpm --filter @repfuel/server --prod deploy --legacy /deploy/server

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /deploy/server/node_modules ./node_modules
COPY --from=build /deploy/server/package.json ./package.json
COPY --from=build /repo/apps/server/dist ./dist
COPY --from=build /repo/apps/server/drizzle ./drizzle
COPY --from=build /repo/apps/web/build ./public

ENV STATIC_DIR=/app/public
ENV PORT=8080
EXPOSE 8080

# Migrations laufen automatisch beim App-Start (src/index.ts → runMigrations)
CMD ["node", "dist/index.js"]
