# Project Maker operations handoff

This document describes the current web-platform foundation as it exists in
the repository. It is an operator/developer handoff, not a claim that every
product capability in `docs/product-domain.md` is complete.

## Runtime boundary

The runtime is a Docker Compose stack:

| Service | Role | Network exposure |
| --- | --- | --- |
| `web` | Angular 22.1 + licensed PrimeNG 22.0.0 static application served by Nginx; proxies `/api/*` | Publishes `WEB_PORT` (default `8080`) |
| `api` | NestJS 11 API, TypeORM migrations, Microsoft Graph mail boundary and follow-up timer | Internal only; port `3000` is exposed to the Compose network |
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
| `CUSTOMER_MAILBOX_NAME` / `CUSTOMER_MAILBOX_ADDRESS` | yes | Dedicated Microsoft 365 mailbox. Reply correlation uses high-entropy plus-addresses at this mailbox. |
| `GRAPH_TENANT_ID` / `GRAPH_CLIENT_ID` | yes | Microsoft Graph application identity. |
| `GRAPH_CLIENT_CERTIFICATE_THUMBPRINT` / `GRAPH_CLIENT_PRIVATE_KEY_BASE64` | yes | Certificate credential registered for the application. Supply the SHA-1 thumbprint as exactly 40 hexadecimal characters without separators. Inject the base64-encoded PEM private key only through deployment secrets; never commit or log it. |
| `GRAPH_BASE_URL` | no | Graph API base URL; defaults to `https://graph.microsoft.com`. |
| `GRAPH_LOGIN_BASE_URL` | no | Microsoft identity platform base URL; defaults to `https://login.microsoftonline.com`. |

Customer handoffs use Microsoft Graph with no SMTP fallback. A Graph rejection
or bounded configuration/authentication failure retains the immutable outbound
communication, correspondence identity, and append-only attempt result. A retry
uses the same Reply-To identity; a new logical version creates a successor
correspondence. `ACCEPTED` means only that the mail system accepted submission.

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
12. `0012-decision-review-inputs.ts` — validated nullable Decision input ratings with guarded rollback when project input exists.
13. `0013-markdown-template-library.ts` — named Markdown template drafts and immutable published versions, Default template seed, remembered project choice, and immutable revision provenance; rollback refuses retained template activity.
14. `0014-interview-customer-handoff.ts` — named internal ownership, concrete next-action owner role, `OPEN`/`ENDED` interview meeting semantics, content versions, immutable sent customer-handoff versions, editable draft gating, and guarded rollback while handoff history exists.
15. `0015-customer-follow-up-ping-draft.ts` — one optimistic customer-ping draft per project, same-project Discovery reference integrity, bounded preview state, durable delivery attempts, and guarded rollback while new ping activity is retained.

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
Migration `0012` is guarded: its rollback refuses before DDL if any Decision
input rating is persisted. Do not clear ratings merely to make a rollback pass
without an approved data operation and backup.
Migration `0015` locks the affected tables and refuses rollback before DDL when
a non-empty ping draft, Discovery reference, advanced draft version, preview,
or delivery attempt is retained. Existing empty schedule rows can roll back
without fabricating message content.
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
  creates an interview meeting, records answers, ends the meeting, and manages
  the versioned customer-handoff history.
- An ended round keeps the question text/order/schema version that existed when
  it started; later question-bank edits do not rewrite that snapshot. Business
  completeness does not block meeting end.
- Project creation requires a named internal owner. The next-action owner is a
  role selecting either that concrete internal owner or the concrete customer
  contact; the legacy free-form `ball_owner` value is compatibility storage only.
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
Intake source: the most recently created `OPEN` or `ENDED` round. Open follow-ups
can add, replace, or explicitly remove that relationship;
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

### Canonical Markdown specification revisions

The cockpit’s **Markdown** page (`/projects/:projectId/markdown`) supports a
manual **Create .md** action and a `MANUAL` or `MILESTONE` reason. Each stored
revision contains:

