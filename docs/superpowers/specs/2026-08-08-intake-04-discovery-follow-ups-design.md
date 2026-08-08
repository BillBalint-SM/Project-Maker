# Discovery Follow-ups Design

**Status:** approved design; not implemented
**Feature:** `INTAKE-04.1` — accountable discovery follow-up creation and review
**Date:** 2026-08-08

## Outcome

The first `INTAKE-04` vertical slice lets a user create and review accountable
discovery follow-ups in the project cockpit. Every saved item has a category,
question, owner, date-only due date, next step, and the canonical initial
status `Nyitott`.

This is deliberately a partial delivery of the broader `INTAKE-04` requirement.
It establishes durable, queryable follow-up records and their lifecycle safety
without claiming that users can yet edit, resolve, cancel, link, or score them.

## Domain language and seam

A **discovery follow-up** is a project-owned unresolved discovery item: a
question assigned to an owner with an actionable next step and a date-only due
date. It is distinct from the existing **customer follow-up**, which is one
optional email-delivery schedule per project.

The `discovery-follow-ups` module is the seam for this domain. Its small
interface is list and create. Its implementation owns input normalization,
canonical-status validation, project lifecycle locking, persistence, and safe
audit creation. Cockpit callers do not need to know these rules individually.

The wider product-domain model still anticipates an optional source checklist
item and an answer or decision. Those fields are not persisted in this first
slice; later slices will add them through explicit migrations once a user-facing
workflow consumes them.

## Decisions

| Decision | Chosen behaviour | Reason |
| --- | --- | --- |
| Domain separation | Use a new `discovery-follow-ups` module, table, and plural route | The existing `/follow-up` resource is email scheduling, not operational discovery work |
| Initial status | Server assigns `Nyitott` | `general.v1` is the immutable canonical status vocabulary; clients cannot choose an initial status |
| Status storage | Store a non-null `varchar` and validate against `generalPlaybookV1.statuses.followUp` | Avoid a second local or database enum that duplicates the playbook vocabulary |
| Category vocabulary | `BUSINESS`, `SCOPE`, `TECHNICAL`, `DATA`, `INTEGRATION`, `SECURITY`, `OPERATIONS`, `OTHER` | Closed, explicit classification without free-text categories |
| Date semantics | Required `YYYY-MM-DD` PostgreSQL `DATE` value | A follow-up due date has no time or timezone in this slice |
| Owner | Required trimmed free text of at most 255 characters | Matches the current project `ballOwner` relationship until `SEC-01` defines users and authorization |
| Source linkage | Defer `sourceChecklistItemId` | There is no selector or consuming behaviour in this slice |
| Resolution | Defer decision/answer and all state transitions | Creation and review are the single user-visible behaviour for this slice |
| Archive | Existing records remain readable; creation is rejected while archived | Archive is a retained, read-only state and restoration re-enables work |
| Deletion | A persisted discovery follow-up blocks physical project deletion | It is retained project activity, with an application check and `RESTRICT` foreign key defence |

## External interface

### Routes

```text
GET  /projects/:projectId/discovery-follow-ups
POST /projects/:projectId/discovery-follow-ups
```

`GET` returns an empty list for an existing project with no discovery
follow-ups. Unlike the customer email follow-up route, it has no synthetic
default state and never writes data.

`POST` accepts exactly this input:

```ts
interface CreateDiscoveryFollowUpInput {
  readonly category:
    | 'BUSINESS'
    | 'SCOPE'
    | 'TECHNICAL'
    | 'DATA'
    | 'INTEGRATION'
    | 'SECURITY'
    | 'OPERATIONS'
    | 'OTHER';
  readonly question: string;
  readonly owner: string;
  readonly dueDate: string; // strict YYYY-MM-DD
  readonly nextStep: string;
}
```

The response model contains:

```ts
interface DiscoveryFollowUp {
  readonly id: string;
  readonly projectId: string;
  readonly category: DiscoveryFollowUpCategory;
  readonly question: string;
  readonly owner: string;
  readonly dueDate: string; // YYYY-MM-DD
  readonly status: string; // member of generalPlaybookV1.statuses.followUp
  readonly nextStep: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
```

The server always returns `Nyitott` for a newly created item. It neither accepts
nor emits a source checklist ID, answer/decision, editor, resolver, or status
transition in this slice. The global validation pipe rejects unexpected fields,
so a caller cannot smuggle an alternate status into the request.

### Ordering and error behaviour

