# ============================================================================
# Muster Workforce OS — unified production image
# ============================================================================
# Builds the Express API and the Vite SPA, then serves both from one Node 24
# runtime. Clerk protects API routes; the SPA handles public and protected UI.
#
# Build:  docker build --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_... -t muster .
# Run:    docker run -p 8080:8080 --env-file .env.production muster
#
# Set MIGRATE_ON_START=true only when the deployment topology guarantees a
# single migration runner during rollout. The release Compose does this.
# ============================================================================

# ---- Stage 1: build -------------------------------------------------------
FROM node:24-slim AS builder

ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}

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

# Produce the SPA with the public Clerk key embedded by Vite.
RUN test -n "$VITE_CLERK_PUBLISHABLE_KEY"
RUN pnpm --filter @workspace/muster run build

# ---- Stage 2: runtime -----------------------------------------------------
FROM node:24-slim AS runner

ARG GIT_SHA
ENV NODE_ENV=production
# The deployment workflow supplies the immutable source revision. Keep it in
# the runtime image so health/version reporting can identify the release.
ENV GIT_SHA=${GIT_SHA}
# PORT is required by the server; override at run time as needed.
ENV PORT=8080
ENV WEB_STATIC_DIR=/app/public
ENV DB_MIGRATIONS_DIR=/app/migrations

WORKDIR /app

# Only the built bundle (+ its linked sourcemaps and pino transport workers)
# is needed at runtime — the bundle has no external runtime dependencies.
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=builder /app/artifacts/cohort/dist/public ./public

# Ship SQL migrations for the explicit startup/release migration step.
COPY --from=builder /app/lib/db/drizzle ./migrations

# Run as the built-in non-root user.
USER node

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8080/api/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
