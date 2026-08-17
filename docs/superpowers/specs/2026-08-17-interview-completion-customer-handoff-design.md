# INTAKE-06 — Interview completion and versioned customer handoff

**Status:** Proposed implementation contract — 2026-08-17

**Scope:** Initial Intake meeting completion, named next-action ownership, and versioned customer email handoff

**Authoritative product direction:** the employee can always end a running interview regardless of whether an item is `Kész`, `Részben megvan`, `Nem releváns`, or incomplete. A customer handoff may happen immediately or after review. Customer feedback or a modification request starts a new editable handoff version without rewriting an earlier sent package.

## Outcome

An internal PO/PM conducts the Initial Intake with the named customer contact, records the answers and assessments, and ends the meeting without a business-completeness gate. The ended interview remains the current working record. The employee can send its first customer handoff immediately or later, then create, edit, and send numbered correction versions when customer feedback requires a change.

Every SMTP-accepted package remains an immutable historical snapshot. Sending a package does not make the interview round permanently immutable.

Project coordination identifies the concrete person who owns the next action. Employee-facing product language uses `Következő lépés felelőse`, never `Ball owner`.

## Authoritative decisions

1. Ending a meeting and determining readiness are separate concerns. Missing, partial, or not-relevant answers create readiness consequences; they do not prevent the meeting from ending.
2. A required `Nem releváns` assessment still requires a nonblank rationale before that assessment itself can be saved. This is assessment validity, not an interview-completion gate.
3. Meeting lifecycle and handoff lifecycle are orthogonal:
   - interview round: `OPEN | ENDED`;
   - handoff version: `DRAFT | SENDING | SENT | FAILED | UNKNOWN`.
4. `OPEN` means the meeting is in progress. `ENDED` means the meeting ended; it does not mean the interview can never be revised.
5. Existing `COMPLETED` Initial Intake rounds migrate to `ENDED`, preserving all answers and allowing a first handoff or later revision.
6. The first customer package is version `1`. Every later correction is a new monotonically increasing version; sent versions are never updated in place.
7. After a version is sent, the working interview is protected from accidental edits until the employee selects `Új verzió készítése`.
8. Starting a new version makes the working interview editable again and records which sent version it supersedes. Version `2+` requires a nonblank `Módosítás összefoglalása` before preview or send.
9. A technical write failure may prevent the product from claiming work was saved. No business status or readiness condition may block `OPEN -> ENDED`.
10. `Mentés és küldés` means end the meeting and proceed directly to the first-version send confirmation. It does not bypass a visible recipient/content preview or explicit confirmation.
11. The recipient is always the project's currently configured customer contact email. The recipient name and email are snapshotted separately for every sent version.
12. The next-action owner has exactly two roles in this slice: `INTERNAL_OWNER` and `CUSTOMER_CONTACT`. The UI renders the selected role with the corresponding concrete person's name.
13. New projects require a named internal owner. Existing projects may remain without one until edited, but the UI identifies that missing prerequisite precisely.
14. The existing SMTP Adapter is reused. Interview revision, projection, rendering, delivery, history, and audit belong to a dedicated Interview Customer Handoff Module; they do not become Customer follow-up state.
15. Archived projects and historical sent versions are readable. Editing, starting a version, and sending are unavailable while the project is archived.
16. Inbound email ingestion, automatic reply parsing, arbitrary recipients, attachments, scheduled sending, and delivery/open tracking remain out of scope.

## Ubiquitous language

| Term | Meaning | Avoid |
|---|---|---|
| Internal project owner | The named PO/PM user who operates Project Maker for the project and conducts the interview. | Anonymous internal user, project role list |
| Customer contact | The named external person who participates in the interview and receives handoffs at the configured email address. | Arbitrary email recipient |
| Next-action owner | The concrete internal owner or customer contact who currently has the next action. | Ball owner, unqualified owner string |
| Ended interview | A meeting that has ended independently of information completeness. Its working record may support a current handoff draft. | Immutable completed round, readiness approval |
| Interview review | An editable review interval after the meeting ends, for the first package or a later correction version. | One-time pre-send state |
| Interview handoff version | One numbered, immutable question-and-answer snapshot accepted for SMTP delivery. | Mutable interview, customer follow-up ping |
| Interview revision draft | The single editable next version based on the latest sent version and current working interview. | Rewriting a sent package |
| Modification summary | The employee-written, customer-visible explanation of what changed in version `2+`. | Raw inbound email, diagnostic audit text |

