# INTAKE-04.3b Discovery Follow-up Source Linkage Design

**Status:** approved design, pending document review
**Feature:** `INTAKE-04.3b` — optional source checklist-item linkage
**Date:** 2026-08-11

## Outcome

An employee can optionally connect a discovery follow-up to the checklist item
that originated it. The connection can be selected while creating the
follow-up, or added, changed, or removed through a dedicated workflow while
the follow-up is open (`Nyitott`). A resolved follow-up keeps its connection as
readable historical provenance.

The feature makes discovery work traceable without turning a follow-up into a
generic task, duplicating a checklist, or expanding the Cockpit route module.
The existing Discovery follow-ups deep module owns the implementation state,
domain actions, markup, styles, and browser tests. The Cockpit remains a thin
orchestrator.

## Scope and non-goals

### In scope

- An optional source checklist snapshot when creating a discovery follow-up.
- A dedicated action to link, replace, or remove the source of an existing
  open follow-up.
- A compact source reference on every linked follow-up, including resolved
  rows.
- An option list based on the current Initial Intake source: latest open
  `INITIAL_INTAKE`, otherwise latest completed `INITIAL_INTAKE`.
- Version protection, lifecycle checks, project ownership validation, and safe
  audit records for a real source-link change.
- A reusable backend module that makes the readiness and source-linkage
  features use the same source-round selection rule.
- Real PostgreSQL API E2E and real-browser Playwright coverage.

### Explicit non-goals

- A direct “create linked follow-up” action in an interview or readiness
  checklist.
- General-edit support for `sourceSnapshotId`; the delivered edit `PATCH`
  remains limited to its five existing working-detail fields.
- Editing, removing, reopening, or replacing the source of a resolved
  follow-up.
- Automatic migration, inference, or repointing of a historical link when a
  new Initial Intake round becomes current.
- Readiness/scoring behaviour changes, customer follow-up changes, lifecycle
  changes, notifications, authorization, or new dependencies.
- Changes to global styles or Angular production style budgets.

## Product decisions

| Decision | Chosen behaviour |
| --- | --- |
| Creation | The standard creation form contains an optional source selector. Omitting it preserves the current unlinked follow-up workflow. |
| Existing open follow-up | A source can be added, changed, or removed only through its dedicated source-link action. |
| Resolved follow-up | The link is immutable, visible provenance. No source-link controls are shown. |
| Eligible source | The latest open Initial Intake round; if none is open, the latest completed Initial Intake round. |
| New intake round | Existing links stay attached to their immutable historical snapshots. Only a new or replacement link must use the newly current source. |
| Selector content | Candidate rows expose order, topic, control point, and full question text so employees can identify the correct origin. |
| Follow-up card and audit | They expose only a compact human reference: order, topic, and control point. The snapshot UUID remains an internal response reference and never appears in the card or audit. They never duplicate question text, answers, or assessment rationale. |
| Source removal | It requires explicit in-context confirmation. It can remove provenance that may no longer be eligible to reattach after a later intake round. |
| UI ownership | All source-link UI belongs to `DiscoveryFollowUpsComponent`; neither the Cockpit shell nor interview/readiness modules gain an action. |

## Alternatives considered

| Approach | Result | Decision |
| --- | --- | --- |
| Dedicated source-link command and source-options query | A narrow interface hides source eligibility, lifecycle, locking, and audit behaviour inside the discovery module. | Chosen. |
| Add `sourceSnapshotId` to the generic edit `PATCH` | Fewer routes, but mixes provenance with working-detail edits and widens the existing conflict surface. | Rejected. |
| Separate source-link history table | Captures every relationship revision structurally, but adds persistence and UI complexity beyond the existing audit log's need. | Deferred. |

## Domain and architecture

### Shared current-source module

Create a small backend module in the interview domain that resolves the
**Current Initial Intake source** from an `EntityManager`:

1. find the newest open `INITIAL_INTAKE` round by `createdAt DESC, id ASC`;
2. when none exists, find the newest completed `INITIAL_INTAKE` round by the
   same deterministic order;
3. return `null` when neither exists.

`ReadinessService` replaces its private copy of this selection rule with the
shared module. `DiscoveryFollowUpsService` uses it inside source-option reads
and source-link writes. This is a real seam with two consumers, preventing a
future readiness/source-link divergence.

### Discovery follow-ups module

`DiscoveryFollowUpsService` remains the external interface for all discovery
follow-up behaviour. It hides source eligibility, snapshot lookups,
normalization, locks, version checks, list mapping, and audit persistence.
Callers receive a small set of operations:

```text
list(projectId)
listSourceOptions(projectId)
create(projectId, input)
update(projectId, followUpId, input)
setSourceLink(projectId, followUpId, input)
resolve(projectId, followUpId, input)
```

