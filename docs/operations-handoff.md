# Project Maker operations handoff

This document describes the current web-platform foundation as it exists in
the repository. It is an operator/developer handoff, not a claim that every
product capability in `docs/product-domain.md` is complete.

## Runtime boundary

The runtime is a Docker Compose stack:

| Service | Role | Network exposure |
| --- | --- | --- |
| `web` | Angular 21.2 + PrimeNG 21.1.9 static application served by Nginx; proxies `/api/*` | Publishes `WEB_PORT` (default `8080`) |
| `api` | NestJS 11 API, TypeORM migrations, SMTP worker/timer | Internal only; port `3000` is exposed to the Compose network |
| `postgres` | PostgreSQL 18.4 Alpine data store | Internal only; no host port |

`project-maker-edge` is the browser-facing network and
`project-maker-internal` is marked internal. The application currently has no
authentication or VPN-awareness. The target deployment boundary is therefore
the customer’s internal network/VPN or an equivalent firewall/reverse-proxy
policy. A deployment team must place the published Nginx endpoint behind that
boundary before using real project data; the application itself does not prove
that a request came through a VPN.

## Start and stop the stack

From the repository root:

```powershell
Copy-Item .env.example .env
# Edit .env: replace the placeholder in POSTGRES_PASSWORD and DATABASE_URL.
pnpm compose:config
pnpm compose:up
```

The browser entry point is `http://localhost:8080` when `WEB_PORT=8080`.
The proxied health endpoint is `http://localhost:8080/api/health`.

Stop the services while retaining PostgreSQL data:

```powershell
pnpm compose:down
```

The named `postgres-data` volume is retained by the normal shutdown command.
Removing it is destructive and must be an explicit operator action.

## Environment contract

All runtime values are supplied through the selected Compose environment file;
do not commit `.env` or real credentials.

| Variable | Required | Current meaning |
| --- | --- | --- |
| `POSTGRES_DB` | yes | Database name used by the PostgreSQL container. |
| `POSTGRES_USER` | yes | Application database user. |
| `POSTGRES_PASSWORD` | yes | Database password. Keep it identical to the password in `DATABASE_URL`. |
| `DATABASE_URL` | yes | API connection URL using the Compose service name `postgres`. |
| `WEB_PORT` | yes | Host port mapped to Nginx port `8080`. |
| `CORS_ORIGIN` | yes | One exact browser origin, for example `http://localhost:8080`; paths, wildcards, credentials, and origin lists are rejected. |
| `FOLLOW_UP_POLL_INTERVAL_MS` | no | Automatic follow-up poll interval. Valid range is 5,000–86,400,000 ms; default is 60,000. |
| `SMTP_HOST` | no | SMTP host. Together with `SMTP_FROM`, this enables delivery. Blank means email delivery is unavailable. |
| `SMTP_PORT` | no | TCP/TLS port; the API default is `587`. `.env.example` uses `1025` for local SMTP-capture setups. |
| `SMTP_SECURE` | no | `false` uses plain TCP; `true` uses implicit TLS. |
| `SMTP_USER` / `SMTP_PASSWORD` | no | Optional credentials. They must be supplied together and require `SMTP_SECURE=true`. |
| `SMTP_FROM` | no | Sender address. Required with `SMTP_HOST` to configure the mailer. |

The current dependency-free mailer supports plain SMTP and implicit TLS only;
STARTTLS negotiation is not implemented. The default Compose port of `587`
must not be interpreted as STARTTLS support. Add a Nodemailer/STARTTLS mode as
a separate hardening slice before connecting to an SMTP provider that requires
STARTTLS.

When SMTP is not configured, the API returns `503` for an email send and does
not allow automatic follow-up to be enabled. This is intentional: it prevents
an apparently enabled timer from silently doing nothing.

## Database migrations and recovery

The API uses `synchronize: false`; schema changes are applied only by the
ordered TypeORM migrations registered in
`apps/api/src/database/migration-data-source.ts`:

1. `0001-core.ts` — projects, audit events, and core enums.
2. `0002-questions-rounds.ts` — base questions, project schemas, immutable interview snapshots.
3. `0003-markdown-revisions.ts` — versioned Markdown revisions and immutability guard.
4. `0004-customer-follow-ups.ts` — follow-up state, delivery status, and scheduling fields.

The deployed API image contains the compiled migration classes, but not the
TypeScript migration source tree used by the development-only
`typeorm-ts-node-commonjs` scripts. The Compose PostgreSQL service also has no
host port, and the migration DataSource reads `DATABASE_URL` from the process
environment rather than from the selected `.env` file. Therefore the
host-side `pnpm --filter @project-maker/api migration:*` commands are not the
supported procedure for this stack.

The API entrypoint runs `runMigrations()` before Nest starts. Applying pending
migrations is consequently a deployment/restart operation, and runs inside
the Compose network:

```powershell
# Rebuild when the image contains a new migration, then apply it before the API
# becomes healthy. This also starts postgres when the stack is stopped.
docker compose --env-file .env up --build --wait api

# If the current API image already contains the migration, a restart reruns the
# same startup migration gate without rebuilding.
docker compose --env-file .env restart api
```

To inspect the migration state from the running API container, use the compiled
DataSource and the in-network `DATABASE_URL`:

```powershell
$migrationStatusScript = @'
const source = require('./dist/database/migration-data-source.js').default;
(async () => {
  await source.initialize();
  try {
    const applied = await source.query(
      'SELECT "timestamp", "name" FROM "migrations" ORDER BY "timestamp"',
    );
    const pending = await source.showMigrations();
    console.log(JSON.stringify({ applied, pending }, null, 2));
  } finally {
    await source.destroy();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
'@
docker compose --env-file .env exec -T api node -e $migrationStatusScript
```

