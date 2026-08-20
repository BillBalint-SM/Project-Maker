# ATTACH-01 governed discovery attachments

**Status:** Accepted design, pending implementation.

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

The first delivery supports PNG, JPEG, WebP, PDF, TXT, CSV, DOC, DOCX, XLS,
XLSX, PPT, and PPTX. Every accepted type is downloaded as a file; active
document content is never rendered inline.

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
list(owner) -> attachment summaries
upload(owner, bounded file stream) -> available attachment summary
remove(owner, attachment identity) -> removal result
download(owner, attachment identity) -> verified download stream and headers
```

`owner` is a discriminated domain reference, not a free-form
`targetType + targetId` pair. Question Bank, Initial Intake, and Discovery
follow-up callers do not reproduce attachment policy.

The module has two replaceable internal seams:

- a content scanner with a production malware-scanning adapter and a
  deterministic test adapter;
- a content repository with PostgreSQL and in-memory test adapters.

The first production implementation stores bounded binary content in
PostgreSQL. This preserves the existing durable-state, transaction, backup, and
restore boundary. The attachment interface hides this decision so measured
capacity or operational evidence can later justify object storage without
changing the owning domains.

## Persistence

Use one immutable content record and typed relationship tables:

- `stored_file_contents`: stable UUID, binary content, verified media type,
  byte size, SHA-256 integrity digest, and creation timestamp.
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

Migration rollback must refuse to drop retained attachment content. Reversal
requires an explicit destructive migration or a verified export.

## Contracts and HTTP

Shared contracts expose an `AttachmentSummary` with relationship identity, safe
original name, verified media type, byte size, creation time, and attachment
kind. They never expose content IDs, scanner output, storage details, or local
paths.

Every operation is parent-scoped:

- Question Bank question reference-file list and successor-publication changes;
- Project, round, and checklist-snapshot Project work attachments;
- Project and Discovery-follow-up Project work attachments.

Downloads return the exact retained bytes with a safe RFC-compatible filename.
There are no public, bearer-token, or permanent direct-storage URLs.

Uploads use `multipart/form-data`, stream into a bounded request-scoped temporary
location, and never buffer an unbounded request in memory. Success means the
file passed policy and malware scanning and that its content plus typed
relationship committed transactionally. Timeout, scanner failure, validation
failure, or database failure returns no attachment summary.

## File and security policy

- Default maximum: 25 MiB per file, configurable downward.
- Default maximum: 20 attachments per owner.
- Configurable aggregate limits apply to one Project and the current Question
  Bank; the server rejects before durable commit when a limit would be exceeded.
- Extension, declared media type, and content signature must agree.
- Empty files, executables, scripts, HTML, SVG, archives, macro-enabled Office
  formats, and encrypted or otherwise unscannable content are rejected.
- Filenames are Unicode-normalized, stripped of path segments and control
  characters, and capped at 255 characters. Internal identities are generated.
- Scanner unavailability fails closed with actionable Hungarian guidance and no
  scanner diagnostics.
- Downloads use `Content-Disposition: attachment`, the verified media type,
  `X-Content-Type-Options: nosniff`, and a bounded `Content-Length`.
- ATTACH-01 never executes, transforms, indexes, OCRs, parses into Markdown, or
  renders uploaded content.
- Logs never contain bytes, filenames, question text, answers, or follow-up
  content. Audit records retain only the relationship identity, owner kind,
  operation, and bounded byte size.

The current VPN-trusted model cannot prove a caller is a specific employee.
ATTACH-01 follows the current internal access boundary; `SEC-01` authentication,
authorization, rate limiting, and actor attribution remain mandatory before
multi-user or broader network exposure.

## Web behavior

One reusable presentation module receives domain-owned labels and mutation
policy from each consuming feature. It provides:

- a labelled native file input with optional drag-and-drop enhancement;
- file name, verified type, formatted size, creation time, and download action;
- per-file progress and an accessible live status region;
- retry after transport failure without inventing a retained attachment;
- confirmed removal only where the owner is mutable;
- distinct empty, loading, policy-rejection, scan-failure, and stale-list states;
- keyboard-operable native download links and buttons.

Initial Intake shows `Kérdésbanki segédanyagok` and `Projektcsatolmányok` as
separate groups. Discovery follow-ups show `Projektcsatolmányok` in the owning
card without calling the work item a generic task. Archived and resolved
contexts show downloads without upload or remove controls.

Question Bank file selections remain local view state until the successor
version request succeeds. A failed request leaves the published bank unchanged.

## Failure and concurrency rules

- After mutation, the newest list request wins; a stale response cannot restore
  a removed entry.
- Upload and removal lock and revalidate the owning record on the server.
- Question Bank changes use the existing publication lock and reject an obsolete
  bank version instead of applying files to the latest version implicitly.
- Discovery follow-up resolution racing with upload or removal has one
  serializable outcome: the attachment commits before resolution or mutation is
  rejected after resolution.
- A failed list refresh retains the last successful list and marks it stale. An
  initial list failure exposes a targeted retry.
- A client disconnect never makes partially received content available.
- Temporary files are request-scoped and cleaned after success, rejection,
  disconnect, and startup recovery.

## Required verification

- Contract tests cover summaries, kinds, policy identifiers, and absence of
  storage details.
- Nest HTTP integration tests use real PostgreSQL and deterministic scanner
  behavior to prove exact-byte download, Hungarian filenames, safe headers,
  policy rejection, quotas, parent mismatch, and transaction cleanup.
- Migration tests prove foreign keys, indexes, guarded rollback, Project
  deletion behavior, and historical Question Bank preservation.
- Question Bank tests prove successor publication, obsolete-version conflict,
  unchanged-content reuse, and historical Project schema stability.
- Initial Intake tests prove open, Ended-review, sent-handoff, later-revision,
  and archived lifecycle rules without sending attachments to Customers.
- Discovery follow-up tests prove open-only mutation, resolution races,
  unchanged edit version, source-link independence, resolved download, and
  archived read-only behavior.
- Security tests cover traversal filenames, Unicode/control characters, MIME
  spoofing, active content, encrypted or unscannable files, header injection,
  and unavailable-scanner behavior.
- Playwright uses real file chooser and download flows for one Question Bank
  reference file, one Initial Intake attachment, and one Discovery follow-up
  attachment, including keyboard operation, recovery, narrow layout, resolution,
  and archive behavior.
- Backup/restore verification proves retained bytes and integrity digests survive
  the supported platform recovery procedure.

## Delivery slices

1. Add shared contracts, file policy, PostgreSQL repository, scanner seam,
   guarded migration, and attachment-module integration tests.
2. Deliver Question Bank reference files with successor-publication semantics
   and Frozen Project question schema retrieval.
3. Deliver Initial Intake checklist attachments under the existing Interview
   review and handoff editability rules.
4. Deliver Discovery follow-up attachments, resolution concurrency, archive
   behavior, and guarded Project deletion.
5. Complete browser flows, operational limits, backup/restore proof, security
   review, and delivery documentation.

Each slice must be independently reviewable. ATTACH-01 remains `PLANNED` until
all three owners, security controls, and recovery behavior are verified. The
employee guide and operations handoff change only when the corresponding
behavior exists.

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
- File replacement in place, cross-Project deduplication, attachment inheritance
  through Discovery follow-up source linkage, or implicit copying to later
  Initial Intake rounds.
- Authentication and role provisioning delivered by `SEC-01`.
- Object-storage adoption without measured PostgreSQL capacity and operational
  evidence.
