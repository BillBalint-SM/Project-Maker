# ATTACH-01 governed discovery attachments

**Status:** Final implementation plan, pending delivery.

This plan was finalized against the primary-source evidence in
[ATTACH-01 file-upload and download research](research/attach-01-file-upload-best-practices.md).
Its product boundary is closed; implementation may change an internal adapter
only when the verification gates below prove that necessary.

## Problem and outcome

Employees can record Question Bank guidance, Initial Intake answers, and
Discovery follow-ups, but Project Maker cannot retain the supporting files used
to understand or resolve that work. ATTACH-01 adds governed upload and download
at the place where each file has meaning without turning Project Maker into a
general document-management system.

The feature keeps two relationships distinct:

- A **Question Bank reference file** is Operator organization-maintained
  guidance belonging to one question revision in a Published Question Bank
  version.
- A **Project work attachment** is Project-owned evidence attached to one
  Initial Intake checklist snapshot or one Discovery follow-up.

Customer inbound messages continue to retain bounded attachment metadata only.
ATTACH-01 does not fetch, retain, or expose Customer inbound attachment content
from the Correspondence mailbox.

## Final delivery decisions

- One upload request carries exactly one file. The browser may select several
  files, but uploads them as an ordered queue: one active request for Question
  Bank successor publication and at most two for Project work attachments.
- A file is available only after bounded receipt, type and structure inspection,
  SHA-256 calculation, malware scanning, owner revalidation, quota enforcement,
  and one successful PostgreSQL transaction.
- The first production content repository is a dedicated PostgreSQL `bytea`
  table. The 50 MiB cap, concurrency limits, and performance gates make this a
  bounded decision rather than a claim that database BLOB storage is always
  fastest. The attachment module keeps storage replaceable.
- Every upload requires an owner-scoped idempotency key. A lost response can be
  retried without creating a second relationship.
- Files are downloaded only through an authenticated, employee-authorized,
  parent-scoped API response. There are no public URLs, inline rendering,
  redirects to storage, or byte-range responses in the first delivery.
- The production scanner is an Operator organization-controlled ClamAV daemon
  reached over a private Unix socket. Unhealthy, stale, unavailable, timed-out,
  malformed, or limit-exceeded scanner outcomes fail closed for new uploads;
  previously verified downloads remain available.
- The module and synthetic suites may be built before `SEC-01`, using a
  deterministic test identity adapter, but production routes and UI remain
  disabled until `SEC-01` supplies authenticated employee identity,
  owner-operation authorization, CSRF protection, actor attribution, and rate
  limiting. An internal/VPN boundary is not an identity mechanism.

## Current-model alignment

The current Question Bank has no persisted draft or separate publish command.
Each successful question create or update publishes a successor bank version
transactionally, while unsaved edits exist only as local view state. Reference
file changes must follow that same model: one successful change creates the
successor Published Question Bank version, and a failed request creates none.
ATTACH-01 does not introduce a hidden Question Bank draft lifecycle.

The phrase “next task” maps to **Discovery follow-up**. Operational coordination
data has one next-action field, and the Active project queue contains Project
prioritization results; neither is an attachment owner.

## Supported owners and lifecycle

| Attachment owner | Attachment kind | Add or remove | Download |
| --- | --- | --- | --- |
| Question Bank question revision | Question Bank reference file | By publishing a successor Question Bank version | From that version and every Project question schema that selected it |
| Initial Intake checklist snapshot | Project work attachment | While the owning interview working record is editable under its existing review rules | While the Project and retained interview exist, including archive |
| Discovery follow-up | Project work attachment | Only while the follow-up is open and the Project is mutable | After resolution and while archived |

The first delivery supports PNG, JPEG, WebP, PDF, UTF-8 TXT and CSV, and the
macro-disabled Open XML formats DOCX, XLSX, and PPTX. Legacy DOC, XLS, and PPT
are excluded because their binary containers may carry VBA while offering no
reliable macro-free extension distinction. Generic archives, templates,
add-ins, binary workbooks, macro-enabled formats, and encrypted documents are
also excluded. Every accepted type is downloaded as a file; uploaded content is
never rendered inline.