`pending: false` means that all migration classes in the running image are
recorded in the database. The `applied` array is the database's migration
history; the four expected names are listed above.

There is no safe arbitrary migration selector in the runtime image. A
controlled revert can undo only the latest applied migration through a
one-off API container, and it must be preceded by a backup and a write
maintenance window:

```powershell
docker compose --env-file .env stop web api
docker compose --env-file .env run --rm --no-deps api node -e "const source=require('./dist/database/migration-data-source.js').default;(async()=>{await source.initialize();try{await source.undoLastMigration();}finally{await source.destroy();}})().catch((error)=>{console.error(error);process.exitCode=1;});"
docker compose --env-file .env up --build --wait
```

Each `down` implementation drops the objects owned by that migration (and
therefore its data); for example, reverting `0004` drops follow-up state and
reverting `0003` drops all Markdown revisions. Starting the same API image
again will automatically run the reverted migration forward, so this is a
recovery/inspection operation, not a supported permanent application
downgrade. A permanent downgrade requires a separately built, compatibility-
reviewed image and a restore plan owned by the deployment team.

### PostgreSQL backup

The commands below require PowerShell 7.4+ because they use
`Get-Content -AsByteStream`.

Create a local `backups` directory and stream a custom-format dump from the
running container. The dump remains on the host and is not committed:

```powershell
New-Item -ItemType Directory -Force .\backups | Out-Null
$stamp = Get-Date -Format yyyyMMdd-HHmmss
docker compose --env-file .env exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > ".\backups\project-maker-$stamp.dump"
```

### Controlled restore

Restore into a stopped-write/maintenance window. `--clean --if-exists` drops
objects before recreating them, so verify the dump path and target environment
before running this command:

```powershell
Get-Content .\backups\project-maker-YYYYMMDD-HHMMSS.dump -AsByteStream |
  docker compose --env-file .env exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore --clean --if-exists --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Run the in-container migration status command above after a restore and
perform the health/smoke gates before allowing normal users back in.

## Functional handoff

### Project and interview flow

- `/` lists projects; `/projects/:projectId` is the project cockpit.
- `/settings/questions` maintains the editable base question bank.
- `/projects/:projectId/interview` publishes a project question-schema snapshot,
  creates immutable interview rounds, records answers, and completes rounds.
- A completed round keeps the question text/order/schema version that existed
  when the round started; later question-bank edits do not rewrite that round.

### Markdown execution-plan revisions

The cockpit’s **Markdown** page (`/projects/:projectId/markdown`) supports a
manual **Create .md** action and a `MANUAL` or `MILESTONE` reason. Each stored
revision contains:

- a monotonically increasing project-local version;
- creation reason, optional milestone, and creation time;
- a source-data snapshot (project, schema, and interview rounds);
- a change summary against the previous revision;
- the complete Markdown content;
- a link to the previous revision when one exists.

The download endpoint returns the exact stored content as a Markdown
attachment:

```text
GET /api/projects/{projectId}/markdown-revisions/{revisionId}/download
```

Entering the selected `READY_FOR_PLANNING` project milestone automatically
creates a `MILESTONE` revision in the same database transaction as the
workspace status update. Saving the project while it is already at that status
does not create a duplicate; leaving and entering the milestone again creates
the next version. The manual button remains available for any other snapshot.

The project cockpit also shows a bounded, paginated audit history with event
type, timestamp, and payload. Audit loading is independent from the core
cockpit load and has its own retry state.

### Customer review and follow-up email semantics

These are intentionally separate flows:

- **Customer review:** always manually initiated by the PO/PM. It requires a
  Markdown revision (the latest one is selected when no revision ID is sent),
  sends the full execution plan to the project contact email, and records a
  success/failure audit event.
- **Follow-up ping:** can be sent manually from the cockpit or automatically by
  the due-state timer. It includes the latest available Markdown revision when
  one exists, records `lastPingAt`, `nextPingAt`, `lastDeliveryStatus`, and a
  non-sensitive error code, and can be disabled or given an expiry time.

Relevant API routes:

```text
GET   /api/projects/{projectId}/follow-up
PATCH /api/projects/{projectId}/follow-up
POST  /api/projects/{projectId}/follow-up/ping
POST  /api/projects/{projectId}/customer-review-email
```

Archived projects cannot send customer email. Expired or archived follow-up
states are disabled and unscheduled by the worker.

## Verification gates for this handoff

The fast, repeatable gates used during this foundation slice are:

```powershell
pnpm --filter @project-maker/contracts typecheck
pnpm --filter @project-maker/api typecheck
pnpm --filter @project-maker/web typecheck
pnpm --filter @project-maker/web build
pnpm compose:config
pnpm compose:up
```

The Compose smoke gate should confirm `/api/health`, base-question seeding,
all four migrations, Markdown download headers/content, and the expected
`503` response when SMTP is intentionally disabled. A local SMTP-capture
container can be used to verify manual review, manual ping, and due-timer
delivery without using production credentials.

The repository-wide `pnpm verify` script also runs unit tests and production
builds. Broader test execution is deliberately deferred until the foundation
is feature-complete; a passing typecheck/build/Compose smoke is not a claim
that the complete product is finished.

## Known next slices

The following are deliberately not hidden in this handoff:

- authentication, authorization, and request rate limiting before exposure
  beyond the internal/VPN boundary;
- an outbox/idempotency model so SMTP I/O is not coupled to a database
  transaction;
- STARTTLS support and provider-specific SMTP compatibility;
- complete intake/checklist/readiness/decision-score behavior from the domain
  contract;
- backup retention/rotation and a restore drill owned by the deployment team.
