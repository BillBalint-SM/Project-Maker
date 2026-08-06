# Project Maker

Project Maker is a web platform foundation built as a pnpm monorepo:

- `apps/web`: Angular 22 single-page application with PrimeNG.
- `apps/api`: NestJS 11 API.
- `packages/contracts`: shared TypeScript contracts.
- PostgreSQL 18, the API, and Nginx run on an internal Compose network.

Only Nginx publishes a host port. It serves the SPA and proxies `/api/*` to the internal API.

The platform-neutral product workflow, vocabulary, domain data intent, general intake playbook, and scoring rules are preserved in [`docs/product-domain.md`](docs/product-domain.md). The current foundation does not yet implement all of that product behavior.

The current runtime, migration, backup/restore, SMTP, VPN boundary, and
verification handoff is documented in [`docs/operations-handoff.md`](docs/operations-handoff.md).

## Prerequisites

- Node.js `^22.22.3`, `^24.15.0`, or `>=26.0.0`
- pnpm `11.9.0`
- Docker Desktop with the Linux engine for the container workflow

## Install and verify

```powershell
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` performs workspace type checks, API and web unit tests, and production builds. Browser E2E tests are separate because Playwright requires a locally installed browser. The foundation handoff uses the narrower typecheck/build/Compose smoke gates first; see [`docs/operations-handoff.md`](docs/operations-handoff.md).

```powershell
pnpm test:e2e
```

## Run with Docker Compose

Create a local environment file and replace the placeholder password in both `POSTGRES_PASSWORD` and `DATABASE_URL` with the same strong secret:

```powershell
Copy-Item .env.example .env
pnpm compose:config
pnpm compose:up
```

Open `http://localhost:8080`. The proxied API health endpoint is `http://localhost:8080/api/health`.

Stop the stack without deleting the named PostgreSQL volume:

```powershell
pnpm compose:down
```

To remove stored database data, explicitly remove the `project-maker_postgres-data` Docker volume after the stack is down. This is destructive and is intentionally not part of the normal scripts.

## Local development

Copy `.env.example` to `.env`, then run the applications in separate terminals:

```powershell
pnpm --filter @project-maker/api start:dev
pnpm --filter @project-maker/web start
```

The API requires `CORS_ORIGIN`; `@nestjs/config` reads it from the root `.env` when the API is started from the repository root. The value must be one exact HTTP(S) origin such as `http://localhost:8080`; wildcards, paths, credentials, query strings, fragments, and origin lists are rejected at startup.

## Configuration

`.env.example` documents every foundation variable. Never commit `.env` or real credentials. The example password is a placeholder and is not suitable for a deployed environment.

| Variable | Purpose |
| --- | --- |
| `POSTGRES_DB` | PostgreSQL database name |
| `POSTGRES_USER` | PostgreSQL application user |
| `POSTGRES_PASSWORD` | PostgreSQL application password |
| `DATABASE_URL` | Internal API-to-PostgreSQL connection URL |
| `WEB_PORT` | Host port published by Nginx |
| `CORS_ORIGIN` | Exact browser origin allowed by the API |
| `FOLLOW_UP_POLL_INTERVAL_MS` | Automatic follow-up poll interval (5,000–86,400,000 ms) |
| `SMTP_HOST` / `SMTP_FROM` | Together enable customer email delivery; blank disables email |
| `SMTP_PORT` | SMTP TCP/TLS port; `.env.example` uses `1025` for local capture |
| `SMTP_SECURE` | `false` plain TCP, `true` implicit TLS; STARTTLS is not implemented |
| `SMTP_USER` / `SMTP_PASSWORD` | Optional credentials; both are required together and require secure mode |

The API and database do not publish host ports. PostgreSQL data persists in the named `postgres-data` volume.

## Legacy desktop baseline

The replaced Tauri desktop MVP is preserved by Git tag `legacy-desktop-v0.1.2`. It is not part of this web platform runtime and no desktop data is imported automatically.