Open XML files are accepted only after bounded container inspection proves the
expected document family, safe entry paths, bounded entry count and expanded
size, and the absence of VBA projects, embedded packages or OLE objects, and
external relationships. PDF acceptance rejects encryption, embedded files,
launch actions, and JavaScript. These checks use maintained parsers behind the
attachment module; they are not hand-written ZIP or PDF parsing in controllers.

### Question Bank reference files

- A published question revision is never mutated in place.
- Adding, replacing, reordering, or removing a reference file is part of the
  question change that publishes a successor bank version.
- Successor publication copies retained relationships without duplicating
  unchanged binary content. Omitting a relationship removes it only from the
  successor version.
- Older Published Question Bank versions and Project question schemas keep the
  exact relationship set they selected.
- A Frozen Project question schema exposes its selected reference files as
  download-only guidance; Project employees cannot replace organization
  guidance from an interview.

### Initial Intake checklist attachments

- A Project work attachment belongs to one immutable checklist-snapshot
  identity, not to a stable Question Bank key or the latest Question Bank
  question.
- Add and remove authorization follows the existing answer editability rule: an
  open interview is editable, and an Ended interview is editable only through
  its active Interview revision draft.
- Sending an Interview customer handoff freezes that handoff version but does
  not send attachment names or content. A later editable revision may change
  the current working attachment set without rewriting an earlier handoff.

### Discovery follow-up attachments

- Only an Open discovery follow-up may add or remove attachments.
- Attachment mutation is a dedicated relationship change and does not increment
  the Discovery follow-up version used by general field editing.
- Resolution locks the attachment set. Resolved follow-ups remain downloadable
  and are not reopened by this feature.
- A source-linked follow-up and its source checklist snapshot retain independent
  attachment sets; source linkage never copies, infers, or merges files.

### Project lifecycle

- Project archive makes Project work attachments read-only while preserving
  downloads with retained history.
- Restoring a Project restores mutation only where the owning interview or
  Discovery follow-up is otherwise editable.
- Retained Project work attachments count as activity for guarded deletion.
- Physical Project deletion, when otherwise allowed, removes Project-owned
  attachment relationships and unreferenced Project content transactionally.
  Question Bank reference files are not Project-owned.

## Attachment module boundary

One attachment module owns lifecycle checks, validation, scanning, persistence,
audit redaction, download headers, and cleanup for every supported owner:

```text
list(owner) -> attachment collection and effective upload policy
upload(owner, bounded upload request) -> mutation result
replace(owner, attachment identity, bounded upload request) -> mutation result
reorder(owner, ordered attachment identities, mutation key) -> mutation result
remove(owner, attachment identity, mutation key) -> mutation result
download(owner, attachment identity) -> verified download stream and headers
```

`owner` is a discriminated domain reference, not a free-form
`targetType + targetId` pair. Question Bank, Initial Intake, and Discovery
follow-up callers do not reproduce attachment policy.

The bounded upload request contains only the stream, untrusted client filename,
declared media type and size, owner-scoped idempotency key, and abort signal.
The module owns every other invariant, error mode, ordering constraint, and
performance limit. Its interface is the caller and test surface; controllers
must not assemble a second validation or cleanup pipeline.

The module has three replaceable internal seams, each with production and
deterministic test adapters:

- a type and structure inspector whose production adapter runs maintained
  parsers without network access and with bounded CPU time, memory, entry count,
  and expanded bytes;
- a content scanner whose production adapter speaks the ClamAV `INSTREAM`
  protocol over a private Unix socket;
- a content repository with PostgreSQL and in-memory adapters.

The first production implementation stores bounded binary content in
PostgreSQL `bytea`. This preserves the existing durable-state, transaction,
backup, and restore boundary. PostgreSQL may materialize a bounded value in the
API process, so upload and download concurrency is capped and verified under
load. The attachment interface hides this decision so failing performance,
capacity, WAL, backup, or restore gates can later justify object storage without
changing the owning domains or HTTP contracts.

