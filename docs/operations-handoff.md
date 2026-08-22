# Project Maker operations handoff

This document describes the current web-platform foundation as it exists in
the repository. It is an operator/developer handoff, not a claim that every
product capability in `docs/product-domain.md` is complete.

For an actual handover or go-live, use the
[release cutover checklist](release-cutover.md) as the decision record and this
document as its detailed runtime and recovery reference.

## Runtime boundary

The runtime is a Docker Compose stack:

| Service | Role | Network exposure |
| --- | --- | --- |
| `web` | Angular 22.1 + licensed PrimeNG 22.0.0 static application served by Nginx; proxies `/api/*` and `/mcp` | Publishes `WEB_PORT` (default `8080`) |
| `api` | NestJS 11 API, TypeORM migrations, TLS SMTP/IMAP mail gateway boundary and follow-up timer | Internal only; port `3000` is exposed to the Compose network |
| `postgres` | PostgreSQL 18.4 Alpine data store | Internal only; no host port |

`project-maker-edge` is the browser-facing network and
`project-maker-internal` is marked internal. The deployment must place the
published Nginx endpoint behind the Operator organization's VPN or equivalent
network boundary. Local email/password sessions identify Internal users after
network access; every active Internal user has the same capabilities and there
are no roles, memberships, or project permissions. The application does not
attempt to prove that a request came through a VPN.

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
| `ATTACHMENT_MAX_MIB` | no | Maximum size of one Question Bank reference file or Project work attachment in MiB. Defaults to 50; an Operator may configure a lower positive value, never a higher one. |
| `CORRESPONDENCE_MAILBOX_POLL_INTERVAL_MS` | no | Dedicated correspondence mailbox IMAP poll interval in milliseconds. The default is 60,000; non-integer values and values below 100 fall back to that default. |
| `CORRESPONDENCE_MAILBOX_NAME` / `CORRESPONDENCE_MAILBOX_ADDRESS` | yes | Operator organization-controlled dedicated sender identity; reply correlation uses high-entropy plus-addresses at this mailbox. |
| `MAIL_GATEWAY_SMTP_*` | yes | TLS SMTP endpoint and dedicated credential. Only `STARTTLS_REQUIRED` and `IMPLICIT_TLS` are accepted. |
| `MAIL_GATEWAY_IMAP_*` | yes | TLS IMAP inbox endpoint, folder, and separately managed credential. |
| `MAIL_GATEWAY_TLS_CA_CERTIFICATE_BASE64` | no | Optional base64 PEM private CA for both TLS channels. |

Before upgrading an existing deployment, rename the former mailbox entries in
its secret store or `.env` file to the matching
`CORRESPONDENCE_MAILBOX_*` names. The application deliberately does not read
the legacy names: the correspondence mailbox is controlled by the Operator
organization, not by a Project Customer.

