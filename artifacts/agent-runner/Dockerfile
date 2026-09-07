FROM node:20-alpine AS runner-base

RUN apk add --no-cache git \
    && corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/agent-runner/package.json artifacts/agent-runner/package.json
COPY lib/telemetry-reporter/package.json lib/telemetry-reporter/package.json

RUN pnpm install --frozen-lockfile --filter @workspace/agent-runner...

COPY artifacts/agent-runner artifacts/agent-runner
COPY lib/telemetry-reporter lib/telemetry-reporter

ENV MUSTER_WORKSPACE=/workspace
VOLUME ["/workspace"]

CMD ["pnpm", "--dir", "/app", "--filter", "@workspace/agent-runner", "run", "start"]

FROM runner-base AS runner-docker

RUN apk add --no-cache docker-cli docker-cli-compose

FROM runner-base AS runner
