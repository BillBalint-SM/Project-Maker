# INTAKE-04.3a Discovery Follow-up Editing Design

**Status:** approved design
**Feature:** `INTAKE-04.3a` — edit an open discovery follow-up
**Date:** 2026-08-10

## Outcome

An employee can correct the accountable working details of an open (`Nyitott`)
discovery follow-up without changing its lifecycle meaning. The edited record
keeps its identity, project, status, decision or answer, and history. A
successful real change is safe to retry, visible after reload, and adds one
redacted audit event.

This is a narrow continuation of the delivered `INTAKE-04.1` creation/review
and `INTAKE-04.2` resolution workflows. It does not turn discovery follow-ups
into a generic task system or a broad collaboration feature.

## Scope and non-goals

### In scope

- Edit the category, question, owner, date-only due date, and next step of one
  open discovery follow-up.
- Use a record version to reject stale edits without silently overwriting a
  colleague's edit or a completed resolution.
- Preserve the employee's unsaved edit draft after a conflict until they
  explicitly reload the current record or cancel.
- Add one safe, field-name-only audit event for every successful real edit.
- Add real PostgreSQL API E2E and real-browser Playwright proof.

### Explicit non-goals

- Editing `Megválaszolva` or `Nem releváns` records; reopening or resolving a
  record through the edit route; changing a decision or answer through edit.
- Deleting discovery follow-ups, changing their project, or adding source
  checklist-item linkage. Optional source linkage remains `INTAKE-04.3b`.
- Readiness/scoring changes, customer e-mail scheduling, lifecycle changes,
  authentication/authorization, notifications, or a generic multi-client
  collaboration framework.
- New dependencies, changes to the immutable general v1 playbook, or changes
  to the Angular production style budgets.

## Domain rules

| Rule | Chosen behaviour |
| --- | --- |
| Editable lifecycle state | Only the canonical initial follow-up status, currently `Nyitott`, is editable. The service derives it from the existing playbook runtime; it does not introduce a local status literal or a second status vocabulary. |
| Editable fields | `category`, `question`, `owner`, `dueDate`, and `nextStep` form the complete editable set. `id`, `projectId`, `status`, `decisionOrAnswer`, `createdAt`, `updatedAt`, and `version` are server-owned. |
| Validation | The existing creation limits remain authoritative: closed category vocabulary; trimmed, nonblank question and next step up to 10,000 characters; trimmed, nonblank owner up to 255 characters; and a real `YYYY-MM-DD` calendar date. |
| No-op request | The browser disables Save when the normalized values match the opened record. The API also returns the existing record without a write, version increment, or audit event if an equivalent direct request reaches it. |
| Archive | Existing follow-ups stay readable. An archived project rejects edits with `409`; the Cockpit clears an open edit form on an archive lifecycle change, matching the existing resolution-form behaviour. |
| Conflict | A stale version, a record resolved after edit opened, or an archive conflict returns `409`. The browser refreshes the list, keeps the typed draft, and requires explicit reload of the current open record before another save. |

## Alternatives considered

| Approach | Result | Decision |
| --- | --- | --- |
| Compare `updatedAt` values | A JavaScript ISO timestamp loses PostgreSQL sub-millisecond precision, so rapid writes can share the value visible to the browser. | Rejected: it cannot uphold the agreed no-silent-overwrite rule. |
| Full last-write-wins `PATCH` | Smallest implementation, but a stale form can overwrite another employee's correction. | Rejected: conflicts with the agreed workflow. |
| Versioned `PATCH` under the existing row lock | A monotonic integer version gives the client an exact precondition. The existing transaction and pessimistic row lock serialize the check and mutation. | Chosen: narrow, testable, and local to this resource. |

## External interface

### Contract

The shared contracts package adds the following input and response property:

```ts
export interface UpdateDiscoveryFollowUpInput {
  readonly category: DiscoveryFollowUpCategory;
  readonly question: string;
  readonly owner: string;
  readonly dueDate: string;
  readonly nextStep: string;
  readonly expectedVersion: number;
}

export interface DiscoveryFollowUp {
  // Existing fields remain unchanged.
  readonly version: number;
}
```

`version` is a positive integer. Creation returns version `1`. Every actual
edit and successful resolution returns the next version. List, create, resolve,
and edit responses all use the same complete `DiscoveryFollowUp` representation.

### Route

```text
PATCH /projects/:projectId/discovery-follow-ups/:followUpId
```