## Persistence

Use one immutable content record, one bounded mutation-receipt table, and typed
relationship tables:

- `stored_file_contents`: stable UUID, `bytea` content, verified media type,
  byte size, SHA-256 integrity digest, integrity-verification timestamp, and
  creation timestamp. An integrity mismatch blocks download without deleting
  the retained relationship or bytes.
- `attachment_mutation_receipts`: exactly one typed owner foreign key enforced
  by a database check and per-owner unique indexes, mutation kind, UUID
  idempotency key, bounded processing lease, request fingerprint, terminal
  result identity/version, and timestamps. The typed owner plus key is unique. A
  completed receipt returns the original result; the same key with a different
  fingerprint conflicts; an expired processing lease is recoverable. Receipt
  retention is bounded but outlives browser retry and deployment-restart
  windows.
- `question_bank_reference_files`: relationship UUID, exact base-question
  revision foreign key, stored-content foreign key, safe original filename,
  display order, and creation timestamp.
- `round_question_attachments`: relationship UUID, exact round-question
  snapshot foreign key, stored-content foreign key, safe original filename, and
  creation timestamp.
- `discovery_follow_up_attachments`: relationship UUID, Discovery follow-up
  foreign key, stored-content foreign key, safe original filename, and creation
  timestamp.

Do not use an unconstrained polymorphic relationship table. Do not deduplicate
content across Projects: the digest proves integrity but must not create
cross-Project existence or timing side channels. Unchanged Question Bank
relationships may share one content record across immutable bank versions.

Mutation receipt state does not make a file available and is not a Question Bank
draft. Failed policy or scan outcomes create no content or relationship. Stale
processing receipts and unreferenced content are reconciled only by bounded,
module-owned jobs; neither job follows caller-supplied paths or identifiers.

Migration rollback must refuse to drop retained attachment content. Reversal
requires an explicit destructive migration or a verified export.

## Contracts and HTTP

Shared contracts expose an `AttachmentSummary` with relationship identity, safe
original name, verified media type, byte size, creation time, and attachment
kind. They never expose content IDs, scanner output, storage details, or local
paths. `AttachmentCollection` adds the ordered summaries, current count and
bytes, the effective per-file maximum, and applicable aggregate-capacity
metadata so the browser never duplicates policy. There is no per-owner
attachment-count or byte maximum.

Every operation is parent-scoped:

- Question Bank question reference-file list and successor-publication changes;
- Project, round, and checklist-snapshot Project work attachments;
- Project and Discovery-follow-up Project work attachments.

The parent-scoped route families are:

```text
/settings/base-questions/{questionRevisionId}/reference-files
/projects/{projectId}/rounds/{roundId}/questions/{snapshotId}/attachments
/projects/{projectId}/discovery-follow-ups/{followUpId}/attachments
```

Each family lists, uploads, removes, and downloads through the parent path; an
attachment identity from another parent returns `404`. Question Bank mutations
must target the latest question-revision identity and publish one successor bank
version. One uploaded file, one removal, one replacement, or one reorder is one
atomic successor publication. A multi-file browser selection therefore creates
ordered successor versions one file at a time and never creates hidden staged
Question Bank state.

`GET /settings/base-questions` and every Question Bank reference-file response
carry `ETag: "question-bank-v{version}"`. Every Question Bank file mutation must
send that exact value in `If-Match` and target the corresponding current
`questionRevisionId`; a missing precondition is `428`, while a stale version or
historical revision is normally `409`. Lost-response replay is the explicit
exception: after validating the header syntax and deriving the complete request
fingerprint, the server looks up the mutation receipt scoped to the originally
targeted `questionRevisionId` and idempotency key before rejecting a historical
revision or stale ETag. A matching completed receipt returns its stored successor
result even though the original revision is now historical; a matching live
lease returns `409` with `Retry-After`, and a changed fingerprint conflicts. Only
an unseen or recoverable request then has to pass the current-revision and ETag
check, so an unseen stale request is rejected instead of being applied to the
latest version implicitly. Success returns a
`QuestionBankReferenceFileChange` containing the complete successor
`BaseQuestionBank`, its new ETag, the successor question-revision identity, and
that revision's `AttachmentCollection`. The browser uses those returned values
for the next queued change.

