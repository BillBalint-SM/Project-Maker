# syntax=docker/dockerfile:1

FROM node:24.19.0-alpine3.24 AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN pnpm install --frozen-lockfile

COPY packages/contracts packages/contracts
RUN pnpm --filter @project-maker/contracts build

COPY apps/web apps/web

RUN pnpm --filter @project-maker/web build

FROM nginx:1.30.4-alpine3.24 AS runtime

COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist/web/browser /usr/share/nginx/html

EXPOSE 8080