The body requires all five editable fields plus `expectedVersion`. A full
editable-state body makes the field set explicit while `PATCH` communicates
that server-owned fields are neither replaced nor accepted from the client.
Nest's existing global `ValidationPipe` remains the only boundary validator:
unknown fields, including `status`, `decisionOrAnswer`, and a future source
identifier, are rejected.

The route returns `200 OK` with the complete saved record. Its error behaviour
is deliberately aligned with the delivered creation and resolution routes:

| Condition | Result |
| --- | --- |
| Existing active project, open record, matching version, changed valid input | `200 OK`, saved record, incremented version, one update audit event |
| Existing active project, open record, matching version, equivalent normalized input | `200 OK`, unchanged record, unchanged version, no audit event |
| Invalid UUID, missing or invalid field, non-positive/non-integer version, or extra field | Sanitized `400 Bad Request` |
| Missing project, missing follow-up, or follow-up outside the project | `404 Not Found` |
| Archived project, non-open follow-up, or stale expected version | Sanitized `409 Conflict` |

No error response may echo submitted question, owner, next-step text, source
identifier, SQL, table names, stack traces, or the server's current free-text
record values.

## Persistence and consistency design

Migration `0008` adds `version integer NOT NULL DEFAULT 1` and a positive-value
check constraint to `discovery_follow_ups`; existing records backfill to `1`.
The migration data source registers it after migration `0007`. Its down path
drops the constraint and then the column; that reversal removes only
concurrency-version metadata, not a business follow-up field.

`DiscoveryFollowUpEntity` declares the column with TypeORM `@VersionColumn`.
The installed TypeORM runtime increments it whenever a loaded entity is saved,
so the existing `resolve` command also advances the version. The service keeps
its established transaction order:

1. lock and validate the project;
2. reject archived projects;
3. lock the project-owned follow-up row;
4. derive and require the canonical open status;
5. compare `expectedVersion` to the locked entity version;
6. normalize and validate input, calculate changed field names in the stable
   editable-field order, and return early for an equivalent request;
7. save the changed entity, allowing `@VersionColumn` to increment it; and
8. persist the audit event in the same transaction before returning the mapped
   record.

The version comparison happens while the row is locked. If resolution wins the
race, edit observes either a non-open status or a newer version and fails;
if edit wins, a later resolution intentionally operates on that newest record.
No extra table, broad lock, timestamp comparison, or polling loop is needed.

## Audit policy

Each real edit writes exactly one `DISCOVERY_FOLLOW_UP_UPDATED` event. Its
payload conforms to the existing `AuditPayload` string-map constraint:

```json
{
  "followUpId": "uuid",
  "changedFields": "category,question,owner,dueDate,nextStep"
}
```

`changedFields` contains only the actually changed editable property names in
that canonical order. It never contains the old or new value, decision or
answer, version, expected version, status, project ID, source-link data, or
user identity. An equivalent edit produces no event.

## Cockpit workflow

The domain-aligned `DiscoveryFollowUpsComponent` remains the complete owner of
the edit adapter call, form state, conflict state, markup, styles, stable test
IDs, and success/error feedback. The Cockpit route remains thin: it provides
project identity/status and refreshes audit history after the existing
`committedChange` event.

For every open follow-up, an `Edit` action opens a prefilled inline form in its
own card. It uses the same selector, two text areas, text input, and date-only
local-calendar conversion pattern as creation. A saved due-date change reuses
the existing deterministic list sort.

Only one row action may be open at a time. Opening Edit disables every Edit and
Resolve action; opening Resolve disables every Edit action. Cancel discards the
edit form without a request. Resolved rows have neither Edit nor Resolve.

Use the following stable selectors for browser coverage:

- `edit-discovery-follow-up-button`
- `discovery-follow-up-edit-form`
- `discovery-follow-up-edit-category-select`
- `discovery-follow-up-edit-question-input`
- `discovery-follow-up-edit-owner-input`
- `discovery-follow-up-edit-due-date-input`
- `discovery-follow-up-edit-next-step-input`
- `save-discovery-follow-up-edit-button`
- `cancel-discovery-follow-up-edit-button`
- `discovery-follow-up-edit-conflict`
- `reload-discovery-follow-up-edit-button`

On an update `409`, the component requests the real list again but does not
reset the typed form. It presents a conflict message and prevents another save
from the stale draft. If the refreshed record remains open, Reload replaces the
draft with that current record and version; Cancel remains available throughout.
If it is now resolved, the draft stays visible for copy/review but cannot be
saved or reloaded into an edit form. A transport, validation, or `404` error
does not discard the typed draft and follows the existing local error surface.

## File boundary