The Question Bank mutation shapes are explicit:

```text
POST   .../{questionRevisionId}/reference-files
       one multipart file; adds it last
PUT    .../{questionRevisionId}/reference-files/{attachmentId}/content
       one multipart file; replaces at the same display order
PUT    .../{questionRevisionId}/reference-files/order
       JSON { orderedAttachmentIds: UUID[] }
DELETE .../{questionRevisionId}/reference-files/{attachmentId}
```

The reorder payload must contain every current relationship identity exactly
once. Missing, foreign, or duplicate identities are rejected without publishing.
Upload, replacement, reorder, and removal all require an `Idempotency-Key`; the
mutation fingerprint includes its kind, current owner revision, and respectively
the file name/size/digest, replaced or removed relationship identity, or complete
ordered identity list. A replay after a lost response returns the same successor
result rather than publishing another bank version.

Downloads return the exact retained bytes with a safe RFC-compatible filename.
They set `Content-Disposition: attachment` with a quoted safe ASCII fallback and
RFC 5987 UTF-8 `filename*`, the verified media type, exact `Content-Length`, and
`X-Content-Type-Options: nosniff`, plus `Cache-Control: private, no-store`.
There are no public, bearer-token, permanent direct-storage URLs, redirects,
inline responses, or byte ranges in v1.

Uploads use `multipart/form-data`, stream into a bounded request-scoped temporary
location, and never buffer an unbounded request in memory. Success means the
file passed policy and malware scanning and that its content plus typed
relationship committed transactionally. Timeout, scanner failure, validation
failure, or database failure returns no attachment summary.

Every upload or replacement carries exactly one `file` field and one UUID
`Idempotency-Key` header; text multipart fields and additional parts are
rejected. Removal and reorder carry the same header without multipart content.
Typed responses distinguish `413` size rejection, `422` file-policy or malware
rejection, `428` missing Question Bank precondition, `409` parent/version/
aggregate-quota/idempotency conflicts, and retryable `503` scanner, capacity, or
integrity unavailability. Public errors and Hungarian guidance do not reveal
scanner signatures, parser detail, paths, SQL, or stored identities.

## Ingress, scanning, and commit pipeline

1. The dedicated Nginx upload locations default `client_max_body_size` to `51m`
   for one 50 MiB file plus bounded multipart overhead and track any lower
   configured application maximum. They disable proxy request buffering and use
   bounded idle timeouts. Every non-upload route keeps the smaller default body
   policy.
2. A pre-receipt guard checks that the parent exists and the employee is
   authorized. Project-owned parents must also be presently mutable. For a
   Question Bank command, this guard deliberately does not reject a historical
   target before receipt lookup because it may be a lost-response replay. The
   Nest/Multer route then enforces one file, zero text fields, one part, bounded
   header and field-name sizes, and at most the configured file maximum, which
   defaults to 52,428,800 bytes. It uses disk storage, never `memoryStorage()`.
3. Node stream pipelines write once to a generated, mode-`0600`, request-owned
   file in the private attachment-temp volume while counting bytes and computing
   SHA-256. Disconnect, ingress idle timeout, request timeout, or abort closes the
   pipeline and cannot expose partial content. Inspection, scanning, and commit
   have a separate absolute two-minute post-receipt deadline.
4. Lightweight policy validates normalized extension, declared media type, and
   magic signature without deeply parsing hostile content. A short transaction
   then claims the owner-scoped mutation receipt using the final name/size/digest
   fingerprint. A matching completed receipt returns its original result; a
   fresh processing lease returns `409` with `Retry-After`; a changed fingerprint
   conflicts; an absent or expired receipt is claimed for five minutes, which
   exceeds the absolute post-receipt deadline.
5. The scanner sends the exact same bytes to ClamAV `INSTREAM` through the
   private Unix socket. Only a clean result reaches bounded type-specific PDF or
   Open XML structure inspection. A policy, scan, or inspection failure releases
   the claim for an explicit retry; a process crash leaves only the bounded
   lease to expire.
