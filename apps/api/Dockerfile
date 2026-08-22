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
RUN pnpm --filter @project-maker/api deploy --legacy --prod /runtime
RUN mkdir -p /runtime/packages/contracts \
  && cp -R packages/contracts/dist packages/contracts/playbooks packages/contracts/package.json /runtime/packages/contracts/

FROM node:26.4.0-alpine3.24 AS runtime

ENV NODE_ENV=production

WORKDIR /workspace

COPY --from=build /runtime ./

USER node

EXPOSE 3000

CMD ["node", "scripts/start.mjs"]