Lists are ordered by `dueDate ASC`, then `createdAt ASC`, then `id ASC`, so the
cockpit has a deterministic action order.

| Condition | Result |
| --- | --- |
| Existing project, valid creation input | `201 Created` and the created item |
| Existing project, no rows | `200 OK` and `[]` |
| Missing project | `404 Not Found` |
| Invalid UUID | existing `ParseUUIDPipe` `400` behaviour |
| Unknown category, blank text, overlong text, malformed or impossible date | sanitized `400` validation error |
| Archived project creation | `409 Conflict` |

The API must not echo the submitted question, owner, next step, raw SQL, table
names, or stack details in an error response.

## Persistence and transaction design

Migration `0006` creates a new `discovery_follow_ups` table and registers it in
the migration data source. It follows the repository's raw-SQL,
`MigrationInterface`, explicit-`down` convention.

| Column | Rule |
| --- | --- |
| `id` | UUID primary key |
| `project_id` | required FK to `projects(id) ON DELETE RESTRICT` |
| `category` | required `discovery_follow_up_category` PostgreSQL enum |
| `question` | required text, trimmed and nonblank, maximum 10,000 characters |
| `owner` | required `varchar(255)`, trimmed and nonblank |
| `due_date` | required PostgreSQL `DATE` |
| `status` | required `varchar(100)`, explicitly assigned and runtime-validated from `generalPlaybookV1` |
| `next_step` | required text, trimmed and nonblank, maximum 10,000 characters |
| `created_at`, `updated_at` | required timestamps with the established update trigger |

The migration adds a `(project_id, due_date, created_at, id)` index for the
listed ordering. Its `down` method drops the index, trigger, table, update
function, and category enum in dependency order. Reversing the migration drops
all discovery follow-up data; no production rollback is part of this feature.

Creation runs in one database transaction:

1. Lock the project with the existing pessimistic-write pattern.
2. Return `404` if it no longer exists and `409` if it is archived.
3. Normalize and validate the five input fields; validate the assigned status
   against the immutable `generalPlaybookV1` export.
4. Persist the discovery follow-up.
5. Persist the audit event in the same transaction.

The project deletion path adds this entity to its direct retained-activity
checks. The project lock serializes ordinary create-versus-delete requests. The
existing narrow mapping of PostgreSQL `23001` and `23503` referential-integrity
races to the generic deletion `409` remains the secondary defence.

## Audit policy

Creation writes exactly one `DISCOVERY_FOLLOW_UP_CREATED` event with this
payload:

```json
{
  "followUpId": "uuid",
  "category": "BUSINESS",
  "dueDate": "2026-08-08",
  "status": "Nyitott"
}
```

The payload never includes `question`, `owner`, `nextStep`, a future answer or
decision, or any submitted input beyond the safe metadata above.

## Cockpit design

The existing cockpit gains a clearly separate **Discovery follow-ups** card. It
does not alter the existing **Customer follow-up** email-scheduling card.

The new card provides:

- a required category selector sourced from the shared contract values;
- required question, owner, date-only due-date, and next-step controls;
- focused inline validation and stable `data-testid` selectors;
- a submit action that appends the returned item, resets the form, shows the
  existing success surface, and refreshes audit history; and
- an ordered list showing category, `Nyitott` status, question, owner, due
  date, and next step.

The date picker is date-only. The client serializes its selected local calendar
year, month, and day directly to `YYYY-MM-DD`; it must not use `toISOString()`,
which can shift a date across a UTC boundary.

When a project is archived, the list remains visible but the creation fieldset
and button are disabled. A restored project uses the same loaded list and can
create new records. No row-level edit, delete, close, or resolve controls exist
in this slice.

## Scope

### In scope

- Shared discovery-follow-up contracts and category vocabulary.
- Database migration, entity, module, list/create API, and audit event.
- Project deletion-retention integration.
- Cockpit list/create card and archive read-only handling.
- Real PostgreSQL API E2E and real-browser Playwright coverage.
- Current-state documentation for the delivered sub-slice after verification.

### Explicit non-goals

- Editing, deleting, resolving, cancelling, or changing a discovery follow-up
  status.
- `decisionOrAnswer`, source checklist linkage, interview context selectors,
  automatic discovery of open questions, readiness calculations, or gap links.
- E-mail sending, customer follow-up settings, notifications, reminders, or
  background workers.
- Authentication, authorization, user ownership relations, collaboration, and
  conflict resolution beyond the existing project lock.
