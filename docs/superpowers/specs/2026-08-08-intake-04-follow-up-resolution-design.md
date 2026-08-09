# Discovery Follow-up Resolution Design

**Status:** approved design; not implemented
**Feature:** `INTAKE-04.2` — resolve an accountable discovery follow-up
**Date:** 2026-08-08

## Outcome

The next bounded `INTAKE-04` slice lets a user record the answer or rationale
for an existing discovery follow-up and close it as either `Megválaszolva` or
`Nem releváns`. The updated item stays visible in the project cockpit, retains
its original question and ownership data, and can later contribute to the
readiness calculation without reinterpreting its history.

`INTAKE-04.1` already creates and lists durable discovery follow-ups. This
slice does not turn that resource into a general editor. It adds exactly one
one-way, explicit user behaviour: resolve an unresolved item.

## Decisions

| Decision | Chosen behaviour | Reason |
| --- | --- | --- |
| Interaction shape | A targeted resolve command, not a generic item `PATCH` | It keeps the state transition small, explicit, and auditable without prematurely delivering general editing. |
| Allowed target statuses | Only the playbook's readiness `resolvedFollowUpStatuses`: currently `Megválaszolva` and `Nem releváns` | The readiness policy, rather than a second local list, defines what counts as resolved. |
| Resolution content | A trimmed, nonblank `decisionOrAnswer` is required for either target status and is at most 10,000 characters | A recorded answer is required for a useful closed discovery item; an irrelevance decision also needs its rationale. |
| Repeat resolution | A resolved item cannot be resolved again in this slice | It prevents silent overwrites and duplicate audit events. Reopen/edit is separate future work. |
| Archive boundary | Read remains available; resolution is rejected while the project is archived and works again after restore | This matches the existing retained, read-only archive lifecycle. |
| Audit | One `DISCOVERY_FOLLOW_UP_RESOLVED` event stores only `followUpId` and target `status` | The answer/rationale and other free text remain in the domain record, not in bounded audit payloads. |
| Status authority | API and web consume the resolved status values from the shared canonical playbook contract | The immutable `general` v1 contract remains the only status-policy source. |
| Cockpit language | New controls retain the current Cockpit's English wording | Full cockpit localization is not part of this bounded resolution slice. |

## External interface

```text
POST /projects/:projectId/discovery-follow-ups/:followUpId/resolve
```

The request accepts exactly this shape:

```ts
interface ResolveDiscoveryFollowUpInput {
  readonly status: string; // one canonical resolved follow-up status
  readonly decisionOrAnswer: string;
}
```

The DTO validates type, presence, and length. The service trims the text and
checks the requested status against
`generalPlaybookV1.scoring.readiness.resolvedFollowUpStatuses` after loading
the immutable runtime contract. It does not maintain a local status enum or
literal status list.

On success, the endpoint explicitly returns `200 OK` with the fully updated
`DiscoveryFollowUp`; `@HttpCode(HttpStatus.OK)` avoids NestJS's default `201`
for a `POST` route that updates an existing resource. The response model adds
this field:

```ts
readonly decisionOrAnswer: string | null;
```

Unresolved current and historical items return `null`; successfully resolved
items return the normalized stored text. List ordering remains due date,
creation time, then ID.

| Condition | Result |
| --- | --- |
| Existing project and unresolved item with valid input | `200 OK` and the updated follow-up |
| Missing project or follow-up that does not belong to the project | `404 Not Found` |
| Invalid UUID | Existing `ParseUUIDPipe` `400` behaviour |
| Blank/overlong answer, non-string fields, noncanonical target status, or extra fields | Sanitized `400` validation error |
| Archived project | `409 Conflict` |
| Already resolved follow-up | `409 Conflict` |

Error responses must not echo submitted answer text, question text, owner,
next step, SQL, table names, or stack details.

## Persistence and transaction design

Migration `0007` adds nullable `decision_or_answer text` to
`discovery_follow_ups`. Null is necessary for the valid unresolved records
created by `INTAKE-04.1`; the supported write path enforces a nonblank value
when moving to a resolved status. No status-dependent database check duplicates
the versioned playbook policy.

Resolution runs in one transaction:

1. Lock the project with the established pessimistic-write pattern.
2. Return `404` for a missing project and `409` when it is archived.
3. Lock and load the target row constrained by both project ID and follow-up
   ID; return `404` when it is absent.
4. Load and validate the canonical resolved-status policy, reject an already
   resolved row, and normalize the answer/rationale.
5. Persist the new status and `decision_or_answer`; the existing update trigger
   advances `updated_at`.
6. Persist one safe resolution audit event in the same transaction.

The command does not alter the direct retained-activity deletion guard. A
resolved discovery follow-up remains retained project activity and still
prevents physical project deletion.

## Audit policy

The resolution writes exactly one event:

```json
{
  "followUpId": "uuid",
  "status": "Megválaszolva"
}
```

Its event type is `DISCOVERY_FOLLOW_UP_RESOLVED`. The payload never contains
`decisionOrAnswer`, question, owner, next step, due date, or client-submitted
free text.

## Cockpit behaviour

Each unresolved discovery follow-up renders a stable-test-ID `Resolve
follow-up` action. Opening it reveals an inline reactive form with:

- a status selector populated from the shared resolved-status policy;
- a required answer/rationale text area; and
- save and cancel controls.