6. Only clean, structurally valid content starts the final short database
   transaction. The module locks and revalidates the owner, applicable aggregate
   byte quotas, latest Question Bank revision where applicable, and mutation
   receipt. It verifies the bytes prepared for the `bytea` write against the
   spool digest, inserts content, typed relationship, completed receipt, and
   redacted audit record, and retries only serialization failures at most three
   times. Receipt, scan, and client requests are never automatically replayed.
7. Success and every failure path remove the temporary file. Startup and hourly
   reconciliation delete only module-generated files older than one hour and
   emit bounded cleanup metrics; they never traverse caller-controlled paths.

Removal and reorder do not enter the spool/scan pipeline. They claim and
complete their mutation receipt in the same short owner-locking transaction as
the relationship change or Question Bank successor publication. Replacement
uses the upload pipeline and preserves display order only in the new successor
version.

ClamAV readiness requires a successful `PING`, a configured `StreamMaxLength`
at least equal to the application maximum, compatible scan/decompression caps,
and signatures no older than 24 hours. The application maximum remains the
authoritative smaller limit. Upload concurrency defaults to two scans/commits
per API instance; download concurrency defaults to four materialized values.
Saturation fails quickly with `503` and `Retry-After` instead of accumulating an
unbounded server queue. Completed mutation receipts are retained for seven days;
their cleanup never removes the attachment relationship or content. If that
relationship was explicitly removed first, replaying its key conflicts as a
retired request instead of recreating the file.

## File and security policy

- Default maximum: 50 MiB (52,428,800 bytes) per file, configurable downward.
- There is no per-owner attachment-count or byte maximum.
- Default aggregate maxima: 2 GiB per Project, 10 GiB across retained Question
  Bank content, and 20 GiB across the deployment. They are startup-validated
  and configurable downward. Raising them requires a passing capacity,
  performance, backup-size, and timed-restore review.
- Extension, declared media type, and content signature must agree.
- Empty files, executables, scripts, HTML, SVG, generic archives, legacy or
  macro-enabled Office formats, malformed containers, and encrypted or otherwise
  unscannable content are rejected.
- Filenames are Unicode NFC-normalized and capped at 255 characters. Path
  separators, traversal segments, controls, bidirectional formatting controls,
  NUL, ambiguous trailing dots/spaces, and dangerous extension chains are
  rejected rather than repaired silently. Internal storage identities and temp
  names are generated UUIDs.
- Scanner unavailability, stale signatures, malware, malformed replies, scan
  timeout, and scan-limit exhaustion fail closed with actionable Hungarian
  guidance and no scanner diagnostics.
- Downloads use `Content-Disposition: attachment`, the verified media type,
  `X-Content-Type-Options: nosniff`, and a bounded `Content-Length`.
- ATTACH-01 never executes, transforms, indexes, OCRs, parses into Markdown, or
  renders uploaded content.
- Logs never contain bytes, filenames, question text, answers, or follow-up
  content. Audit records retain only the relationship identity, owner kind,
  operation, and bounded byte size.

The SHA-256 digest is integrity evidence, not a trust or deduplication decision.
It is verified before durable availability, for every retained content record
after a restore, and by a weekly bounded integrity job. A mismatch blocks that
content's download, preserves its relationship and bytes for recovery, and
raises an Operator alert; it is never silently deleted or served.

The current VPN-trusted model cannot prove a caller is a specific employee and
therefore cannot satisfy attachment authorization or actor attribution.
ATTACH-01 implementation may be exercised only by synthetic/local test identity
until `SEC-01` exists. Production route registration and UI exposure are a hard
dependency on `SEC-01`; a VPN alone cannot waive that dependency.

## Web behavior

Question Bank, Initial Intake, and Discovery follow-up each own their attachment
markup, styles, labels, view state, and binding to their domain mutation policy,
as required by [ADR-0004](adr/0004-project-operation-policy.md). A shared
headless attachment-transfer client owns only HTTP mechanics that would
otherwise be duplicated: FormData construction,
idempotency headers, XHR events, bounded queueing, cancellation, typed transport
errors, and authoritative-list reconciliation. It owns no markup, styles, labels,
or lifecycle policy.

