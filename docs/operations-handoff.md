# Project Maker operations handoff

This document describes the current web-platform foundation as it exists in
the repository. It is an operator/developer handoff, not a claim that every
product capability in `docs/product-domain.md` is complete.

## Runtime boundary

The runtime is a Docker Compose stack:

| Service | Role | Network exposure |
| --- | --- | --- |
| `web` | Angular 22.1 + licensed PrimeNG 22.0.0 static application served by Nginx; proxies `/api/*` | Publishes `WEB_PORT` (default `8080`) |
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
5. `0005-initial-intake-open-round.ts` — partial unique index for at most one open `INITIAL_INTAKE` round per project; it fails fast when existing data contains duplicates.
6. `0006-discovery-follow-ups.ts` — project-owned discovery follow-ups, a category enum, date-order index, update trigger, and retained-project foreign key.
7. `0007-discovery-follow-up-resolution.ts` — nullable persisted discovery-follow-up answer/decision content.
8. `0008-discovery-follow-up-edit-version.ts` — positive persisted discovery-follow-up version for conflict-safe open-item edits.
9. `0009-round-question-assessment-overrides.ts` — effective `Részben megvan` and justified `Nem releváns` assessment overrides, completion/immutability guards, and their database invariants.
10. `0010-round-answer-validation-parity.ts` — database validation parity for `TEXT` and `LONG_TEXT` answers by rejecting values made only from space, tab, line feed, carriage return, form feed, or vertical tab, matching the API rule.
11. `0011-discovery-follow-up-source-linkage.ts` — nullable discovery-follow-up source snapshot, restrictive foreign key, and source lookup index.

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
history; the eleven expected names are listed above.

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
therefore its data); for example, reverting `0006` drops discovery follow-ups,
reverting `0004` drops customer email follow-up state, and reverting `0003`
drops all Markdown revisions. Starting the same API image
again will automatically run the reverted migration forward, so this is a
recovery/inspection operation, not a supported permanent application
downgrade. A permanent downgrade requires a separately built, compatibility-
reviewed image and a restore plan owned by the deployment team.

Reverting `0005` removes only its partial unique index; it does not remove
interview-round rows. Reverting `0007` drops the persisted discovery-follow-up
answer/decision column and its content. Reverting `0008` drops its positive-version
constraint and version column; it removes only edit-concurrency metadata, not a
business follow-up field. `0009` is guarded: its rollback first takes an exclusive
lock and refuses before DDL if any assessment-override row exists. Do not remove
those rows to make a rollback pass without an approved data operation and backup.
Reverting `0010` redefines only the round-answer validation function with its
previous space-only `btrim` predicate. It leaves schema objects and stored answers
in place, but database validation then permits control-whitespace-only text that
the forward migration rejects.
Reverting `0011` drops only its index, restrictive foreign key, and nullable
source column, in that order; it removes the source relationship but not the
discovery follow-up itself or any immutable snapshot.
Before any revert, inspect the migration and choose the rollback procedure
appropriate to the affected objects.

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
- The cockpit can archive and restore a project. It exposes permanent deletion
  only for an eligible bare `DRAFT`; a project with persisted activity is
  retained and must be archived.

### Discovery follow-up semantics

Discovery follow-ups are project-owned work items, not customer email schedules.
The cockpit lists them in deterministic due-date order and can create one with a
closed category, question, owner, date-only due date, and next step. The API
assigns the canonical initial status `Nyitott` and writes one creation audit event
with only `followUpId`, category, due date, and status; question, owner, and
next-step text are not copied into the audit payload.

Creation may optionally attach one snapshot from the project's current Initial
Intake source: the latest open round, or the latest completed round when none is
open. Open follow-ups can add, replace, or explicitly remove that relationship;
resolved follow-ups retain it as historical provenance. The source command uses
the same lock and version discipline as other follow-up mutations. A real source
change emits a redacted audit event with only the action and compact order/topic/
control-point reference, never a source snapshot identifier, full source
question, answer, rationale, owner, or next-step text.

```text
GET  /api/projects/{projectId}/discovery-follow-ups
POST /api/projects/{projectId}/discovery-follow-ups
GET  /api/projects/{projectId}/discovery-follow-ups/source-options
PATCH /api/projects/{projectId}/discovery-follow-ups/{followUpId}
PUT  /api/projects/{projectId}/discovery-follow-ups/{followUpId}/source-link
POST /api/projects/{projectId}/discovery-follow-ups/{followUpId}/resolve
```