## User journey

### Conduct and end the meeting

1. The internal owner opens the Initial Intake interview.
2. The page identifies the internal owner and customer contact by name.
3. The internal owner asks the questions and saves answers and assessments continuously.
4. The page presents two meeting-end actions:
   - `Mentés, később küldöm`
   - `Mentés és küldés`
5. Either action waits for currently pending answer and assessment writes.
6. If a write failed, the page identifies the affected question and offers retry or explicit discard of that unsaved local change. It never claims unsaved data was persisted.
7. When writes are settled, either action changes the round from `OPEN` to `ENDED`, regardless of answer completeness or assessment status.
8. The finish command establishes the first editable handoff draft as version `1`.
9. `Mentés, később küldöm` shows the ended interview with an `Előnézet és küldés` action.
10. `Mentés és küldés` opens the version-1 handoff preview immediately.

### Review and send a version

1. An `ENDED` round with an active `DRAFT` remains editable through the same question cards.
2. The preview shows version, fixed recipient name and email, subject, modification summary when applicable, and the exact body that the Adapter will receive. It returns a round version and opaque preview digest.
3. `Küldés az ügyfélnek` requires an explicit confirmation and has one in-flight state. The send command supplies the preview version and digest.
4. An Adapter-accepted delivery records an immutable `SENT` handoff version, closes the active draft, and shows its version, timestamp, and recipient.
5. After sending, the interview opens read-only by default and offers `Új verzió készítése`.
6. A known delivery failure changes the active version to `FAILED`, retains its confirmed snapshot, and offers:
   - `Újrapróbálás` for the exact same content;
   - `Vissza a szerkesztéshez` to invalidate that prepared snapshot and return the version to `DRAFT`.
7. An ambiguous delivery result changes the version to `UNKNOWN`. It may be retried only after a warning and explicit acknowledgement of duplicate-send risk; it is never retried automatically.

### Apply customer feedback and resend

1. The employee opens the sent-version history and can inspect every exact prior package.
2. `Új verzió készítése` creates the only active draft with version `latestSentVersion + 1` and a reference to the latest sent version.
3. Creating a draft unlocks the current working interview for editing. It does not clone over or mutate any sent snapshot.
4. The employee manually applies the customer's requested answer/assessment changes.
5. For version `2+`, the employee writes a customer-visible `Módosítás összefoglalása`.
6. The UI marks the interview as containing `Még nem kiküldött módosítások` until the new version is sent.
7. Preview and send use the same digest contract as the first version.
8. The email subject contains the version number. The body states which prior version it supersedes and includes the modification summary.
9. SMTP acceptance closes the draft as a new immutable sent version. Earlier versions remain viewable and unchanged.

Customer feedback is entered manually in this slice. Reading an email inbox or associating an inbound reply with a project is a separate future capability.

### Coordinate the next action

1. Project status and the coordination editor use the label `Következő lépés felelőse`.
2. The selector contains only:
   - `PO/PM – <internalOwnerName>`
   - `Ügyfél – <customerContactName>`
3. If either source name is missing, that option is unavailable and explains which project datum must be completed.
4. The selected owner, next action, and due date are saved atomically.
5. Project status displays Hungarian labels and domain values; raw values such as `DRAFT`, `Ball owner`, `Next action`, and `Due` are not employee-facing copy.

## State and business rules

### Meeting lifecycle

| Current | Command | Result | Business gate |
|---|---|---|---|
| `OPEN` | Finish for later | `ENDED` plus handoff version `1` in `DRAFT` | None |
| `OPEN` | Finish and continue to send | `ENDED` plus version-1 preview | None |
| `ENDED` | Review readiness | `ENDED` | None |
| `ENDED` | Start correction after a sent version | `ENDED` plus next `DRAFT` version | No other active draft |

Completion percentage, readiness, Decision Score, estimate blockers, and discovery gaps are derived independently. They may explain why the project is not ready, but they do not participate in the finish command.

### Handoff version lifecycle