Each owner surface provides:

- a labelled native multi-file input with optional drag-and-drop enhancement;
- an upload queue with one active Question Bank request or at most two active
  Project attachment requests; every selected file has its own idempotency key,
  progress, result, retry, and cancel action;
- file name, verified type, formatted size, creation time, and download action;
- Angular `HttpClient` XHR progress during transport, followed by a distinct
  indeterminate `Ellenőrzés` stage while inspection, scanning, and commit run;
- a polite accessible live region announcing selected, uploading, checking,
  completed, rejected, and canceled milestones without announcing every byte;
- retry after transport or response loss with the same idempotency key; an
  intentional second attachment always receives a new key;
- cancellation that aborts the request and then reconciles the authoritative
  list because cancellation can race a successful commit;
- confirmed removal only where the owner is mutable;
- distinct empty, loading, policy-rejection, quota, scan-unavailable,
  scan-rejection, busy, idempotency-conflict, and stale-list states with specific
  Hungarian next steps;
- keyboard-operable native download links and buttons.

Initial Intake shows `Kérdésbanki segédanyagok` and `Projektcsatolmányok` as
separate groups. Discovery follow-ups show `Projektcsatolmányok` in the owning
card without calling the work item a generic task. Archived and resolved
contexts show downloads without upload or remove controls.

Question Bank file selections remain local view state until each ordered
successor-version request succeeds. A failed request leaves the published bank
unchanged, stops the queue before later selections, preserves those selections,
and asks the employee to refresh if the target revision became obsolete.

## Failure and concurrency rules

- After mutation, the newest list request wins; a stale response cannot restore
  a removed entry.
- Upload and removal lock and revalidate the owning record on the server.
- Transactions lock deployment, the applicable Question Bank or Project
  aggregate-quota scope, and the owning record in one stable broad-to-narrow
  order before checking byte counters, preventing concurrent overshoot and
  lock-order deadlocks.
- A completed mutation replay with the same owner, idempotency key, and
  fingerprint returns the original result. The same key with a different
  command or content conflicts; two concurrent matching uploads produce exactly
  one relationship and two concurrent matching Question Bank commands publish
  exactly one successor version.
- For Question Bank commands, completed-receipt replay takes precedence over the
  current-revision check. An unseen or non-matching command then uses the existing
  publication lock and rejects an obsolete bank version instead of applying
  files to the latest version implicitly.
- Discovery follow-up resolution racing with upload or removal has one
  serializable outcome: the attachment commits before resolution or mutation is
  rejected after resolution.
- A failed list refresh retains the last successful list and marks it stale. An
  initial list failure exposes a targeted retry.
- A client disconnect never makes partially received content available.
- Temporary files are request-scoped and cleaned after success, rejection,
  disconnect, and startup recovery.
- Scanner and transport operations are never retried automatically. Only a
  serialization failure inside the already-clean, bounded database commit may
  retry internally, at most three times with jitter.
- Duplicate display filenames do not overwrite content. They remain independent
  attachments with distinct identities and creation times; replacement is an
  explicit Question Bank successor operation.

## Operations and observability

The Compose delivery adds an internal-only ClamAV service, a shared Unix-socket
volume, a private API temp volume, signature updates, and a scanner healthcheck;
it publishes no scanner port. Temp content is disposable and excluded from
backup. PostgreSQL remains the only durable attachment backup target.

Startup validates these configuration groups as one contract:

- per-file, Project, Question Bank, and deployment byte limits; no owner-level
  byte or attachment-count limit is configured;
- upload, download, scanner, and database-commit concurrency and timeouts;
- private temp directory, cleanup age, and cleanup cadence;
- scanner socket, maximum stream length, signature maximum age, and scan timeout;
- mutation-idempotency lease and receipt-retention intervals.