- Modifying the immutable `general` v1 playbook or creating a new playbook
  version.
- Dependency, PrimeNG, Angular, global configuration, or legacy-desktop work.

## Acceptance criteria

1. A user can create a discovery follow-up from the cockpit with every required
   field, receives a visible success state, and sees the persisted item after a
   refresh.
2. Every newly created record has the exact canonical status `Nyitott`, and the
   application does not define a second local status vocabulary.
3. Only the eight approved categories can be saved; whitespace-only text,
   owner values above 255 characters, text above 10,000 characters, missing
   fields, malformed dates, and impossible calendar dates are rejected.
4. The due date round-trips as the same `YYYY-MM-DD` value regardless of the
   browser's UTC offset.
5. The API list is deterministic and does not create rows when no discovery
   follow-up exists.
6. Archived projects show their existing discovery follow-ups but reject and
   disable creation; after restore, creation works again.
7. Creating a discovery follow-up creates exactly one audit record whose payload
   is limited to `followUpId`, `category`, `dueDate`, and `status`.
8. A persisted discovery follow-up prevents deletion of an otherwise bare
   `DRAFT` project with the established generic `409`, even when the test
   removes its audit record first to prove the direct-root guard.
9. Customer email scheduling routes and their cockpit controls retain their
   existing behaviour and remain semantically separate.
10. No planned resolution, source-link, scoring, or authentication capability is
    represented as delivered.

## Risks and controls

| Risk | Control |
| --- | --- |
| Customer e-mail scheduling is confused with discovery work | Separate module, table, plural route, card, and explicit documentation language |
| Playbook status values drift or are duplicated | Validate against the immutable contract at runtime; do not create a new status enum or constant |
| Date-only values shift by timezone | Use a PostgreSQL `DATE`, strict calendar validation, and local date-part serialization in the web client |
| A direct database writer adds invalid status data | Database access remains internal; API validation is the sole supported write interface until a versioned status lookup model is justified |
| Archived data can be changed | Lock and reject write transactions; disable the cockpit form while preserving read access |
| A follow-up is missed by deletion protection | Add both the service root check and `RESTRICT` FK; prove the root check separately from audit retention |
| Migration rollback loses data | Document its destructive `down` behaviour and do not run rollback as part of normal delivery |
| Scope expands into scoring or resolution | Keep only list/create endpoints and omit fields and controls without a current user behaviour |

## Verification plan

### Contracts and migration

1. Add focused contract validation for the category vocabulary and the
   `generalPlaybookV1` status membership invariant.
2. Apply migrations `0001` through `0006` to a fresh isolated PostgreSQL
   database and verify migration up/down ordering and schema constraints.
3. Confirm the migration does not alter customer email tables, the `general` v1
   JSON file, or global migration settings.

### API integration

Use the existing real PostgreSQL API E2E suite to prove:

1. empty-list behaviour, valid create, stable list ordering, and date round
   trip;
2. all invalid-input, missing-project, and archived-project paths;
3. exact audit event type and the four-key non-sensitive payload;
4. the direct discovery-follow-up deletion block after audit rows are cleared;
   and
5. customer follow-up regression coverage continues to pass.

### Browser integration

Add a focused Playwright spec using real API setup and stable `data-testid`
selectors. It creates a project, uses the Cockpit form, verifies the returned
list data and success state, reloads the page, then archives the project and
confirms that the visible form is read-only. It must not use text-fallback
clicks or mocked HTTP responses.

### Completion gate

Run the narrow checks first, then the repository's full quality gate with the
compatible local Node 26 / pnpm 11.20 runtime and a fresh isolated PostgreSQL
database. Review the migration diff, API contract, UI selectors, audit payload,
documentation links, `git diff --check`, and final worktree scope before asking
for any Git operation.

## Documentation after verified delivery

After implementation evidence exists:

- add an `INTAKE-04.1` `DELIVERED` entry to `docs/roadmap.md` while keeping the
  broader unresolved `INTAKE-04` requirement planned;
- keep `.planning/REQUIREMENTS.md` unchecked until editing, resolution, status
  management, and the remaining accepted follow-up behaviour are delivered;
- update `.planning/STATE.md`, `docs/product-domain.md`, and
  `docs/operations-handoff.md` with only verified behaviour, migration six, and
  the new route distinction; and
- add the completed implementation plan to `docs/README.md`; the approved
  design is already indexed so the GitHub documentation tree remains navigable.