Customer handoffs use the Operator-provided TLS SMTP gateway with no fallback. A known rejection
or bounded configuration/authentication failure retains the immutable outbound
communication, correspondence identity, and append-only attempt result. A retry
uses the same Reply-To identity; a new logical version creates a successor
correspondence. `ACCEPTED` means only that the mail system accepted submission.
Gateway activation, controlled smoke, IMAP recovery, and credential rotation are
defined in the [Operator mail gateway runbook](mail-gateway.md).

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
16. `0016-project-start-creation-request.ts` — durable Project-start creation request identity for retry-safe draft creation.
17. `0017-m365-interview-handoff.ts` — historical migration name; immutable outbound Customer communication, correspondence anchors, and delivery attempts for interview handoffs.
18. `0018-m365-customer-follow-up-ping.ts` — historical migration name; correspondence identities and acceptance results for Customer follow-up pings.
19. `0019-customer-mailbox-sync.ts` — durable dedicated-mailbox identity, completed historical checkpoint, bounded freshness/failure state, synchronization timestamps, lease ownership, and retained post-baseline mailbox changes.
20. `0020-correlated-customer-replies.ts` — append-only normalized inbound Customer messages, token-only correlation evidence, bounded attachment metadata, correspondence ordering indexes, and rollback protection for retained messages.
21. `0021-customer-correspondence-processing.ts` — explicit correspondence status, unread state, per-message classification, redacted processing audit, and guarded rollback while processing history exists.
22. `0022-receipt-proven-handoff-revision.ts` — allows a receipt-proven `UNKNOWN` handoff to keep its immutable outcome while a successor handoff draft is created; rollback refuses an incompatible superseded state.
23. `0023-customer-mail-triage.ts` — unmatched-message link/dismiss decisions, mail-system event retention, supporting Internet Message-ID lookup, and guarded rollback for retained triage history.
24. `0024-operator-mail-gateway-sender.ts` — removes the retired provider-domain restriction from persisted sender snapshots while retaining generic email-shape constraints and guarded rollback.
25. `0025-local-identity-and-audit-actor.ts` — self-managed local Internal users, revocable sessions, and actor-bound audit history without roles.
26. `0026-evidence-based-discovery.ts` — Project contacts, additional round sources, Insights, Evidence, attachments, and playbook provenance.
27. `0027-decision-and-portfolio.ts` — formal decisions, status updates, Portfolio saved views, Business goals, and Initiatives.
28. `0028-customer-response-and-notifications.ts` — bounded Customer response requests and the shared current-attention list.
29. `0029-customer-response-evidence.ts` — immutable Customer response evidence linkage.
30. `0030-delivery-and-git.ts` — editable Delivery packages, shared retained Git setups, and immutable preview-confirmed Git handoff snapshots.
31. `0031-claude-code-mcp-connection.ts` — one replaceable MCP token digest and creation time per Internal user.
32. `0032-canonical-customer-mail-persistence.ts` — canonical outbound, correspondence, and append-only attempt persistence for Interview handoff and Customer follow-up delivery; incomplete pre-canonical records remain readable as legacy history rather than being fabricated or removed.
33. `0033-project-archive-resume.ts` — retained pre-archive Project phase and paused automatic-reminder cadence for side-effect-free workflow resume.
34. `0034-project-draft-deletion.ts` — internal Project-owned draft data cascades on explicit Project deletion while Customer communication and Git handoff history retain restrictive foreign keys.
35. `0035-question-bank-reference-files.ts` — immutable Question Bank reference-file content and question-revision relations; valid legacy `QUESTION_BANK` attachments are carried forward without duplicating their bytes across later Bank revisions.

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
history; the thirty-five expected names are listed above.

The supported migration policy is no-squash forward evolution from the oldest
supported `0001` schema through `0035`. Do not use `undoLastMigration()` or an
arbitrary runtime downgrade as a normal recovery procedure: a down migration
can destroy retained business history and is not a deployment workflow. Take a
backup, diagnose the affected state, and ship a reviewed forward correction.
When a version must be abandoned, restore the verified backup into a controlled
maintenance window and then apply the compatible forward image. The repository
proves the retained forward chain in
[`supported-migration-sequence.e2e-spec.ts`](../apps/api/test/supported-migration-sequence.e2e-spec.ts).

### PostgreSQL backup

The commands below require PowerShell 7.4+ because they use
`Get-Content -AsByteStream`.

Create a local `backups` directory and stream a custom-format dump from the
running container. The dump remains on the host and is not committed:

```powershell
New-Item -ItemType Directory -Force .\backups | Out-Null
$stamp = Get-Date -Format yyyyMMdd-HHmmss
docker compose --env-file .env exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > ".\backups\project-maker-$stamp.dump"

# A napi futás után csak a hét legújabb mentés maradjon meg.
Get-ChildItem -LiteralPath .\backups -Filter 'project-maker-*.dump' -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip 7 |
  Remove-Item
```

Ezt az Operator naponta egyszer futtatja a saját ütemezőjéből. Az alkalmazás
nem tartalmaz külön backup schedulert vagy mentési felületet.

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

Havonta egyszer a legújabb mentést egy külön, eldobható adatbázisba kell
visszaállítani. A drill céladatbázisának neve tartalmazza a
`project_maker_restore_drill` előtagot; éles adatbázis nem lehet célpont. A
visszaállítás után az Operator ellenőrzi a `migrations`, `internal_users`,
`audit_events`, `projects`, `customer_outbound_communications` és
`customer_outbound_attempts` táblák olvashatóságát és reprezentatív
rekordjait, majd kizárólag az eldobható drill-adatbázist törli. A drill
eredményéből csak a dátum, a dump neve, az ellenőrzött táblák és a siker/hiba
maradjon meg; Customer-tartalom és credential ne kerüljön bizonyítékba.

## Functional handoff

### Internal identity and Claude Code MCP boundary