The form is disabled during its own request, other Cockpit mutations, or while
the project is archived. On success, the client replaces the returned item in
the local ordered list, resets/closes the inline form, refreshes audit history,
and exposes the existing success surface. A resolved item displays its answer
or rationale and has no resolution action. The list remains readable after an
archive and after browser reload.

The feature uses the existing Cockpit error surface and no mocked HTTP
responses. It does not add an edit affordance, a delete action, a reopen
control, or a status selector for `Nyitott`, `Folyamatban`, or `Blokkolt`.

## Scope

### In scope

- Shared resolution input/output types and canonical resolved-status access.
- Migration `0007`, entity mapping, resolve command, service transaction, and
  safe audit event.
- Cockpit inline resolution UI and archive read-only behaviour.
- Real PostgreSQL API E2E, real-browser Playwright coverage, and current-state
  documentation after verification.

### Explicit non-goals

- Editing category, question, owner, due date, next step, or a stored answer.
- Reopening, cancelling, deleting, bulk resolution, or the `Folyamatban` and
  `Blokkolt` transitions.
- Source checklist linkage, interview context selection, automatic question
  discovery, readiness calculation, gap navigation, or a Decision Score UI.
- Customer-email follow-up settings, reminders, notifications, background
  workers, authentication, authorization, or collaboration conflict handling.
- A new playbook version, global Angular/PrimeNG/dependency work, or legacy
  desktop changes.

## Acceptance criteria

1. From the Cockpit, a user can resolve an existing discovery follow-up as
   `Megválaszolva` or `Nem releváns` with a required answer/rationale and sees
   the persisted result after reload.
2. Only the canonical resolved status values from the shared playbook are
   accepted; the application has no second resolved-status vocabulary.
3. The answer/rationale is trimmed, nonblank, at most 10,000 characters, and
   never appears in an audit payload or sanitized error response.
4. An archived project continues to expose resolved and unresolved records but
   rejects and disables resolution; restoring it re-enables resolution of an
   unresolved record.
5. A resolved follow-up cannot be resolved again and produces no duplicate
   audit event.
6. Successful resolution writes exactly one `DISCOVERY_FOLLOW_UP_RESOLVED`
   audit event containing only `followUpId` and `status`.
7. Existing create/list behaviour, customer email scheduling, and project
   deletion retention continue to work unchanged.
8. No general edit, reopen, source-linkage, or scoring capability is presented
   as delivered.

## Risks and controls

| Risk | Control |
| --- | --- |
| Status policy drifts from scoring | Read resolved status values from the canonical playbook at runtime and prove membership in contract tests. |
| A second resolution silently overwrites the first | Lock the row, reject terminal state with `409`, and assert one audit event. |
| Free-text answer leaks into audit or errors | Store it only on the follow-up row; test audit payload and invalid-response redaction. |
| Archive races with a resolution | Lock the project in the same transaction and block archived writes. |
| Scope grows into full editing or score work | Expose only the targeted command and inline resolution form; keep all other controls absent. |
| Existing rows cannot migrate safely | Add a nullable column and exercise migrations from a fresh isolated PostgreSQL database. |

## Verification plan

### Contracts and migration

1. Prove that the shared resolution status set equals the canonical playbook
   readiness policy and remains a subset of the follow-up status vocabulary.
2. Apply migrations `0001` through `0007` to a fresh, isolated PostgreSQL
   database and verify that existing unresolved rows may retain a null answer.
3. Confirm the migration changes only the discovery-follow-up table and leaves
   customer-email tables and the immutable general v1 JSON unchanged.

### API integration

Use the existing real PostgreSQL E2E suite to prove:

1. successful resolution, normalized answer persistence, response shape, list
   reload, and deterministic ordering;
2. invalid answer/status/extra-field, missing-project, missing-follow-up,
   archived-project, and repeated-resolution behaviour;
3. exact single-event audit type and two-key non-sensitive payload; and
4. existing discovery-create/list, deletion-retention, and customer-follow-up
   regression tests still pass.

### Browser integration

Add a focused Playwright spec using real API setup and stable `data-testid`
selectors. It creates a project and discovery follow-up, resolves it through
the Cockpit, verifies the returned status and answer, reloads, then archives
the project and confirms the resolution control is disabled or absent while
the data remains visible. A restore path proves an unresolved item can be
resolved after restore.

### Completion gate

Run focused contract/API/web checks first, then the repository `verify` and
full browser E2E commands with the compatible local Node 26 / pnpm 11.20
runtime and a fresh isolated PostgreSQL database. Review migration scope,
audit payloads, stable selectors, documentation links, `git diff --check`, and
the final worktree before any Git publication decision.

## Documentation after verified delivery

Only after the acceptance criteria and full verification pass:

- add an `INTAKE-04.2` delivered entry while leaving the broader `INTAKE-04`
  requirement incomplete for editing and source linkage;
- update `.planning/STATE.md`, `docs/product-domain.md`, and
  `docs/operations-handoff.md` with migration seven and verified resolution
  behaviour; and
- keep `docs/README.md` as the concise index of the design and implementation
  evidence.

## Documentation basis

The design follows the established project transaction, command-route,
ValidationPipe, reactive-form, TypeORM migration, and real-integration-test
patterns. Context7 was consulted for NestJS strict whitelisting/forbidden extra
fields and Angular reactive-form touched/disabled-control behaviour; those
facts were validated against the existing repository configuration and UI
patterns rather than copied as standalone examples.