Deleting this module would force form state, source eligibility, mutation
rules, rendering, and module-local styles back into the Cockpit route. It
therefore passes the deep-module deletion test.

### Persistence

Migration `0011` adds nullable `source_snapshot_id uuid` to
`discovery_follow_ups`, with:

- a foreign key to `round_question_snapshots(id)` using `ON DELETE RESTRICT`;
- an index on `source_snapshot_id`; and
- a reversible down migration that drops the index, foreign key, and column in
  that order.

The foreign key preserves snapshot identity. The service additionally proves
that a newly selected snapshot belongs to the project’s current source round;
the database alone cannot express that time-dependent project rule. Source
snapshots are already immutable, and a project with an interview round is
already ineligible for project deletion, so `RESTRICT` preserves existing
retention and lifecycle behaviour.

The entity stores `sourceSnapshotId: string | null`. For response mapping, the
service loads all historical source snapshots referenced by a list in one
batch; it does not require a link to remain current in order to display it.

## External interface

### Shared contracts

```ts
export interface DiscoveryFollowUpSourceOption {
  readonly snapshotId: string;
  readonly order: number;
  readonly topic: string;
  readonly controlPoint: string;
  readonly text: string;
}

export interface DiscoveryFollowUpSourceReference {
  readonly snapshotId: string;
  readonly order: number;
  readonly topic: string;
  readonly controlPoint: string;
}

export interface CreateDiscoveryFollowUpInput {
  // Existing required fields remain unchanged.
  readonly sourceSnapshotId?: string;
}

export interface SetDiscoveryFollowUpSourceLinkInput {
  readonly sourceSnapshotId: string | null;
  readonly expectedVersion: number;
}

export interface DiscoveryFollowUp {
  // Existing fields remain unchanged.
  readonly source: DiscoveryFollowUpSourceReference | null;
}
```

An omitted creation `sourceSnapshotId` means unlinked. The create DTO accepts
only an omitted or valid UUID value; explicit `null` is rejected so that the
creation request remains backwards compatible and unambiguous. The dedicated
source-link command uses explicit `null` to remove a link.

The current update DTO extends the current create DTO, so implementation must
first extract their five shared working-detail validators into a new
`DiscoveryFollowUpDetailsDto`. `CreateDiscoveryFollowUpDto` extends that
details DTO and adds only the optional creation source. `UpdateDiscoveryFollowUpDto`
extends the details DTO and adds only `expectedVersion`. This keeps
`sourceSnapshotId` out of the generic edit route’s validation whitelist.

### Routes

```text
GET /projects/:projectId/discovery-follow-ups/source-options
PUT /projects/:projectId/discovery-follow-ups/:followUpId/source-link
```

The source-options route returns `200 OK` and an empty array when the project
has no eligible Initial Intake source. It remains a read operation for an
archived project.

The `PUT` body is `SetDiscoveryFollowUpSourceLinkInput`. It represents the
complete desired source-link state: a UUID adds or replaces the link, and
`null` removes it. This is a dedicated relationship command, not a generic
edit field. It returns the complete current `DiscoveryFollowUp` representation
with `200 OK`.

The existing list, create, edit, and resolve responses also return the `source`
reference. Generic edit requests that include `sourceSnapshotId` remain invalid
because Nest’s existing whitelist rejects it.

### Error contract

| Condition | Result |
| --- | --- |
| Valid active project, open follow-up, current version, real link mutation | `200 OK`, next version, one audit event |
| Same target link or removal of an already empty link | `200 OK`, unchanged version, no audit event |
| Malformed UUID, missing relationship command field, invalid creation `null`, invalid version, or unknown field | sanitized `400 Bad Request` |
| Missing project, missing follow-up, or follow-up outside project | `404 Not Found` |
| Archived project, resolved follow-up, stale version, or a well-formed source snapshot that is not eligible in the current source | sanitized `409 Conflict` |

No error response may echo submitted question text, owner, next step, answer,
assessment rationale, source UUID, SQL, table names, or stack traces.

## Consistency and lifecycle rules

### Creation

Creation retains its existing validation and initial `Nyitott` status. When a
source UUID is supplied, the service locks the project, rejects an archived
project, resolves the current source round, and verifies the snapshot belongs
to that exact round before it writes the follow-up. The returned record has
version `1`; creation with a source does not create a second version increment.

An unlinked creation does not require an Initial Intake round and continues to
work exactly as it does today.

### Link mutation

For a source-link `PUT`, the service uses the established transaction order:

1. lock and validate the project;
2. reject archived state;
3. lock the project-owned follow-up;
4. derive and require the canonical open follow-up status;
5. compare `expectedVersion` with the locked entity version;
6. when setting a UUID, resolve the current source and validate the immutable
   snapshot belongs to it;
