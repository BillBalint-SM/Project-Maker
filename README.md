# Project Maker

Project Maker is a web platform foundation built as a pnpm monorepo:

- `apps/web`: Angular 22.1 single-page application with licensed PrimeNG 22.0.0.
- `apps/api`: NestJS 11 API.
- `packages/contracts`: shared TypeScript contracts.
- PostgreSQL 18, the API, and Nginx run on an internal Compose network.

The web baseline uses PrimeNG 22.0.0 with the supplied PrimeUI license and the latest compatible Angular 22.1 toolchain. The license is configured at the web application bootstrap; do not print or expose the token in documentation or logs. Future major upgrades require a separate compatibility review.

Only Nginx publishes a host port. It serves the SPA and proxies `/api/*` to the internal API.

The platform-neutral product workflow, vocabulary, domain data intent, general intake playbook, and scoring rules are preserved in [`docs/product-domain.md`](docs/product-domain.md). The current foundation does not yet implement all of that product behavior.

The current runtime, migration, backup/restore, Microsoft 365 mail, VPN boundary, and
verification handoff is documented in [`docs/operations-handoff.md`](docs/operations-handoff.md).
Use the [release cutover checklist](docs/release-cutover.md) to separate the
internal application go-live from Customer-operated Microsoft 365 activation.

## Documentation

For day-to-day business use, start with the
[Hungarian end-user guide](docs/user-guide.md). The
[documentation index](docs/README.md) connects the remaining sources: the
[roadmap](docs/roadmap.md) is the current delivery-status record, the
[product domain](docs/product-domain.md) describes intended behavior, and the
[operations handoff](docs/operations-handoff.md) covers runtime responsibilities.

## Prerequisites

- Node.js `^22.22.3`, `^24.15.0`, or `>=26.0.0`
- pnpm `11.20.0`
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
| `CUSTOMER_MAILBOX_SYNC_POLL_INTERVAL_MS` | Customer mailbox delta poll interval in milliseconds; defaults to 60,000, and invalid values or values below 100 fall back to the default |
| `CUSTOMER_MAILBOX_NAME` / `CUSTOMER_MAILBOX_ADDRESS` | Dedicated Microsoft 365 sender identity; both values are sent in the Graph message `from`, and the address is also used for correlated Reply-To addresses |
| `GRAPH_TENANT_ID` / `GRAPH_CLIENT_ID` | Microsoft Graph application identity |
| `GRAPH_CLIENT_CERTIFICATE_THUMBPRINT` / `GRAPH_CLIENT_PRIVATE_KEY_BASE64` | Certificate credential; use the SHA-1 thumbprint as exactly 40 hexadecimal characters without separators, and inject the base64-encoded PEM private key as a deployment secret that is never committed or logged |
| `GRAPH_BASE_URL` | Graph API base URL; normally `https://graph.microsoft.com` |
| `GRAPH_LOGIN_BASE_URL` | Microsoft identity platform base URL; normally `https://login.microsoftonline.com` |

The API and database do not publish host ports. PostgreSQL data persists in the named `postgres-data` volume.