The first application screen is Login / Sign up. Internal users create,
deactivate, and restore their own local email/password account; all active
users have the same application capability set. Unsafe browser requests use
the authenticated session and exact `CORS_ORIGIN` boundary. Deactivation
revokes both browser sessions and the user's MCP connection.

The `Fiókbeállítások` page lets the signed-in user create, replace, or revoke
one Project Maker MCP token. Only its SHA-256 digest and creation time are
stored; the plaintext is returned once so the user can run:

```text
claude mcp add --transport http --scope user project-maker https://project-maker.example/mcp --header "Authorization: Bearer pm_mcp_..."
```

Replace the example origin with the VPN-reachable Nginx origin. No additional
MCP environment variable, Claude API key, OAuth server, role, or scope setup is
required. Replacing the token immediately invalidates the previous one.

Nginx forwards `/mcp` to the internal API with buffering disabled. The remote
Streamable HTTP server supports the current 2026-07-28 discovery/envelope path
and the legacy 2025-06-18 initialization path used by older Claude Code
runtimes. It exposes only bounded Project Maker tools for Project and
Specification reads, deterministic Specification generation, Delivery package
save, shared Git setup listing, exact Git preview and confirmation, Question
Bank maintenance, and Markdown template draft/publish operations. Every write
calls the same domain service as the webapp and retains the Internal user as
audit actor. There is no generic database or filesystem tool.

Project Maker never receives the user's Claude login/subscription credential
and never calls a model API. Customer mail is not an MCP tool and remains a
separate module. A Git push is still impossible without first receiving a
fresh exact preview and then supplying that preview token to the separate
confirmation tool. That confirmation tool also carries Claude Code's native
`anthropic/requiresUserInteraction` marker, so every push asks the human again.

### Project and interview flow

- `/` lists projects; the legacy `/projects/:projectId` bookmark intentionally redirects to `/projects/:projectId/status` while preserving return context.
- `/projects/:projectId/status` is the daily work hub: canonical work state, one primary task, coordination, Customer communication entry, and five allow-listed human-readable activities.
- `/projects/:projectId/settings` owns basics, Customer follow-up scheduling, manual lifecycle state, archive/restore, and guarded deletion.
- `/projects/:projectId/readiness` owns readiness and Discovery follow-up work; Decision Review, Interview, Markdown, and Customer correspondence keep their dedicated child routes.
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
- Project basics and Customer-contact data remain editable on every active
  Project, including after Project question-schema publication. Archived
  Projects must be restored before those current values can change; retained
  outbound and handoff snapshots are never rewritten.
- Project settings can archive and restore a Project. Permanent deletion remains
  limited to administrative `DRAFT`, but migration `0034` cascades its internal
  Project-owned working data. Any Customer communication or Git handoff history,
  including failed or uncertain attempts, returns `409` and requires archive.

### Governed attachment semantics

`ATTACHMENT_MAX_MIB` is an Operator deployment value. It defaults to 50 MiB and
can only be reduced. Nginx accepts a 51 MiB API request so the 50 MiB hard file
maximum plus multipart overhead can reach the API; the API enforces the exact
configured file cap. Accepted files are PDF; Word, RTF, and OpenDocument text;
Excel, CSV, and OpenDocument spreadsheets; PowerPoint and OpenDocument
presentations; UTF-8 TXT and Markdown; PNG and JPEG; and Microsoft Project and
Visio. Generic archives, executables, HTML, and SVG remain rejected. The feature
uses one PostgreSQL-backed durable path and does not provision a parser, scanner,
object store, preview service, OCR, or a separate recovery process.

Question Bank reference files belong to the Operator organization's immutable
Question Bank question revision. Published Question Bank versions and Project
question schemas retain their exact selected reference-file set. Project work
attachments belong only to one Project Initial Intake snapshot or Discovery
follow-up. Archived Projects are read-only, while retained Project work
attachments remain available through authenticated inert download. Explicit
Project draft deletion never removes Question Bank reference files.

### Discovery follow-up semantics

Discovery follow-ups are project-owned work items, not customer email schedules.
The Readiness page lists them in deterministic due-date order and can create one with a
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
not copied into audit history. A discovery follow-up is internal Project-owned
working data: explicit deletion of an otherwise eligible `DRAFT` cascades it,
while archive retains it unchanged.

### Canonical Markdown specification revisions

