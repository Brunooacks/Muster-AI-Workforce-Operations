# ============================================================================
# Cohort API server — production image
# ============================================================================
# Builds the Express API (artifacts/api-server) into a single self-contained
# esbuild bundle (dist/index.mjs) and runs it on a slim Node 24 runtime.
#
# The web frontend (artifacts/cohort) is a static Vite build and is deployed
# separately (Vercel/Netlify/any static host). This image serves the API only.
#
# Build:  docker build -t cohort-api .
# Run:    docker run -p 8080:8080 --env-file .env cohort-api
#
# DB migrations are NOT run by this image. Run them as a release/pre-deploy
# step against DATABASE_URL:  pnpm --filter @workspace/db run migrate
# ============================================================================

# ---- Stage 1: build -------------------------------------------------------
FROM node:24-slim AS builder

# pnpm via corepack (pinned to match the lockfile toolchain)
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy the whole workspace. esbuild bundles the api-server together with the
# in-repo @workspace/* packages (they export TypeScript directly), so the
# builder needs the full source tree, not just api-server.
COPY . .

# Install all workspace deps (dev deps included — esbuild/tsc live there).
RUN pnpm install --frozen-lockfile

# Produce the self-contained bundle at artifacts/api-server/dist/index.mjs
RUN pnpm --filter @workspace/api-server run build

# ---- Stage 2: runtime -----------------------------------------------------
FROM node:24-slim AS runner

ENV NODE_ENV=production
# PORT is required by the server; override at run time as needed.
ENV PORT=8080

WORKDIR /app

# Only the built bundle (+ its linked sourcemaps and pino transport workers)
# is needed at runtime — the bundle has no external runtime dependencies.
COPY --from=builder /app/artifacts/api-server/dist ./dist

# Ship the SQL migrations so an operator can run them from a one-off container
# if desired (they are otherwise applied via the release-phase migrate command).
COPY --from=builder /app/lib/db/drizzle ./migrations

# Run as the built-in non-root user.
USER node

EXPOSE 8080

CMD ["node", "--enable-source-maps", "dist/index.mjs"]