| Current | Command | Result |
|---|---|---|
| no version | Finish meeting | version `1` in `DRAFT` |
| `DRAFT` | Edit interview or modification summary | same `DRAFT`, preview invalidated |
| `DRAFT` | Confirm send | `SENDING` |
| `SENDING` | SMTP acceptance | immutable `SENT` |
| `SENDING` | Known failure | `FAILED` |
| `SENDING` | Ambiguous result or expired lease | `UNKNOWN` |
| `FAILED` | Retry unchanged snapshot | `SENDING` |
| `FAILED` | Return to editing | `DRAFT`, prepared snapshot invalidated |
| `UNKNOWN` | Acknowledged retry | `SENDING` |
| `SENT` | Start new version | new `DRAFT` at version `n + 1`; prior `SENT` unchanged |

Only one active non-`SENT` version may exist for a round. A version number is never reused after an attempt is recorded, even when the attempt fails or becomes unknown.

### Editing rules

- Answers and assessments are editable while the round is `OPEN`.
- An `ENDED` round is editable while it has an active `DRAFT` or a `FAILED` version returned to editing.
- After a version is `SENT`, the working interview is read-only until `Új verzió készítése` establishes the next draft.
- Editing the working interview never mutates a sent snapshot.
- Project archive makes the working interview and active draft read-only without deleting them.

### Save and preview coordination

- The web application tracks every answer/assessment mutation as `idle`, `pending`, `saved`, or `failed`.
- Finish and preview wait while a write is pending and identify that temporary reason accessibly.
- A failed write keeps a deliberate retry/discard workflow available. The server rejects a stale finish or preview version rather than claiming a failed local change was saved.
- A finish error is cleared after its technical blocker is corrected. The message “mandatory answers are missing” is never used for a partial assessment or persistence failure.
- Concurrent round mutation uses the existing version/locking convention. A stale command returns a conflict that reloads current state without discarding unsaved local text.
- Preview is read-only. The server rebuilds the projection under the send lock and compares its digest with the submitted preview digest. A mismatch returns `409 PREVIEW_STALE` and requires a refreshed preview instead of sending unseen content.

### Current Initial Intake source

The current source is the most recently created `OPEN` or `ENDED` Initial Intake round. Sent handoff versions do not participate in current-source selection. Source linkage, readiness, Decision Review, and Markdown generation share the same round helper instead of maintaining separate status lists.

## Data contract and migration

The next migration after the delivered `0013` slice owns these changes.

### Project coordination

- Add nullable `internal_owner_name` for backward compatibility; require it in new-project validation and when sending a handoff.
- Add nullable `next_action_owner_role` constrained to `INTERNAL_OWNER | CUSTOMER_CONTACT`.
- Retain the existing `ball_owner` column only as compatibility storage during this slice. It is not exposed as product language.
- When structured coordination is saved, synchronize `ball_owner` to the selected person's current concrete name. This preserves the delivered general-v1 readiness ownership input without changing policy weights or thresholds.
- For a legacy project with a nonblank `ball_owner`, migrate that value to `internal_owner_name`, set `next_action_owner_role = INTERNAL_OWNER`, and retain the original string. Blank values remain null.
- API reads expose structured next-action ownership, not a free-form `ballOwner` editor.

### Interview round

- Replace the persisted lifecycle with `OPEN | ENDED`.
- Migrate existing `COMPLETED` values to `ENDED` before removing the old value.
- Existing migrated rounds have no handoff history and may create version `1` later.
- Database guards allow answer/assessment writes in `OPEN`, and in `ENDED` only when no sent version exists yet or an active editable draft exists.
- Remove database and service rules that require business-complete answers for `OPEN -> ENDED`.
- Rollback refuses safely when handoff history or an active correction cannot be represented by the old schema; it never discards customer communication history.

### Versioned interview handoff

Persist an `interview_customer_handoffs` aggregate with:

- stable handoff, project, and round IDs;
- positive, per-round version and optional superseded handoff ID;
- handoff state `DRAFT | SENDING | SENT | FAILED | UNKNOWN`;
- required customer-visible modification summary for version `2+`;
- recipient name and email snapshots;
- internal owner name snapshot;
- subject, HTML, and plain-text content snapshots after send preparation;
- preview digest and source round version;
- safe failure code, creation time, attempt time, and sent time.

