# Project Maker

Project Maker is a web platform foundation built as a pnpm monorepo:

- `apps/web`: Angular 22.1 single-page application with licensed PrimeNG 22.0.0.
- `apps/api`: NestJS 11 API.
- `packages/contracts`: shared TypeScript contracts.
- PostgreSQL 18, the API, and Nginx run on an internal Compose network.

The web baseline uses PrimeNG 22.0.0 with the supplied PrimeUI license and the latest compatible Angular 22.1 toolchain. The license is configured at the web application bootstrap; do not print or expose the token in documentation or logs. Future major upgrades require a separate compatibility review.

Only Nginx publishes a host port. It serves the SPA and proxies `/api/*` and the bearer-authenticated `/mcp` endpoint to the internal API.

The platform-neutral product workflow, vocabulary, domain data intent, general intake playbook, and scoring rules are preserved in [`docs/product-domain.md`](docs/product-domain.md). The current foundation does not yet implement all of that product behavior.

The current runtime, migration, backup/restore, TLS SMTP/IMAP mail gateway, VPN boundary, and
verification handoff is documented in [`docs/operations-handoff.md`](docs/operations-handoff.md).
Use the [release cutover checklist](docs/release-cutover.md) to separate the
internal application go-live from Operator organization-operated mail-gateway
activation.

## Documentation

For day-to-day business use, start with the
[end-user guide](docs/user-guide.md). The
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

These commands assume the pinned pnpm `11.20.0`. If the workstation exposes a
different global version, use `npx --yes pnpm@11.20.0 <command>` instead of
changing the repository requirement.

`pnpm verify` performs workspace type checks, API and web tests, and production
builds. It expects a dedicated non-production PostgreSQL test database. Browser
E2E tests are separate because Playwright requires a locally installed browser;
run the complete suite only when broad cross-route UI behavior changed.

```powershell
pnpm test:e2e
```

To test the complete TLS SMTP/IMAP path without external credentials, run the
isolated synthetic-gateway suite. It provisions and removes its own local test
database; see [`docs/mail-gateway.md`](docs/mail-gateway.md#local-synthetic-gateway-suite).

```powershell
pnpm test:mail-gateway
```

The production API image and fresh `0001 -> 0036` migration path have one
isolated local/CI smoke command:

```powershell
node scripts/run-container-smoke.mjs
```

The exact pre-main gate mapping and database safety notes are in
[`docs/operations-handoff.md`](docs/operations-handoff.md#verification-gates-for-this-handoff).

## Run with Docker Compose

Create a local environment file and replace the placeholder password in both `POSTGRES_PASSWORD` and `DATABASE_URL` with the same strong secret:

```powershell
Copy-Item .env.example .env
pnpm compose:config
pnpm compose:up
```

Open `http://localhost:8080`. The proxied API health endpoint is `http://localhost:8080/api/health`.

After signing in, each Internal user can create their own Project Maker MCP
token on the `Account settings` page. The page shows the one-time `claude mcp
add` command for connecting that user's existing Claude Code subscription to
`http://localhost:8080/mcp`. Project Maker does not need or accept a Claude API
key and does not call a model provider.

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

The mailbox checkpoint is an internal, strict versioned state value rather than
a credential; it needs no separately configured secret. Invalid or old values
safely establish a new mailbox baseline.

| Variable | Purpose |
| --- | --- |
| `POSTGRES_DB` | PostgreSQL database name |
| `POSTGRES_USER` | PostgreSQL application user |
| `POSTGRES_PASSWORD` | PostgreSQL application password |
| `DATABASE_URL` | Internal API-to-PostgreSQL connection URL |
| `WEB_PORT` | Host port published by Nginx |
| `CORS_ORIGIN` | Exact browser origin allowed by the API |
| `FOLLOW_UP_POLL_INTERVAL_MS` | Automatic follow-up poll interval (5,000–86,400,000 ms) |
| `ATTACHMENT_MAX_MIB` | Attachment limit in MiB; defaults to 50 and may only reduce that maximum |
| `CORRESPONDENCE_MAILBOX_POLL_INTERVAL_MS` | Correspondence mailbox poll interval in milliseconds; defaults to 60,000, and invalid values or values below 100 fall back to the default |
| `CORRESPONDENCE_MAILBOX_NAME` / `CORRESPONDENCE_MAILBOX_ADDRESS` | Operator organization-controlled dedicated sender identity; Reply-To correlation uses the configured address and generated plus-addresses |
| `MAIL_GATEWAY_SMTP_*` | TLS SMTP host, port, security mode, and dedicated credential |
| `MAIL_GATEWAY_IMAP_*` | TLS IMAP host, port, security mode, folder, and separate credential |
| `MAIL_GATEWAY_TLS_CA_CERTIFICATE_BASE64` | Optional private-CA PEM, base64 encoded; leave empty for public trust roots |

Existing environment files must rename their former ambiguous mailbox keys to
the canonical `CORRESPONDENCE_MAILBOX_*` keys before the next deployment. The
legacy names are intentionally not read because they assign ambiguous ownership
to infrastructure controlled by the Operator organization.

The API and database do not publish host ports. PostgreSQL data persists in the named `postgres-data` volume.
