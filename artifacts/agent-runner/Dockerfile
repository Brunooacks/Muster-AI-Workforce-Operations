FROM node:20-alpine

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/agent-runner/package.json artifacts/agent-runner/package.json
COPY lib/telemetry-reporter/package.json lib/telemetry-reporter/package.json

RUN pnpm install --frozen-lockfile --filter @workspace/agent-runner...

COPY artifacts/agent-runner artifacts/agent-runner
COPY lib/telemetry-reporter lib/telemetry-reporter

CMD ["pnpm", "--filter", "@workspace/agent-runner", "run", "start"]