7. return unchanged for an equivalent desired link state; otherwise save one
   source-column mutation and let `@VersionColumn` advance the version; and
8. write the corresponding redacted audit event in the same transaction.

A concurrent newly created Initial Intake round is serialized by the project
lock used by round creation. Completion of the selected round does not alter
the selected snapshot’s identity; it remains the completed fallback when no
new open intake exists. The immutable snapshot makes a separate snapshot lock
unnecessary.

### Historical links

When a later Initial Intake becomes current, existing references still map from
their stored snapshot IDs to their historical order, topic, and control point.
They are not revalidated, silently cleared, or automatically repointed.
Only a newly selected or replacement link has to pass current-source
eligibility. A resolved follow-up never changes its link.

## Audit policy

Creation continues to write exactly one `DISCOVERY_FOLLOW_UP_CREATED` event.
When it contains a source, that existing payload adds only
`sourceOrder`, `sourceTopic`, and `sourceControlPoint`; unlinked creation
retains the current payload shape. It does not emit a second event.

Every real post-creation relationship change writes exactly one
`DISCOVERY_FOLLOW_UP_SOURCE_LINK_CHANGED` event. Its string-only payload has:

```json
{
  "followUpId": "uuid",
  "sourceAction": "ADDED | REPLACED | REMOVED",
  "previousSourceOrder": "number when applicable",
  "previousSourceTopic": "text when applicable",
  "previousSourceControlPoint": "text when applicable",
  "sourceOrder": "number when applicable",
  "sourceTopic": "text when applicable",
  "sourceControlPoint": "text when applicable"
}
```

The event contains no question text, answer, assessment rationale, owner,
next-step text, snapshot UUID, version, or expected version. No-op requests
create neither a write nor an audit event. The existing Cockpit audit history
renders generic event types and payloads, so it will show the event after the
existing `committedChange` refresh without extending the Cockpit shell.

## Employee workflow

1. The Discovery follow-ups module loads the follow-up list and current source
   options independently.
2. The creation form offers an optional source selector. It shows full question
   text and creates an unlinked record if left empty.
3. If no source exists, the selector explains why it has no options without
   disabling unlinked creation.
4. If source-option loading fails, an explicit local error and Retry action are
   shown. Existing unlinked creation and readable links remain usable; the
   failure is not hidden.
5. An open unlinked row offers **Link source**. An open linked row displays the
   compact reference and offers **Change source** and **Remove source**.
6. Link/change opens an inline selector with Save and Cancel. It is mutually
   exclusive with the existing Edit and Resolve actions across every row.
7. Remove opens an explicit confirmation. Confirm sends the same dedicated
   source-link command with `null`; Cancel changes nothing.
8. A conflict or validation error preserves the active source-link draft and
   gives a clear next step. When the available source changed, the employee
   refreshes the candidate list and deliberately chooses again.
9. Resolved rows retain the compact link without action controls. Archiving
   clears an active source-link draft or removal confirmation and disables all
   mutations while retaining readable data.

Stable browser selectors cover the source selector, compact reference, row
actions, inline source form, save/cancel controls, removal confirmation,
source-options error, and retry action. They do not rely on visible copy.

## File boundary

| File | Responsibility |
| --- | --- |
| `CONTEXT.md` | Canonical domain language for source linkage and current Initial Intake source. |
| `packages/contracts/src/discovery-follow-ups.ts` | Source options, compact reference, creation input extension, dedicated source-link input, complete follow-up response. |
| `apps/api/src/migrations/0011-discovery-follow-up-source-linkage.ts` | Nullable relationship column, foreign key, index, and reversible migration. |
| `apps/api/src/database/migration-data-source.ts` | Registers migration `0011`. |
| `apps/api/src/interviews/current-initial-intake-source.ts` | Shared deterministic current-source selection module. |
| `apps/api/src/readiness/readiness.service.ts` | Consumes the shared selector instead of retaining a duplicate private rule. |
| `apps/api/src/discovery-follow-ups/discovery-follow-up.entity.ts` | Maps `sourceSnapshotId`. |
| `apps/api/src/discovery-follow-ups/dto/discovery-follow-up-details.dto.ts` | The five shared general working-detail validators, deliberately excluding source linkage. |
| `apps/api/src/discovery-follow-ups/dto/create-discovery-follow-up.dto.ts` | Extends the shared details validator with the optional valid creation source UUID. |
| `apps/api/src/discovery-follow-ups/dto/update-discovery-follow-up.dto.ts` | Extends the shared details validator with `expectedVersion`, so generic editing cannot accept a source field. |
| `apps/api/src/discovery-follow-ups/dto/set-discovery-follow-up-source-link.dto.ts` | Exact `sourceSnapshotId`/`expectedVersion` validation. |
| `apps/api/src/discovery-follow-ups/discovery-follow-ups.controller.ts` | Source-options read and dedicated source-link `PUT`. |
| `apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts` | Candidate query, relationship validation, batch mapping, versioned mutation, and redacted audit. |
| `apps/api/test/projects.e2e-spec.ts` | Real database lifecycle, concurrency, migration, response, and audit proof. |
| `apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts` | Typed source-options and source-link adapter calls plus actionable error mapping. |
| `apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.{ts,html,scss}` | Local source options, forms, confirmation, mutual exclusion, compact display, styles, and feedback. |
| `apps/web/e2e/discovery-follow-ups.spec.ts` | Real-browser source-link workflows and regressions. |