Constraints enforce one row per round/version, at most one active non-`SENT` version, and immutable snapshot fields after `SENT`.

The send command persists the digest-verified projection before calling the Adapter. SMTP acceptance marks only that handoff version `SENT`; it does not claim that the recipient opened or received the email. A known failure marks `FAILED`. An indeterminate result marks `UNKNOWN`. A stale `SENDING` lease reconciles to `UNKNOWN` and is never silently resent.

## Interfaces and module boundaries

### Round Interface

- `POST /projects/:projectId/rounds/:roundId/finish` — idempotently moves `OPEN` to `ENDED` and establishes version `1`; returns the current ended/draft state when already ended; rejects foreign, archived, or missing rounds.
- Existing answer and assessment write Interfaces accept `OPEN`, and accept `ENDED` only while the handoff Module reports an editable active draft.
- The existing completion endpoint is deprecated and routed to finish semantics for one compatibility interval; new web code does not call it.

### Handoff Interface

- `GET /projects/:projectId/rounds/:roundId/customer-handoffs` — returns ordered version metadata without full content.
- `GET /projects/:projectId/rounds/:roundId/customer-handoffs/:handoffId` — returns one authorized immutable sent snapshot or the current draft state.
- `POST /projects/:projectId/rounds/:roundId/customer-handoffs` — starts version `1` when an ended legacy round has none, or starts `latestSentVersion + 1`; rejects when an active version exists.
- `PUT /projects/:projectId/rounds/:roundId/customer-handoffs/:handoffId/draft` — updates the modification summary only for the active editable version.
- `GET /projects/:projectId/rounds/:roundId/customer-handoffs/:handoffId/preview` — performs no write and returns recipient, subject, rendered bodies, source version, and opaque preview digest.
- `POST /projects/:projectId/rounds/:roundId/customer-handoffs/:handoffId/send` — verifies expected source version and preview digest under a row lock, persists the exact projection, and attempts delivery.
- `POST /projects/:projectId/rounds/:roundId/customer-handoffs/:handoffId/retry` — retries stored content for `FAILED`, or for `UNKNOWN` with explicit duplicate-risk acknowledgement.
- `POST /projects/:projectId/rounds/:roundId/customer-handoffs/:handoffId/resume-editing` — invalidates a failed prepared snapshot and returns that version to `DRAFT`; it is unavailable for `UNKNOWN` or `SENT`.

Project create/update and Project status Interfaces expose:

- `internalOwnerName`;
- `nextActionOwnerRole`;
- a derived `nextActionOwner` object containing role, concrete display name, and whether its source data is complete.

### Interview Customer Handoff Module

The Module owns the deep Implementation of:

- version allocation and single-active-draft invariants;
- edit eligibility for an ended round;
- immutable question/answer/assessment projection;
- subject and body rendering;
- preview digest and stale-preview protection;
- persistence, delivery state, retry, and history;
- SMTP Adapter coordination;
- redacted audit mapping.

Its Interface accepts project ID, round ID, handoff ID, and one command. Controllers do not assemble email content. The Round Module asks one edit-eligibility question instead of duplicating handoff states. Customer Follow-up does not gain interview-specific branches.

SMTP provider registration moves to a small `MailDeliveryModule` that exports the existing Adapter token and `SmtpMailerService`. Customer Follow-up and Interview Customer Handoff both depend on that Interface; neither imports the other's Module or copies SMTP configuration.

The handoff projection includes, in schema order:

- project name;
- customer contact name;
- internal owner name;
- interview/round date;
- handoff version and superseded version when applicable;
- modification summary for version `2+`;
- each question's order, topic, text, saved answer or `Nincs rögzített válasz`, effective status, and `Nem releváns` rationale.

It excludes raw IDs, audit codes/payloads, readiness and Decision Score internals, unrelated follow-ups, credentials, and diagnostic metadata. Preview and send call the same renderer. The digest proves that the locked projection is byte-for-byte equal to the confirmed preview; retry uses the stored prepared content.

### Web Interview Handoff Module

