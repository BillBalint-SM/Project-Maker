# Strict Project Deletion Design

**Status:** delivered in `5a26f53`, merged into `main` by `b4d4c9b`; the pre-delivery wording below is retained as historical design evidence
**Feature:** `INTAKE-01E` — explicit deletion under a strict retention policy
**Date:** 2026-08-07

## Outcome

Users can explicitly and irreversibly delete an empty draft project. The API is the sole authority for eligibility. Projects with persisted activity remain retained and must be archived instead.

The delivery is intentionally split into two small, independently verifiable slices:

1. `INTAKE-01E.1`: make follow-up reads non-mutating and add the guarded deletion API.
2. `INTAKE-01E.2`: expose the guarded operation in the cockpit with an accessible PrimeNG confirmation dialog.

`INTAKE-01E.1` is a backend foundation, not a completed user-facing feature. `INTAKE-01E.2` completes the explicit-deletion requirement.

## Product policy

A project is deletable only when all conditions are true:

- Its current status is `DRAFT`.
- It has no persisted audit events.
- It has no project question schema or interview round data.
- It has no Markdown revision.
- It has no persisted customer follow-up state.

Changing ordinary workspace fields does not itself prevent deletion. The rule is about retained activity, not whether a draft's name, contact, owner, next action, or due date has been edited.

Deletion is a physical purge. It does not write a `PROJECT_DELETED` audit event because that record would itself retain the project through the audit foreign key. Archive remains the reversible retention action.

## Required correction: read-only follow-up retrieval

The cockpit loads `GET /projects/:projectId/follow-up` on every visit. Its current implementation creates and persists a disabled default follow-up row when no row exists. That would make a newly created draft ineligible for deletion simply because a user opened its cockpit.

`GET /follow-up` must instead be read-only:

- If a row exists, return it unchanged.
- If no row exists, return the same default state in memory without inserting a database row.
- The first explicit `PATCH /follow-up` creates the row inside its existing locked transaction, then persists the requested setting.
- A missing row is semantically equivalent to a disabled default follow-up state, including for the scheduler.

This preserves the visible cockpit defaults while keeping a merely viewed draft eligible for deletion. It also removes the current read-side write and its delete-versus-GET race.

## API design — `INTAKE-01E.1`

### Endpoint

`DELETE /projects/:projectId`

| Condition | Result |
| --- | --- |
| Valid, empty `DRAFT` project | `204 No Content` |
| Project does not exist | `404 Not Found` |
| Project is not `DRAFT` | `409 Conflict` |
| Project has persisted activity | `409 Conflict` |
| Invalid UUID | Existing `ParseUUIDPipe` `400` behaviour |

The `409` message must be actionable but generic, for example: “This project has persisted activity and cannot be deleted. Archive it instead.” It must not expose database table names, record counts, audit payloads, or submitted values.

### Transaction and concurrency

The service performs all mutation work in one transaction:

1. Load the project with the established pessimistic write lock.
2. Reject a non-`DRAFT` project.
3. Check the direct project-owned persistence roots: audit events, question schemas, interview rounds, Markdown revisions, and customer follow-up rows.
4. Physically remove the project only when every check is empty.

Question-schema and interview-round trees are immutable and use `RESTRICT` foreign keys; they are never cascaded or individually removed. The operation also translates a narrowly identified late PostgreSQL foreign-key violation into the same `409` conflict, preserving a clean response if a future or external writer races the final delete.

Project writers that create schemas, rounds, Markdown revisions, or follow-up updates already take the same project lock. The read-only follow-up correction removes the remaining cockpit-read write path.

### Backend write scope

- `apps/api/src/projects/projects.controller.ts`
- `apps/api/src/projects/projects.service.ts`
- `apps/api/src/follow-ups/follow-up.service.ts`
- `apps/api/test/projects.e2e-spec.ts`

No migration, foreign-key change, contracts change, cascade rule, or global configuration change belongs to this slice.

## Cockpit design — `INTAKE-01E.2`

The action is deliberately local to the existing cockpit lifecycle area. It is not added to the project list.

For a `DRAFT` project, the cockpit renders a clearly dangerous “Delete project” control. The control opens a local PrimeNG 22 `ConfirmDialog`, supplied by a component-scoped `ConfirmationService`; no application-wide dialog provider is required.

The confirmation dialog must:

- explain that deletion is permanent and only succeeds for a draft with no persisted activity;
- focus the cancel/reject action by default;
- offer explicit cancel and destructive confirm actions with stable test IDs;
- issue no HTTP request when cancelled;
- disable duplicate lifecycle actions while a deletion is in flight.

After a `204`, the client navigates to the project list. After a `409`, the cockpit remains open and shows the sanitized, actionable error. The frontend never decides eligibility from its local state; a project can gain activity after the dialog opens, and the API must still reject it safely.

### Frontend write scope

- `apps/web/src/app/projects/project-api.service.ts`
- `apps/web/src/app/projects/project-cockpit.page.ts`
- `apps/web/src/app/projects/project-cockpit.page.html`
- `apps/web/e2e/project-delete.spec.ts` (new)

The implementation uses the documented `ConfirmationService` and `ConfirmDialog` pattern, cross-checked against the installed PrimeNG 22 declarations. Custom footer controls provide stable test IDs for cancel and confirm actions.

## Acceptance criteria

### `INTAKE-01E.1`

1. Reading follow-up settings for a project without saved follow-up settings returns the normal disabled defaults and creates no database row.
2. A bare `DRAFT` project can be deleted with `DELETE /projects/:projectId`, receives `204`, disappears from the list, and returns `404` from the cockpit endpoint.
3. A non-`DRAFT` project cannot be deleted and receives `409`.
4. A `DRAFT` with persisted audit, schema/round, Markdown, or follow-up activity cannot be deleted and receives the sanitized `409` response.
5. Two simultaneous deletes produce exactly one successful deletion; the other request observes that the resource no longer exists.
6. No cascade or deletion audit record is created.

### `INTAKE-01E.2`

1. A `DRAFT` cockpit exposes the delete control; a non-`DRAFT` cockpit does not.
2. Cancelling the confirmation produces zero `DELETE` requests.
3. Confirming an eligible deletion sends one `DELETE`, receives `204`, and routes to the project list.
4. A server-side `409` keeps the cockpit active and displays no raw SQL, table names, stack traces, or submitted values.
5. The keyboard focus and test selectors make the destructive choice explicit and accessible.

## Verification plan

Each slice follows a RED → minimal implementation → focused verification cycle.

### `INTAKE-01E.1`

1. Add failing real API E2E coverage for the read-only follow-up behaviour and guarded delete endpoint.
2. Implement the smallest service and controller changes.
3. Run `pnpm --filter @project-maker/api test` and `pnpm --filter @project-maker/api typecheck`.
4. Review the diff specifically for accidental cascades, migrations, raw persistence details in errors, and changes outside the four backend files.

### `INTAKE-01E.2`

1. Add a failing Playwright test using only stable test IDs and real HTTP responses.
2. Implement the local cockpit confirmation and client call.
3. Run `pnpm --filter @project-maker/web typecheck` and `pnpm --filter @project-maker/web exec playwright test e2e/project-delete.spec.ts`.
4. Review the UI flow for cancel-without-request, duplicate-submit protection, success navigation, and conflict handling.

The Playwright runner resets only a validated localhost database whose name contains `test` or `e2e`; it must never be pointed at production data.

### Feature completion gate

After both slices are green, run:

```powershell
pnpm verify
pnpm test:e2e
pnpm compose:config
pnpm compose:up
```

Then perform a focused diff and runtime smoke review before requesting any commit, push, or merge decision.

## Explicit non-goals

- Cascading deletion of retained project data.
- Soft-delete or a second archive mechanism.
- Restoring a deleted project.
- A `canDelete` or blocker-details field in shared contracts.
- Project-list deletion actions.
- Authentication, authorization, or role policy; the endpoint inherits the repository's current access model and must be revisited when access control is introduced.
- Unrelated UI copy, dependency upgrades, or refactoring.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| A cockpit visit silently blocks deletion | Make `GET /follow-up` read-only and test that no row is inserted. |
| A child record is created around deletion | Lock the project, check persistence roots in the same transaction, and map a late foreign-key violation to `409`. |
| A UI-only eligibility decision becomes stale | The backend remains authoritative; the client handles `409` without navigation. |
| Destructive action is activated by mistake | Require a focused confirmation dialog with cancel as the default focus and stable explicit controls. |
| E2E accidentally targets a non-test database | Use the existing local-host and database-name safety guard; do not override it. |