The dedicated **Markdown** page (`/projects/:projectId/markdown`) supports a
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
administrative lifecycle-status update. Saving the project while it is already at that status
does not create a duplicate; leaving and entering the milestone again creates
the next version. The manual button remains available for any other snapshot.

The employee UI does not expose the raw audit feed or payload. Project status
selects the latest five allow-listed business events before limiting and maps
them to specific Hungarian summaries. The bounded technical audit API and its
redacted persistence remain available for protected operational evidence.

### Customer mail gateway boundary and delivery semantics

`COMM-01.1` is a hard production boundary. Customer follow-up contracts,
module wiring, service behavior, manual delivery, and the due-state worker do
not accept or import a Markdown revision, `.md` attachment, Claude instruction,
or full Interview customer handoff. The removed legacy customer-review route
stays absent; historical audit rows remain readable but cannot create a new
delivery. The MCP and Git handoff paths remain internal and do not cross this
Customer mail gateway boundary.

These are intentionally separate flows:

- **Interview customer handoff:** ending an interview creates version 1 in
  `DRAFT`. The configured dedicated correspondence identity is shown before
  preview. Preview binds sender, recipient, subject, HTML, text,
  and source content version. Send requires the matching digest and uses a database
  lease so only one attempt can own the version. Every logical version retains
  one immutable outbound resource, one plus-addressed Reply-To identity, one
  correspondence, and append-only submission attempts. `SENT` versions are immutable;
  a customer change request creates the next draft with a required modification
  summary and re-enables edits for that ended round. Known gateway rejections become
  `FAILED`; expired or interrupted attempts become `UNKNOWN` and require an
  explicitly acknowledged retry after checking external delivery evidence and
  accepting the possible duplicate-delivery risk.

- **Follow-up ping:** can be authored, previewed, and sent manually from the
  Customer correspondence page or scheduled from Project settings; automatic delivery is run by
  the due-state timer. One trimmed, nonblank draft of at most 10,000 characters
  is stored per project with a positive optimistic version. It may reference one
  open Discovery follow-up from the same project. Manual send requires a
  15-minute, single-use preview token whose fingerprint binds the recipient,
  normalized draft, draft version, and referenced follow-up version/status.
  Before preview the configured dedicated correspondence identity is shown.
  The preview fingerprint includes that fixed sender identity.
  The manual delivery claim also has a 15-minute lease. Each new logical ping
  creates one immutable outbound communication, tokenized central Reply-To and
  Customer correspondence before SMTP I/O, then finalizes in a
  separate transaction. Explicit gateway rejection becomes `FAILED`; an
  indeterminate provider result becomes
  `UNKNOWN`. Both terminal recovery states survive reload. `FAILED` can be
  retried only by an explicit retry command. `UNKNOWN` requires the exact
  attempt ID and a request-local duplicate-risk acknowledgement after external
  mailbox verification. An unchanged delivery can use the retry command;
  changed content requires a fresh preview and a fresh-send acknowledgement
  bound to the latest uncertain attempt. Retry revalidates the current recipient,
  draft version, and referenced follow-up; it never runs automatically. A stale
  `SENDING` attempt reconciles once to `UNKNOWN`, while a visible pending attempt
  holds the ping work-surface mutation lease and the client polls until a terminal state
  or lease expiry releases it. Durable attempts and redacted audit metadata are
  retained. The message
  contains no Markdown, Claude instruction, interview package, follow-up owner,
  category, answer, source linkage, identifiers, or audit content. The due-state
  worker re-reads the current recipient, draft, and optional reference. It claims
  one due item in a short PostgreSQL transaction by persisting `SENDING` and
  clearing `nextPingAt`, then performs SMTP submission outside the transaction and finalizes
  in a separate transaction. This provides one durable owner across workers
  without holding a database lock during network I/O. A successful scheduled
  attempt advances cadence from the worker's controlled clock. A known gateway
  rejection becomes `FAILED` and retains the next cadence; `UNKNOWN` clears the
  next due time and requires the same explicit, request-specific duplicate-risk
  recovery as a manual attempt. A due draft/reference validation conflict pauses
  the enabled schedule with no mail attempt; saving a valid draft schedules the
  next cadence unless an `UNKNOWN` attempt still requires recovery. Expiry and
  archive disable and unschedule the state before transport. Audit metadata
  remains redacted.

The follow-up state in this section is an email-delivery schedule. It is not the
delivered `INTAKE-04` discovery-follow-up work-item management slice, including
its optional source linkage.