Invalid or internally inconsistent values fail startup. Scanner downtime does
not take down unrelated Project Maker work or verified downloads; attachment
upload readiness becomes unavailable and returns a generic retryable response.

Structured redacted telemetry records outcome class, owner kind, byte bucket,
total duration, scanner duration, database duration, cleanup count/oldest age,
quota rejection, idempotent replay, download duration, stored-byte totals,
backup/restore digest result, and integrity result. Alert on scanner
unavailable or stale, cleanup backlog, repeated policy rejection, storage/WAL or
backup growth, restore-budget breach, and any integrity mismatch. Raw filenames,
bytes, paths, scanner findings, free text, request bodies, and credentials never
enter logs or metrics.

## Performance acceptance gates

The first storage adapter is accepted only when the built Compose stack, on a
documented reference host with 4 vCPU, 8 GiB RAM, and SSD storage, meets all of
these repeatable gates with a warm scanner and a representative PostgreSQL data
set:

- listing 20 attachments: p95 at most 250 ms;
- clean 5 MiB upload: p95 at most 2 seconds end to end on loopback;
- clean 50 MiB upload: p95 at most 6 seconds end to end on loopback;
- 50 MiB download: p95 time to first byte at most 500 ms and completion at most
  3 seconds on loopback;
- two simultaneous maximum uploads plus four simultaneous maximum downloads:
  no incorrect response, duplicate relationship, leaked temp file, or scanner
  bypass; API RSS stays below 512 MiB and shows no monotonic growth across 20
  rounds;
- a timed PostgreSQL dump and restore of a 2 GiB representative retained-content
  fixture completes within 10 minutes and every restored digest matches; the
  report also projects the configured deployment maximum and records the
  Operator organization's production recovery budget.

The benchmark records payload sizes, percentiles, peak memory, database and WAL
growth, dump size, and restore duration. A failing gate blocks delivery; it is
evidence to optimize or replace the repository adapter, not permission to raise
the threshold silently. Production network speed is reported separately from
server processing and is not inferred from loopback results.

## Required verification

- Contract tests cover collections, summaries, kinds, limits, typed error
  identifiers, and absence of storage and scanner details.
- Pure unit tests cover filename normalization, extension/media/signature
  agreement, each type-specific structure rule, quotas, headers, lifecycle
  policy, idempotency fingerprints, and redacted telemetry.
- Quota-policy regression tests prove that a twenty-first attachment and an
  owner total above 500 MiB remain valid while the applicable Project, Question
  Bank, and deployment byte maxima are not exceeded.
- Nest HTTP integration tests use real PostgreSQL and deterministic scanner
  behavior to prove exact-byte download, Hungarian filenames, safe headers,
  policy rejection, quotas, parent mismatch, and transaction cleanup.
- Multipart boundary tests cover oversized `Content-Length`, chunked overrun,
  empty and truncated bodies, an unexpected field, multiple files/parts, long
  headers, abort and timeout during receipt, and the absence of memory storage.
- Migration tests prove foreign keys, indexes, guarded rollback, Project
  deletion behavior, historical Question Bank preservation, mutation-receipt
  uniqueness and lease recovery, and blocked rollback with retained bytes.
- Scanner adapter contract tests cover clean content, EICAR detection, timeout,
  malformed reply, stream limit, stale signatures, unavailable socket, abort,
  and zero durable/temp residue. At least one integration gate uses real ClamAV
  through its Unix socket.
- Idempotency tests prove replay after a lost response, same-key/different-file
  rejection, upload and Question Bank mutation fingerprint conflicts,
  concurrent same-key single creation/publication, lease expiry, restart
  recovery, and distinct relationships for distinct keys.
- Question Bank tests prove successor publication, obsolete-version conflict,
  one-file-per-version queue order, replacement/reorder/removal, unchanged-
  content reuse, failed-publication atomicity, and historical Project schema
  stability.
- Initial Intake tests prove open, Ended-review, sent-handoff, later-revision,
  and archived lifecycle rules without sending attachments to Customers.
- Discovery follow-up tests prove open-only mutation, resolution races,
  unchanged edit version, source-link independence, resolved download, and
  archived read-only behavior.