A project-scoped `InterviewHandoffComponent` owns version history, draft creation, modification summary, preview, confirmation, sending, failure, retry, and sent states. Its Interface receives project ID, round ID, and meeting status, then emits meeting/draft/handoff changes. The interview page owns question navigation and autosave; Project status never duplicates handoff logic.

The confirmation follows the application's shared PrimeNG z-index/topmost rule and restores focus to the invoking control on cancel, failure, and success navigation.

## Email contract

- Recipient: the current configured `customerContactName <customerContactEmail>` at send time; each version snapshots both.
- Version 1 subject: `Project Maker – Interjú-összefoglaló – <projectName> – 1. verzió`.
- Version 2+ subject: the same pattern with its actual version number.
- Version 2+ body identifies the superseded version and shows `Módosítás összefoglalása` before the interview content.
- Language: Hungarian for the delivered general-v1 journey.
- Sender envelope: existing SMTP configuration.
- Visible sender context: internal owner name in the body, not a spoofed From address.
- Format: accessible HTML plus equivalent plain text from the same projection.
- No attachment in this slice.

## Audit and privacy

Employee-visible activity includes:

- `Az interjú meetingje lezárva; az összefoglaló szerkeszthető.`
- `Az interjú-összefoglaló 1. verziója elküldve az ügyfélnek.`
- `Az interjú-összefoglaló új verziója szerkesztés alatt.`
- `Az interjú-összefoglaló <n>. verziója elküldve az ügyfélnek.`
- `Az interjú-összefoglaló küldése sikertelen; újrapróbálható.`

Diagnostic audit events may contain project ID, round ID, handoff ID, version, lifecycle/delivery state, timestamps, field names, and content lengths. They exclude answers, questions, rationales, modification summary, rendered content, recipient email, contact/internal-owner names, SMTP response text, and credentials.

## Accessibility and interaction contract

- Finish, start-version, preview, send, cancel, resume-editing, and retry controls have Hungarian accessible names.
- Pending save and delivery states use a programmatically associated status message.
- Failure summaries identify the actionable step and move focus predictably without discarding a draft.
- Version history and exact sent snapshots are keyboard reachable.
- The preview is readable without opening a modal trap.
- The send confirmation is the topmost Escape owner; one Escape closes only one surface.
- Cancel restores focus to its trigger. Successful send moves focus to the new sent-version heading.
- Mobile layout keeps meeting-end and active-draft actions reachable after the final question without returning to the page top.

## Expected file map

This map names ownership. The implementation plan may add colocated DTO, entity, style, and focused test files, but does not move handoff behavior into the Cockpit shell.

| Area | Expected files |
|---|---|
| Shared contracts | `packages/contracts/src/interviews.ts`, `packages/contracts/src/projects.ts`, new `packages/contracts/src/interview-customer-handoffs.ts`, `packages/contracts/src/index.ts` |
| Migration | new `apps/api/src/migrations/0014-interview-customer-handoff.ts`, `apps/api/src/database/migration-sequence.ts`, `apps/api/test/migration-sequence.spec.ts`, `apps/api/test/round-integrity.e2e-spec.ts` |
| Round lifecycle | interview round entity, current-source helper, Interviews controller/implementation, and colocated DTOs |
| Handoff deep Module | new `apps/api/src/interview-customer-handoffs/` controller, Module, implementation, entities, DTOs, renderer, and focused tests |
| Shared email Adapter | move provider ownership from `apps/api/src/follow-ups/smtp-mailer.service.ts` into new `apps/api/src/mail-delivery/`; update Follow-up Module without changing its behavior |
| Named coordination | project entity, project DTO/implementation, Project Preparation status implementation, and contract/API tests |
| Interview web journey | Interview Interface, interview page files, and new colocated `interview-handoff/` Module files |
| Project web journey | project models/Interface, project creation, Project status, and existing coordination editor files |
| Browser contracts | guided-intake, project-start, Project status, and a focused customer-handoff/version-history spec |
| Delivery documentation | `CONTEXT.md`, `docs/product-domain.md`, user guide, operations handoff, roadmap/state, and sanitized user-guide assets |

## Implementation order

### 1. Lock the orthogonal contracts with failing tests

Add DB-free contract tests for `OPEN | ENDED`, handoff-version states, structured next-action ownership, version history, preview/send results, and redacted audit shapes. Add focused tests proving every answer-state combination may end a meeting.