Relevant API routes:

```text
GET   /api/projects/{projectId}/follow-up
GET   /api/projects/{projectId}/follow-up/sender-identity
PATCH /api/projects/{projectId}/follow-up
PATCH /api/projects/{projectId}/follow-up/draft
GET   /api/projects/{projectId}/follow-up/reference-options
POST  /api/projects/{projectId}/follow-up/ping/preview
POST  /api/projects/{projectId}/follow-up/ping
POST  /api/projects/{projectId}/follow-up/ping/retry
GET   /api/projects/{projectId}/rounds/{roundId}/customer-handoffs
GET   /api/projects/{projectId}/rounds/{roundId}/customer-handoffs/sender-identity
GET   /api/projects/{projectId}/rounds/{roundId}/customer-handoffs/{handoffId}
POST  /api/projects/{projectId}/rounds/{roundId}/customer-handoffs
PUT   /api/projects/{projectId}/rounds/{roundId}/customer-handoffs/{handoffId}/draft
POST  /api/projects/{projectId}/rounds/{roundId}/customer-handoffs/{handoffId}/preview
POST  /api/projects/{projectId}/rounds/{roundId}/customer-handoffs/{handoffId}/send
POST  /api/projects/{projectId}/rounds/{roundId}/customer-handoffs/{handoffId}/retry
POST  /api/projects/{projectId}/rounds/{roundId}/customer-handoffs/{handoffId}/resume-editing
```

Archived projects cannot start customer email. An enabled automatic follow-up is
paused without a catch-up send and resumes its retained remaining delay after
restore; expiry still disables and unschedules it.

### SCORE-01.1 readiness operational surface

The delivered readiness route is narrow and read-only:

```text
GET /api/projects/{projectId}/readiness
```

It selects the most recently created `OPEN` or `ENDED` `INITIAL_INTAKE` round,
without giving an older open round precedence over a newer ended round. The result is available only for the exact current
30-key canonical `general` v1 source. Otherwise it returns a typed unavailable
state: `NO_INITIAL_INTAKE` or `UNSUPPORTED_SCHEMA`. An unavailable result is not
a score and does not disable Project coordination or discovery-follow-up operations.

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

Readiness responses and remediation gaps intentionally omit source answers,
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
but mark it read-only; `PUT` returns `409` until restore. Decision ratings are
internal Project-owned working data and therefore cascade with an explicitly
deleted eligible `DRAFT`. When a later Initial Intake becomes current, retained
inputs are recomputed against that source on the next read.

## Verification gates for this handoff

Pre-main validation mirrors the repository's three GitHub CI jobs without
turning unrelated browser journeys into release gates:

```powershell
pnpm install --frozen-lockfile
pnpm --filter @project-maker/api migration:run
pnpm verify
pnpm test:mail-gateway
node scripts/run-container-smoke.mjs
```

The `checkpoint` job migrates a fresh PostgreSQL database and runs `pnpm
verify`, which covers every workspace typecheck, unit/API test, and production
build. Run those first two commands only against a dedicated non-production
test database.

`pnpm test:mail-gateway` owns and removes a disposable PostgreSQL container. It
proves the authenticated TLS SMTP/IMAP protocol boundary, the Customer-mail API
paths, and one reviewed send/reply browser journey without external credentials.

The `container-smoke` job builds the production API image, proves the packaged
contracts runtime import and the absence of build tooling, migrates a fresh
database through `0001 -> 0035`, then checks health and an authenticated
canonical-policy consumer. The script owns and removes its temporary Compose
project and volume.

Run a focused Playwright spec only when its route or user journey changed. Run
the complete `pnpm test:e2e` suite only for broad cross-route UI changes; it is
not an unconditional pre-main gate. Playwright resets its configured database
before migrations, so `DATABASE_URL` must point to a uniquely named loopback
database containing `test` or `e2e` in its name. Never point it at shared or
production data.

These automated checks do not prove production mail-gateway readiness. A
separately authorized real-gateway run must follow the [Operator mail gateway
runbook](mail-gateway.md), with its bounded result retained in the Operator
organization's existing internal change ticket.

## Known next slices

The following are deliberately not hidden in this handoff:

- provider message identifiers or delivery receipts for resolving an `UNKNOWN`
  interview-handoff attempt without operator evidence;
- backup retention/rotation and a restore drill owned by the deployment team.
