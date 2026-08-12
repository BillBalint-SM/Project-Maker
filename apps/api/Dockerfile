# syntax=docker/dockerfile:1

FROM node:26.4.0-alpine3.24 AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN npm install --global pnpm@11.20.0

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN pnpm install --frozen-lockfile

COPY packages/contracts packages/contracts
COPY apps/api apps/api

RUN pnpm --filter @project-maker/contracts build
RUN pnpm --filter @project-maker/api build

FROM node:26.4.0-alpine3.24 AS runtime

ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN npm install --global pnpm@11.20.0

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN pnpm install --filter @project-maker/api --prod --frozen-lockfile

COPY --from=build /workspace/apps/api/dist apps/api/dist
COPY --from=build /workspace/apps/api/scripts/start.mjs apps/api/scripts/start.mjs
COPY --from=build /workspace/packages/contracts/dist packages/contracts/dist
COPY --from=build /workspace/packages/contracts/playbooks packages/contracts/playbooks

WORKDIR /workspace/apps/api

USER node

EXPOSE 3000

CMD ["node", "scripts/start.mjs"]