- Security tests cover traversal filenames, Unicode/control characters, MIME
  spoofing and polyglots, legacy/macro Office content, unsafe Open XML entries
  and expansion, PDF active/encrypted/embedded content, generic archives,
  header injection, malware, scanner bypass attempts, parent authorization,
  and unavailable-scanner behavior. Authenticated authorization and CSRF
  regressions join this suite when the `SEC-01` exposure gate is delivered.
- Playwright uses real file chooser and download flows for one Question Bank
  reference file, one Initial Intake attachment, and one Discovery follow-up
  attachment, including keyboard operation, recovery, narrow layout, resolution,
  archive behavior, multi-file queueing, transport progress, scan state, cancel,
  idempotent retry, and accessible status announcements.
- Nginx integration proves the default 51 MiB request cap, downward-configured
  cap alignment, upload-route streaming, API overrun enforcement, idle timeout,
  and unchanged smaller limits elsewhere.
- Backup/restore verification checks every retained test byte and digest, blocked
  integrity behavior, relationships, and timed recovery—not only command exit.
- A repeatable load gate proves the performance budgets, bounded API memory,
  bounded scanner/database concurrency, no temp leak, and no monotonic resource
  growth.

A credential-free `pnpm test:attachments` suite must provision a disposable
PostgreSQL database, real ClamAV, Nginx, API, and browser fixture; run unit,
adapter, integration, security, smoke, and bounded load checks; then remove only
its own disposable resources. Production activation adds a controlled backup /
restore and scanner-signature freshness receipt, never real file content.

## Delivery slices

1. Build the deep attachment module: shared contracts, canonical policy and
   errors, disk spool, type inspector, deterministic adapters, ClamAV adapter,
   PostgreSQL repository, mutation receipts, guarded migration, Nginx and
   Compose wiring, and unit/adapter/integration/performance harnesses.
2. Deliver Question Bank reference files with one-change successor-publication
   semantics, queue recovery, replacement/reorder/removal, and Frozen Project
   question-schema retrieval.
3. Deliver Initial Intake checklist attachments under the existing Interview
   review and handoff editability rules.
4. Deliver Discovery follow-up attachments, resolution concurrency, archive
   behavior, and guarded Project deletion.
5. Close browser accessibility, real-scanner security, load/capacity,
   observability, integrity cadence, Nginx boundary, timed backup/restore,
   operations, and end-user evidence.

Each slice must be independently reviewable. ATTACH-01 remains `PLANNED` until
all three owners, security controls, performance gates, and recovery behavior
are verified. A slice may expose only its complete owner surface; no generic
upload control is shown early. The employee guide and operations handoff change
only when the corresponding behavior exists.

ATTACH-01 becomes delivered only when `SEC-01` is delivered and
`pnpm test:attachments`, repository-wide
verification, production builds, Compose health, the controlled restore drill,
the performance report, and the security review all pass with no known
high-severity finding. Until then the implementation can be reviewed and tested,
but it is not a production-enabled feature.

## Out of scope

- A general Project document library, folders, tags, search, bulk download, or
  document collaboration.
- Attachments on Operational coordination data, Active project queue entries,
  Customer follow-up schedules, Decision Review, Markdown templates, or
  Specification versions.
- Fetching or retaining Customer inbound attachment content.
- Sending Question Bank reference files or Project work attachments in Customer
  communication.
- Public links, Customer upload portals, external sharing, or anonymous access.
- Browser preview, thumbnails, OCR, extraction, indexing, conversion, or
  content-derived AI processing.
- Resumable or chunked upload sessions and HTTP byte-range downloads; the 50 MiB
  bound, progress, cancel, and idempotent full-request retry are the v1 behavior.
- File replacement in place, cross-Project deduplication, attachment inheritance
  through Discovery follow-up source linkage, or implicit copying to later
  Initial Intake rounds.
- Authentication and role provisioning delivered by `SEC-01`.
- Object-storage adoption unless the recorded PostgreSQL performance, capacity,
  WAL, backup, or restore evidence fails its acceptance gate.