| File | Responsibility |
| --- | --- |
| `packages/contracts/src/discovery-follow-ups.ts` | Versioned edit input and complete response contract. |
| `apps/api/src/migrations/0008-discovery-follow-up-edit-version.ts` | Durable version column and check constraint. |
| `apps/api/src/database/migration-data-source.ts` | Registers migration `0008`. |
| `apps/api/src/discovery-follow-ups/discovery-follow-up.entity.ts` | Maps the TypeORM version column. |
| `apps/api/src/discovery-follow-ups/dto/update-discovery-follow-up.dto.ts` | Exact editable request validation, including `expectedVersion`. |
| `apps/api/src/discovery-follow-ups/discovery-follow-ups.controller.ts` | Narrow `PATCH` route with `200` response. |
| `apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts` | Transactional domain rules, normalized diff, version check, persistence, and safe audit event. |
| `apps/api/test/projects.e2e-spec.ts` | Real PostgreSQL behaviour, lifecycle, stale-write, and audit proof. |
| `apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts` | Typed `PATCH` adapter and actionable conflict mapping. |
| `apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.{ts,html,scss}` | Local edit state, conflict-draft workflow, inline UI, styles, and controls. |
| `apps/web/e2e/discovery-follow-ups.spec.ts` | Real-browser persistence, exclusivity, conflict-preservation, and archive proof. |

No Cockpit shell, customer-follow-up, project lifecycle, scoring, source-link,
or global style file change is part of the slice.

## Acceptance criteria

1. An active-project user can edit every permitted field of a `Nyitott`
   follow-up, see the returned values and reordered due-date position, reload,
   and see the persisted result.
2. The client and API reject any attempt to edit a resolved follow-up, status,
   decision or answer, project ID, source link, or other non-editable field.
3. Creation and resolution return a positive version; a successful edit
   increments it exactly once. Equivalent input does not increment it or write
   an update audit event.
4. Two edits based on the same version cannot both succeed. A stale edit,
   including one made stale by resolution, returns `409`, preserves the browser
   draft, and cannot overwrite persisted values or create an audit event.
5. The update audit contains only `followUpId` and ordered changed field names;
   tests prove it excludes all question, owner, next-step, answer, and version
   data.
6. Edit and Resolve are mutually exclusive inline actions. Archive clears an
   open edit form and disables all mutations while keeping the list readable;
   restore re-enables eligible open-row actions.
7. Existing creation, resolution, deterministic ordering, safe error redaction,
   customer e-mail follow-up, Cockpit audit, and deletion-retention workflows
   continue to pass unchanged.
8. The production web build emits no `anyComponentStyle` warning or error.

## Risks and controls

| Risk | Control |
| --- | --- |
| Timestamp precision masks a rapid conflict | Use a persisted integer version, not `updatedAt`, as the client precondition. |
| Resolution and edit race | Lock project then follow-up, require open state and expected version inside one transaction, and test both outcomes. |
| Sensitive audit copy | Store only the stable follow-up ID and changed field names. |
| Conflicting UI actions lose form state | Keep one action open, use explicit Cancel, and preserve a conflict draft until an intentional reload/cancel. |
| Scope grows into source linkage or generic task management | Reject non-contract fields and keep the file boundary inside the existing discovery deep module. |
| Style locality regresses | Add only module-local SCSS and verify the unchanged Angular budgets from production output. |

## Verification plan

1. Build contracts and run the existing contracts tests after adding the versioned
   public types.
2. Add API E2E cases for normal edit/normalization/reload, no-op edit, invalid
   and unexpected fields without response echo, missing IDs, archived project,
   resolved record, stale same-version edits, resolution-versus-edit conflict,
   version increments, and exact redacted audit payload/count.
3. Extend real-browser discovery tests with an inline edit that persists after
   reload; mutual Edit/Resolve exclusivity; a real out-of-band API edit causing
   `409` while the browser draft remains; explicit reload of the current
   version; and archive clearing an open edit form.
4. Run the narrow contract/API/browser checks before repository `typecheck`,
   `test`, production `build`, full `verify`, and the complete browser E2E
   suite using the repository-compatible Node and pnpm runtime.
5. Review migration up/down, contract additions, selectors, audit redaction,
   compiled style-budget output, documentation links, `git diff --check`, and
   the final worktree before any Git operation.

## Documentation after verified delivery

After implementation evidence exists, update `docs/roadmap.md`,
`docs/product-domain.md`, the Hungarian end-user guide, and the delivery
evidence indexes to describe only the shipped edit behaviour. Until then,
`INTAKE-04` remains `PLANNED`, source linkage stays separate, and no user-facing
document may present editing as available.