No Cockpit shell, readiness UI, interview UI, customer-follow-up, global style,
or user-guide file changes belong to implementation. Roadmap, product-domain,
and user-guide delivery documentation are updated only after verified delivery.

## Acceptance criteria

1. An employee can create an unlinked follow-up exactly as today, or create a
   linked one from a valid current Initial Intake snapshot. Both results persist
   after reload with version `1`.
2. The source selector exposes the eligible snapshot’s order, topic, control
   point, and full question text. Follow-up cards and audit payloads never
   expose the full question text, answers, or rationale.
3. An open follow-up can add, replace, or remove its source through only the
   dedicated source-link command. Every real mutation increments its version
   exactly once; an equivalent request is a no-op.
4. A resolved follow-up retains its historical source reference but has no
   source-link controls and rejects direct source mutations with `409`.
5. New or replacement links may target only the latest open Initial Intake or,
   when none is open, the latest completed Initial Intake. A stored historical
   link remains readable after another intake becomes current.
6. Stale source-link writes, lifecycle changes, archive state, foreign-project
   IDs, malformed requests, and ineligible source IDs cannot change data or
   add audit events; response errors are redacted.
7. Link/change forms are mutually exclusive with Edit and Resolve. Archiving
   clears active source-link UI state, while restored active projects again
   permit eligible open-row actions.
8. Creation with a source records its compact source reference in the creation
   audit; every later real source mutation creates exactly one safe source-link
   audit event.
9. Existing discovery creation, editing, resolution, deterministic ordering,
   readiness, customer follow-up, audit refresh, project deletion-retention,
   and lifecycle workflows continue to pass.
10. The production web build has no new `anyComponentStyle` warning or error.

## Risks and controls

| Risk | Control |
| --- | --- |
| Readiness and source linkage choose different rounds | Extract and consume one deterministic current-source module. |
| A client links another project’s or an old snapshot | Validate the snapshot against the current source inside the project-locked transaction. |
| A stale form overwrites a newer link or a resolution | Reuse the persisted version and locked open-row rule. |
| History silently changes after a new intake | Persist immutable snapshot ID and never auto-repoint stored links. |
| Removal loses important provenance | Require explicit confirmation, safe audit, and open-only rule. |
| Sensitive checklist material reaches the audit or compact card | Restrict both to identity and compact metadata; test redaction explicitly. |
| Optional source-list failure blocks core work | Isolate the load error with a visible retry while leaving unlinked work available. |
| Style-budget regression | Keep styles inside the discovery module and check the production build output. |

## Verification plan

1. Extend contracts and compile their consumers before backend work.
2. Add real PostgreSQL API E2E cases for:
   - current-source selection: newest open, then newest completed, then empty;
   - source-option ordering and complete selector-only data;
   - linked and unlinked creation, reload, and source metadata redaction;
   - valid add, replace, remove, and all no-op variants;
   - stale versions, resolution-versus-link races, archive conflicts, foreign
     project or ineligible snapshots, malformed bodies, and no response echo;
   - historical-reference preservation after a newer intake is created; and
   - exact audit event count, payload shape, and absence of free-text data.
3. Extend real-browser tests with:
   - creation with a selected source and persisted compact reference;
   - linking, replacement, removal confirmation, and reload persistence;
   - exclusive Source/Edit/Resolve controls;
   - source-option failure and real retry without blocking unlinked creation;
   - stale source selection that preserves the draft until an intentional
     refresh; and
   - archive/restore clearing source-link local state.
4. Run the narrow contract, API, and browser checks first. Then run repository
   typecheck, test, production build, full verify, and complete browser E2E
   suite with the repository-compatible Node and pnpm runtime.
5. Review the migration up/down path, shared selector reuse, audit redaction,
   stable test IDs, production style-budget output, documentation wording,
   `git diff --check`, and final worktree before Git operations.

## Documentation after verified delivery

Only after implementation evidence exists, update `docs/roadmap.md`,
`docs/product-domain.md`, and the Hungarian end-user guide to describe the
shipped relationship workflow. Until then, `INTAKE-04.3b` remains planned and
no user-facing document claims source linkage is available.