- a monotonically increasing project-local version;
- creation reason, optional milestone, and creation time;
- a source-data snapshot (project, schema, and interview rounds);
- a change summary against the previous revision;
- the selected published template name and immutable version provenance;
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

### Customer email and follow-up semantics

These are intentionally separate flows:

- **Interview customer handoff:** ending an interview creates version 1 in
  `DRAFT`. The employee selects the dedicated mailbox or an exact `@pte.hu`
  sender before preview. Preview binds sender, recipient, subject, HTML, text,
  and source content version. Send requires the matching digest and uses a database
  lease so only one attempt can own the version. Every logical version retains
  one immutable outbound resource, one plus-addressed Reply-To identity, one
  correspondence, and append-only submission attempts. `SENT` versions are immutable;
  a customer change request creates the next draft with a required modification
  summary and re-enables edits for that ended round. Known Graph rejections become
  `FAILED`; expired or interrupted attempts become `UNKNOWN` and require an
  explicitly acknowledged retry after checking external delivery evidence and
  accepting the possible duplicate-delivery risk.

- **Follow-up ping:** can be sent manually from the cockpit or automatically by
  the due-state timer. One trimmed, nonblank draft of at most 10,000 characters
  is stored per project with a positive optimistic version. It may reference one
  open Discovery follow-up from the same project. Manual send requires a
  15-minute, single-use preview token whose fingerprint binds the recipient,
  normalized draft, draft version, and referenced follow-up version/status.
  The manual delivery claim also has a 15-minute lease. Each claim is committed
  before SMTP I/O and finalized in a separate transaction. Explicit SMTP
  rejection becomes `FAILED`; a transport loss after the DATA boundary becomes
  `UNKNOWN`. Both terminal recovery states survive reload. `FAILED` can be
  retried only by an explicit retry command. `UNKNOWN` requires the exact
  attempt ID and a request-local duplicate-risk acknowledgement after external
  mailbox verification. An unchanged delivery can use the retry command;
  changed content requires a fresh preview and a fresh-send acknowledgement
  bound to the latest uncertain attempt. Retry revalidates the current recipient,
  draft version, and referenced follow-up; it never runs automatically. A stale
  `SENDING` attempt reconciles once to `UNKNOWN`, while a visible pending attempt
  holds the cockpit mutation lease and the client polls until a terminal state
  or lease expiry releases it. Durable attempts and redacted audit metadata are
  retained. The message
  contains no Markdown, Claude instruction, interview package, follow-up owner,
  category, answer, source linkage, identifiers, or audit content. The due-state
  worker re-reads the current recipient, draft, and optional reference. It claims
  one due item in a short PostgreSQL transaction by persisting `SENDING` and
  clearing `nextPingAt`, then performs SMTP outside the transaction and finalizes
  in a separate transaction. This provides one durable owner across workers
  without holding a database lock during network I/O. A successful scheduled
  attempt advances cadence from the worker's controlled clock. A known SMTP
  rejection becomes `FAILED` and retains the next cadence; `UNKNOWN` clears the
  next due time and requires the same explicit, request-specific duplicate-risk
  recovery as a manual attempt. A due draft/reference validation conflict pauses
  the enabled schedule with no SMTP attempt; saving a valid draft schedules the
  next cadence unless an `UNKNOWN` attempt still requires recovery. Expiry and
  archive disable and unschedule the state before transport. Audit metadata
  remains redacted.

The follow-up state in this section is an email-delivery schedule. It is not the
delivered `INTAKE-04` discovery-follow-up work-item management slice, including
its optional source linkage.

Relevant API routes:

