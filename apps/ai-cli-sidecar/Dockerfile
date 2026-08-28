# repfuel ai-cli-sidecar — Node + Claude Code (Agent SDK bringt die CLI mit).
# Image: ghcr.io/<owner>/repfuel-ai-cli

FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY apps/ai-cli-sidecar/package.json apps/ai-cli-sidecar/
RUN pnpm install --frozen-lockfile --filter @repfuel/ai-cli-sidecar

COPY tsconfig.base.json ./
COPY apps/ai-cli-sidecar apps/ai-cli-sidecar
RUN pnpm --filter @repfuel/ai-cli-sidecar build \
  && pnpm --filter @repfuel/ai-cli-sidecar --prod deploy --legacy /deploy/sidecar

FROM node:22-bookworm-slim
# git + ripgrep werden von Claude Code erwartet
RUN apt-get update && apt-get install -y --no-install-recommends git ripgrep ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /deploy/sidecar/node_modules ./node_modules
COPY --from=build /deploy/sidecar/package.json ./package.json
COPY --from=build /repo/apps/ai-cli-sidecar/dist ./dist

ENV PORT=8090
EXPOSE 8090

# Auth (siehe docs/AI_CLI.md): CLAUDE_CODE_OAUTH_TOKEN per Env ODER ~/.claude als Volume.
CMD ["node", "dist/index.js"]