An empty `GET` does not create a row. Archived projects remain readable but
creation, editing, and resolution return `409`; restoring the project re-enables
eligible open-item actions. `PATCH` accepts the complete five-field editable
state (`category`, `question`, `owner`, `dueDate`, and `nextStep`) plus a positive
`expectedVersion`. The server compares that version while the follow-up is locked:
a stale version, archived project, or non-open record returns `409` without
overwriting the record. An equivalent normalized request returns the existing row
without a write, version increment, or update audit event. A real update advances
the version and writes one `DISCOVERY_FOLLOW_UP_UPDATED` audit payload with exactly
`followUpId` and ordered `changedFields`; it contains field names only, never field
values, answers, versions, or user data.

The explicit resolution command returns `200`, accepts only canonical terminal
statuses, and requires a persisted nonblank answer/decision. It rejects an
already-resolved work item. Its `DISCOVERY_FOLLOW_UP_RESOLVED` audit payload has
only `followUpId` and `status`, so the answer/decision and other free text are
not copied into audit history. A persisted discovery follow-up is retained
project activity, so a `DRAFT` project with one cannot be permanently deleted
and the database foreign key also restricts a late deletion race.

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

The follow-up state in this section is an email-delivery schedule. It is not the
delivered `INTAKE-04` discovery-follow-up work-item management slice, including
its optional source linkage.

Relevant API routes:

```text
GET   /api/projects/{projectId}/follow-up
PATCH /api/projects/{projectId}/follow-up
POST  /api/projects/{projectId}/follow-up/ping
POST  /api/projects/{projectId}/customer-review-email
```

Archived projects cannot send customer email. Expired or archived follow-up
states are disabled and unscheduled by the worker.

### SCORE-01.1 readiness operational surface

The delivered readiness route is narrow and read-only:

```text
GET /api/projects/{projectId}/readiness
```

It selects the latest open `INITIAL_INTAKE` round; if none is open, it selects
the latest completed one. The result is available only for the exact current
30-key canonical `general` v1 source. Otherwise it returns a typed unavailable
state: `NO_INITIAL_INTAKE` or `UNSUPPORTED_SCHEMA`. An unavailable result is not
a score and does not disable Workspace or discovery-follow-up operations.

The only assessment mutation routes are scoped to one project, round, and
snapshot:

```text
PUT    /api/projects/{projectId}/rounds/{roundId}/answers/{snapshotId}/assessment
DELETE /api/projects/{projectId}/rounds/{roundId}/answers/{snapshotId}/assessment
```

`PUT` persists only the supported effective assessment decision; `DELETE`
returns the answer-derived automatic state. Completed rounds reject both
mutations. Operators should treat a guarded `0009` rollback as a data-change
decision, not as an API recovery action.

Readiness responses and Cockpit gaps intentionally omit source answers,
assessment rationales, contact values, owner values, follow-up content,
decisions, and next-step values. Assessment audit events contain only the
round/snapshot identifiers and canonical status, or identifiers for a reset;
they do not contain answers or rationales. Preserve this redaction boundary in
diagnostics and support material.

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
all ten migrations, Markdown download headers/content, and the expected
`503` response when SMTP is intentionally disabled. A local SMTP-capture
container can be used to verify manual review, manual ping, and due-timer
delivery without using production credentials.

The declared SCORE-01.1 browser evidence is:

```powershell
pnpm --dir apps/web exec playwright test readiness-review.spec.ts
pnpm test:e2e
```

Both were run against fresh disposable loopback PostgreSQL fixtures: the
focused readiness gate passed 3/3 tests and the full web E2E gate passed 22/22
tests. The test bootstrap resets its database before migrations; use only a
uniquely named disposable loopback test database, do not point it at a shared
or production database, and remove the container and temporary helper after
the run. Do not print a database URL, credentials, or synthetic fixture values
in retained logs.

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
- SCORE-01.2 Decision Score and recommendation behavior from the domain
  contract, plus OUTPUT-01 through OUTPUT-03 generated outputs;
- backup retention/rotation and a restore drill owned by the deployment team.
