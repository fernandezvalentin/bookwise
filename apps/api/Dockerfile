# Bookwise API. Build from the repository root:
#   docker build -f apps/api/Dockerfile .
#
# Stages:
#   build    all dependencies, Prisma client, compiled app. Also used to run
#            migrations (`prisma migrate deploy` needs the Prisma CLI).
#   runtime  production dependencies and the compiled app only.

FROM node:24-alpine AS base
WORKDIR /app

# ---------------------------------------------------------------------
FROM base AS build
# Only the manifests first, so the install layer is cached until they change.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
# prisma.config.ts reads DATABASE_URL; generating the client doesn't connect.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npm ci -w apps/api

COPY apps/api apps/api
RUN npm run build -w apps/api

# ---------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# The Prisma client is already generated and compiled into dist/, so the
# install scripts (prisma generate) are skipped.
RUN npm ci -w apps/api --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/apps/api/dist apps/api/dist

WORKDIR /app/apps/api
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/health > /dev/null || exit 1
CMD ["node", "dist/main.js"]
