# Project Maker

Project Maker is an internal product-discovery and project-preparation application for Product Owners, Project Managers, Business Analysts, and discovery teams. It turns structured intake work into traceable follow-ups, readiness and decision support, a versioned Project Specification, and delivery-ready exports.

The pnpm monorepo contains:

- `apps/web`: Angular 22.1 single-page application with PrimeNG 22.0.0;
- `apps/api`: NestJS 11 API with TypeORM;
- `packages/contracts`: shared TypeScript contracts and versioned playbook data;
- PostgreSQL 18, the API, and Nginx in a Docker Compose deployment.

Only Nginx publishes a host port. It serves the web application and proxies `/api/*` plus the bearer-authenticated `/mcp` endpoint to the internal API. The intended deployment is reachable through the Operator organization's VPN. Internal users authenticate with self-managed local email-and-password accounts; all Internal users share the same application capability level, with no roles, memberships, or per-Project permissions. Public Customer responses use narrowly scoped capability links at `/respond` and do not create Customer accounts.

Review framework and component compatibility before a major Angular or PrimeNG upgrade.

## Documentation

- [End-user guide](docs/user-guide.md): current business workflows, states, recovery paths, and limitations.
- [Visual maps](docs/visual-maps.md): explorable workflow, lifecycle, communication, dataflow, and runtime architecture views.
- [Documentation index](docs/README.md): all maintained product, engineering, and operational references.
- [Roadmap](docs/roadmap.md): current delivery-status catalogue and remaining work.
- [Product domain](docs/product-domain.md): platform-neutral vocabulary and behavior.
- [Configuration reference](docs/configuration.md): authoritative environment-variable definitions and constraints.
- [Operations handoff](docs/operations-handoff.md): deployment, migrations, recovery, mail, and verification.
- [Release cutover](docs/release-cutover.md): independent application and mail-gateway activation gates.

## Prerequisites

- Node.js `^22.22.3`, `^24.15.0`, or `>=26.0.0`
- pnpm `11.20.0`
- Docker Desktop with the Linux engine for the container workflow

## Install and verify

```powershell
pnpm install --frozen-lockfile
pnpm verify
```

The repository pins pnpm `11.20.0`. If the workstation exposes another global version, use `npx --yes pnpm@11.20.0 <command>` instead of changing the repository requirement.

`pnpm verify` runs workspace type checks, API and web tests, and production builds. It expects a dedicated non-production PostgreSQL test database. Run browser E2E only when the affected behavior crosses routes, persistence, or reload boundaries:

```powershell
pnpm test:e2e
```

The isolated synthetic SMTP/IMAP suite provisions and removes its own test database:

```powershell
pnpm test:mail-gateway
```

The production API image and fresh `0001 -> 0036` migration path share one local/CI smoke command:

```powershell
node scripts/run-container-smoke.mjs
```

Keep validation proportional to the change. Validate the directly affected behavior and its most important risks; do not turn unrelated suites into release gates.

## Run with Docker Compose

Create a local environment file and replace every placeholder. `POSTGRES_PASSWORD` and the password embedded in `DATABASE_URL` must match.

```powershell
Copy-Item .env.example .env
pnpm compose:config
pnpm compose:up
```

Open `http://localhost:8080`. The proxied health endpoint is `http://localhost:8080/api/health`.

After signing in, an Internal user can create a personal Project Maker MCP token on `Account settings`. The page provides the one-time `claude mcp add` command that connects the user's existing Claude Code subscription to `http://localhost:8080/mcp`. Project Maker does not require a Claude API key and does not call a model provider.

Stop the stack without removing the named PostgreSQL volume:

```powershell
pnpm compose:down
```

Removing the `project-maker_postgres-data` Docker volume permanently deletes stored application data and is intentionally not part of the normal scripts.

## Local development

Copy `.env.example` to `.env`, then run the applications in separate terminals:

```powershell
pnpm --filter @project-maker/api start:dev
pnpm --filter @project-maker/web start
```

The API reads the root `.env` when started from the repository root. `CORS_ORIGIN` must be one exact HTTP(S) origin; wildcards, paths, credentials, query strings, fragments, and origin lists are rejected at startup.

See [Configuration](docs/configuration.md) for every supported variable, default, constraint, and fail-closed behavior. Never commit `.env`, credentials, access tokens, database dumps, or Customer data.