**Complete when:** tests fail only because ended meetings, structured ownership, and versioned handoff Interfaces do not exist.

### 2. Migrate meeting and coordination data

Implement migration, entity changes, legacy transformation, database guards, and guarded rollback. Centralize the current-source round sequence.

**Complete when:** migration tests prove `COMPLETED -> ENDED`, legacy-owner preservation, version constraints, edit eligibility, sent-snapshot immutability, and non-destructive rollback refusal.

### 3. Separate meeting finish from readiness

Replace completion-gate logic with the finish command, retain all readiness gaps, and establish version `1` without requiring business completeness.

**Complete when:** missing, partial, complete, and not-relevant answers all permit `OPEN -> ENDED`, while readiness remains accurate.

### 4. Deliver named next-action ownership

Add the internal owner datum, structured role selection, compatibility synchronization, Hungarian status labels, and project create/edit validation.

**Complete when:** both actor choices render concrete names, legacy data remains readable, and no employee-facing `Ball owner` copy remains.

### 5. Build versioned handoff depth

Implement version allocation, active-draft rules, projection, renderer, history, preview digest, persistence, send/retry/resume-editing, SMTP Adapter invocation, and redacted audit mapping with a fake Adapter.

**Complete when:** focused tests prove sequential versions, immutable sent history, one active draft, required version-2 summary, stale-preview rejection, fixed recipient snapshots, immutable retry content, failure/unknown handling, stale-sending reconciliation, single-flight protection, and audit privacy.

### 6. Integrate the complete interview journey

Add both meeting-end actions, save coordination, first draft, version history, start-version, editable correction, modification summary, preview/confirmation, send/retry/resume-editing, focus lifecycle, and accurate error recovery.

**Complete when:** real-browser tests cover finish-for-later, immediate first send, version-2 editing/resend, historical version inspection, partial/missing inputs, failed delivery paths, stale writes, archive protection, and keyboard operation.

### 7. Documentation and delivery verification

Update user guide, product domain, operations handoff, roadmap/state, Interface documentation, and sanitized screenshots. Document SMTP configuration, version history, manual customer-feedback capture, and the no-automatic-retry rule.

**Complete when:** targeted API/web tests, full suites, typechecks, production builds, migration guard tests, disposable real-PostgreSQL tests, and container smoke all pass without fixture projects appearing in the normal UI.

## Acceptance criteria

- A running interview ends with any mixture of `Nincs meg`, `Kész`, `Részben megvan`, and valid `Nem releváns` statuses.
- Ending never converts incomplete information into readiness; the same gaps remain visible.
- An ended interview supports an editable first handoff draft.
- The immediate path ends the meeting and leads to explicit version-1 preview/send confirmation.
- Every SMTP-accepted package is an immutable numbered snapshot.
- Sending a package does not permanently freeze the interview working record.
- `Új verzió készítése` creates exactly one next draft and unlocks editing without changing prior sent versions.
- Version `2+` requires and sends a modification summary and identifies the superseded version.
- Preview and SMTP content are byte-for-byte equivalent; a post-preview edit forces a new preview.
- A known failure remains retryable with identical content or may return to editing; an ambiguous result is never retried automatically.
- Only one delivery attempt and one active draft may exist concurrently for a round.
- Every sent version remains independently readable with its recipient and timestamp snapshots.
- Project status names the concrete next-action owner and uses Hungarian domain language.
- No employee-facing surface contains `Ball owner`.
- Existing nonblank legacy ownership and completed-round answers survive migration.
- Audit, logs, and errors do not expose interview, modification, or contact content.
- Archive/restore, source linkage, readiness, Decision Review, Markdown generation, and discovery follow-ups use the correct current ended/open round rather than handoff status.

## Explicit non-goals

- User accounts, authentication, permission administration, or employee-directory selection.
- Automatic reading or parsing of customer email replies.
- Multiple recipients, CC/BCC, attachments, scheduled delivery, inbound replies, or delivery/open tracking.
- Editing a sent version in place or deleting sent history.
- Changing general-v1 readiness weights, thresholds, or Decision Score policy.
- Folding interview handoffs into Customer follow-up scheduling.