```text
GET   /api/projects/{projectId}/follow-up
PATCH /api/projects/{projectId}/follow-up
PATCH /api/projects/{projectId}/follow-up/draft
GET   /api/projects/{projectId}/follow-up/reference-options
POST  /api/projects/{projectId}/follow-up/ping/preview
POST  /api/projects/{projectId}/follow-up/ping
GET   /api/projects/{projectId}/rounds/{roundId}/customer-handoffs
POST  /api/projects/{projectId}/rounds/{roundId}/customer-handoffs
PUT   /api/projects/{projectId}/rounds/{roundId}/customer-handoffs/{handoffId}/draft
GET   /api/projects/{projectId}/rounds/{roundId}/customer-handoffs/{handoffId}/preview
POST  /api/projects/{projectId}/rounds/{roundId}/customer-handoffs/{handoffId}/send
POST  /api/projects/{projectId}/rounds/{roundId}/customer-handoffs/{handoffId}/retry
POST  /api/projects/{projectId}/rounds/{roundId}/customer-handoffs/{handoffId}/resume-editing
```

Archived projects cannot send customer email. Expired or archived follow-up
states are disabled and unscheduled by the worker.

### SCORE-01.1 readiness operational surface

The delivered readiness route is narrow and read-only:

```text
GET /api/projects/{projectId}/readiness
```

It selects the most recently created `OPEN` or `ENDED` `INITIAL_INTAKE` round,
without giving an older open round precedence over a newer ended round. The result is available only for the exact current
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

### SCORE-01.2 Decision Review operational surface

The delivered Decision Review owns only Decision input persistence and derived
decision support. It does not record a formal decision or mutate the project
lifecycle:

```text
GET /api/projects/{projectId}/decision-review
PUT /api/projects/{projectId}/decision-review
```

`PUT` accepts all six nullable 1–5 ratings atomically: business value,
strategic alignment, urgency, confidence, complexity, and risk. A missing
dimension or an out-of-range value returns `400` without a partial write. A
normalized identical request is a no-op with no audit event or `updatedAt`
change. Any actual change writes exactly one
`PROJECT_DECISION_INPUTS_UPDATED` audit record containing only the ordered
changed dimension names—never submitted values, Score, recommendation,
readiness, answers, or gap content.

`GET` returns unavailable reasons when any input is incomplete or canonical
current readiness is unavailable. Otherwise it derives the rounded Score,
score label, recommendation, current readiness percentage, whether a critical
gap remains, the estimate-blocking-gap count, the recommendation reasons, and
the canonical input weights/inversion markers. It does not return individual
weighted contributions. The server, not the Angular client, owns every
calculation and recommendation rule.

Archived projects continue to return their retained inputs and derived review
but mark it read-only; `PUT` returns `409` until restore. Any persisted rating
is project activity, so an otherwise bare `DRAFT` cannot be physically deleted
and must be archived. When a later Initial Intake becomes current, the retained
inputs are recomputed against that source on the next read.

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

The separate CI container-smoke gate builds the API image, proves the packaged
contracts runtime import, starts PostgreSQL and the migration-gated API, and
invokes the canonical discovery/readiness consumers. OUTPUT-01 closeout also
proves in the built image that the published Default template can generate a
canonical revision with immutable template provenance. Markdown download and
SMTP failure/delivery behavior remain endpoint/integration checks; a local
  SMTP-capture container can verify interview handoff, manual review, manual
  ping, and due-timer delivery without using production credentials.

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

The SCORE-01.2 focused browser evidence is:

```powershell
pnpm --dir apps/web exec playwright test decision-review.spec.ts
```

It starts the real API against a fresh disposable loopback PostgreSQL database,
migrates it, and proves the server-derived display/save/reload path plus error
isolation and archive read-only behavior. Use the same disposable-database
safeguards as the readiness gate.

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
- provider message identifiers or delivery receipts for resolving an `UNKNOWN`
  interview-handoff attempt without operator evidence;
- STARTTLS support and provider-specific SMTP compatibility;
- OUTPUT-02 and OUTPUT-03 acceptance-criteria/user-story derivation and PDF/spreadsheet exports;
- backup retention/rotation and a restore drill owned by the deployment team.
