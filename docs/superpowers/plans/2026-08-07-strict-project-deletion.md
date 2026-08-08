# Strict Project Deletion Implementation Plan

> **Delivery status:** Delivered in `5a26f53` and merged into `main` by `b4d4c9b`. The unchecked task list below is preserved as the approved pre-execution plan; current delivery status is maintained in [`docs/roadmap.md`](../../roadmap.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user permanently delete an empty `DRAFT` project from its cockpit while retaining every project that has persisted activity.

**Architecture:** The backend is authoritative: `DELETE /projects/:projectId` locks the project, rejects retained activity, and physically removes only an eligible row. The follow-up read path becomes non-mutating so merely opening a cockpit does not create a deletion blocker. The Angular cockpit calls the endpoint only after a component-scoped PrimeNG 22 confirmation dialog; the client handles a stale `409` safely.

**Tech Stack:** Angular 22.1, PrimeNG 22.0.0, NestJS 11, TypeORM 1.1, PostgreSQL, Node test runner + Supertest, Playwright, pnpm 11.

## Acceptance Criteria

- A first `GET /projects/:projectId/follow-up` for a project with no row returns the existing disabled defaults and leaves `customer_follow_ups` empty; the first explicit `PATCH` creates exactly one row.
- `DELETE /projects/:projectId` returns `204` and physically removes a bare `DRAFT`; it is subsequently absent from both cockpit and list responses.
- A non-`DRAFT` or a `DRAFT` with an audit event, question schema/interview tree, Markdown revision, or follow-up row returns the one generic `409` message and retains all data.
- A missing project returns `404`; a malformed project ID returns `400` without echoing it.
- Concurrent delete requests serialize to one `204` and one `404`; a dependency inserted at final deletion time becomes the same generic `409` and rolls back the delete.
- The cockpit alone renders deletion for a `DRAFT`, defaults focus to Cancel in the confirmation, sends no request on cancel, returns to `/` after a `204`, and stays open with a safe message on a stale `409`.
- The completed diff contains no migration, cascade, soft-delete, deletion audit, global PrimeNG provider, dependency change, or unapproved Git publication.

## Execution Risks and Controls

| Risk | Control in this plan |
| --- | --- |
| A read unexpectedly creates retention data. | Task 1 proves read purity before the deletion endpoint exists. |
| A child row arrives between eligibility checks and physical delete. | Task 3 combines the existing project lock with a narrow PostgreSQL `23001` / `23503` mapping and real trigger tests. |
| A future persistence root is overlooked. | Task 2 checks every direct project-owned root explicitly; Task 3 proves the retained-root cases. |
| A stale screen permits accidental or misleading deletion. | Task 4 uses server authority, an explicit confirmation, disabled conflicting actions, and a browser-level `409` test. |
| Browser tests reset the wrong database. | The existing Playwright localhost and `test`/`e2e` database guard remains mandatory. |
| A PrimeNG version mismatch changes dialog behaviour. | The plan keeps PrimeNG `22.0.0`, uses its installed local declarations, and verifies the real rendered controls with Playwright. |

## Global Constraints

- Preserve the approved strict rule: only a `DRAFT` with no audit event, question schema/interview tree, Markdown revision, or persisted follow-up state is deletable.
- Keep `GET /projects/:projectId/follow-up` read-only; its no-row response must match the existing disabled defaults.
- Do not add migrations, alter foreign keys, cascade child deletion, add a soft-delete, change shared contracts, or add a project-list deletion action.
- Keep PrimeNG at `22.0.0`; do not add or upgrade dependencies. Use the installed `ConfirmDialog` and `ConfirmationService` APIs already verified against Context7 guidance and the local v22 declarations.
- Use generic user-facing conflicts. Do not expose SQL, table names, audit payloads, stack traces, submitted values, secrets, or license material.
- Preserve the existing untracked `.planning/planning-show/` and `docs/superpowers/` content. Do not reset, clean, or overwrite it.
- Do not stage, commit, push, create a PR, or merge unless the user explicitly authorizes that Git action after reviewing the slice diff.
- The Playwright runner may reset only its existing validated localhost database with `test` or `e2e` in the database name.

---

## File Structure

| File | Responsibility | Tasks |
| --- | --- | --- |
| `apps/api/src/follow-ups/follow-up.service.ts` | Return an in-memory default for a missing follow-up row; persist only on update. | 1 |
| `apps/api/src/projects/projects.controller.ts` | Expose the HTTP `DELETE` endpoint with a `204` success status. | 2 |
| `apps/api/src/projects/projects.service.ts` | Lock, eligibility-check, delete, and map a late foreign-key race to `409`. | 2, 3 |
| `apps/api/test/projects.e2e-spec.ts` | Real API coverage for read purity, deletion policy, and concurrency. | 1, 2, 3 |
| `apps/web/src/app/projects/project-api.service.ts` | Add the `DELETE` client method and a deletion-specific safe conflict message. | 4 |
| `apps/web/src/app/projects/project-cockpit.page.ts` | Hold confirmation and deletion state; navigate after success; suppress conflicting actions. | 4 |
| `apps/web/src/app/projects/project-cockpit.page.html` | Render the draft-only danger action and PrimeNG confirmation controls with stable test IDs. | 4 |
| `apps/web/e2e/project-delete.spec.ts` | Exercise cancel, successful delete, stale conflict, focus, and hidden non-draft action against the real API. | 4 |

## Shared Interfaces

These names and behaviours are established by the tasks below and must remain consistent across tasks.

```ts
// apps/api/src/projects/projects.service.ts
delete(projectId: string): Promise<void>

// apps/web/src/app/projects/project-api.service.ts
deleteProject(projectId: string): Observable<void>

// apps/web/src/app/projects/project-cockpit.page.ts
requestProjectDeletion(): void
deleteProject(): void
isDeletableDraft(): boolean
```

The server conflict text is a private implementation detail, but all blocked delete paths use the same generic message:

```ts
const projectDeletionConflictMessage =
  'This project has persisted activity and cannot be deleted. Archive it instead.';
```

## Task 1: Make follow-up retrieval read-only

**Files:**

- Modify: `apps/api/src/follow-ups/follow-up.service.ts:103-122`
- Modify: `apps/api/test/projects.e2e-spec.ts:28-196`

**Interfaces:**

- Consumes: `CustomerFollowUpService.get(projectId: string): Promise<CustomerFollowUpState>` and the existing `createDefaultState(projectId)` / `toState(value)` helpers.
- Produces: a no-row `GET /projects/:projectId/follow-up` response without inserting into `customer_follow_ups`; `PATCH /follow-up` remains the first persistence path.

- [ ] **Step 1: Write the failing real API test for the no-row default and first explicit save.**

Add this test to `projects.e2e-spec.ts` before changing the service. It uses the test suite's real `DataSource`, not a mock.

```ts
it('returns an unsaved default follow-up state and persists only after PATCH', async () => {
  const projectId = await createProject('follow-up-read-only');

  const getResponse = await request(app.getHttpServer())
    .get(`/projects/${projectId}/follow-up`)
    .expect(200);
  assert.deepEqual(getResponse.body, {
    projectId,
    enabled: false,
    intervalMinutes: 10_080,
    expiresAt: null,
    lastPingAt: null,
    nextPingAt: null,
    lastDeliveryStatus: 'NEVER',
    lastDeliveryError: null,
  });

  const beforePatch = await dataSource.query<Array<{ count: string }>>(
    'SELECT COUNT(*)::text AS "count" FROM "customer_follow_ups" WHERE "project_id" = $1',
    [projectId],
  );
  assert.equal(beforePatch[0]?.count, '0');

  await request(app.getHttpServer())
    .patch(`/projects/${projectId}/follow-up`)
    .send({ enabled: false, intervalMinutes: 10_080, expiresAt: null })
    .expect(200);

  const afterPatch = await dataSource.query<Array<{ count: string }>>(
    'SELECT COUNT(*)::text AS "count" FROM "customer_follow_ups" WHERE "project_id" = $1',
    [projectId],
  );
  assert.equal(afterPatch[0]?.count, '1');
});
```

- [ ] **Step 2: Run the API suite and confirm the test is red.**

Run:

```powershell
pnpm --filter @project-maker/api test
```

Expected: FAIL because the current `get()` implementation saves a default row, so the count is `1` before the `PATCH`.

- [ ] **Step 3: Replace only the read-side persistence branch.**

In `CustomerFollowUpService.get`, retain the project existence check and existing-row response. Replace the save-and-unique-violation block with the in-memory default response below, then remove the now-unused `isUniqueViolation` helper at the end of the file.

```ts
async get(projectId: string): Promise<CustomerFollowUpState> {
  await this.findProject(this.dataSource.manager, projectId, false);
  const existing = await this.followUpRepository.findOneBy({ projectId });
  return toState(existing ?? createDefaultState(projectId));
}
```

Do not change `findOrCreateLockedState`; `update`, manual ping, and review-email paths still need it to persist an explicit follow-up state inside their current project lock.

- [ ] **Step 4: Run the API suite and typecheck.**

Run:

```powershell
pnpm --filter @project-maker/api test
pnpm --filter @project-maker/api typecheck
```

Expected: PASS. The new test proves that a cockpit-read-equivalent `GET` has no database write and that the first explicit `PATCH` persists the state.

- [ ] **Step 5: Review this bounded diff; do not commit.**

Run:

```powershell
git diff --check
git diff -- apps/api/src/follow-ups/follow-up.service.ts apps/api/test/projects.e2e-spec.ts
```

Expected: only the read-side save removal, unused helper removal, and the focused real API test. Stop for reviewer/user approval before any Git operation.

## Task 2: Add the guarded project-deletion API

**Files:**

- Modify: `apps/api/src/projects/projects.controller.ts:1-58`
- Modify: `apps/api/src/projects/projects.service.ts:1-198`
- Modify: `apps/api/test/projects.e2e-spec.ts`

**Interfaces:**

- Consumes: `findLockedProject(manager, projectId)`, existing `Project` status values, and TypeORM repository `existsBy` / `remove` operations.
- Produces: `ProjectsService.delete(projectId): Promise<void>` and `DELETE /projects/:projectId` with `204`, `404`, and generic `409` outcomes.

- [ ] **Step 1: Write failing endpoint and basic-policy tests.**

Add the reusable conflict assertion near the existing test helpers:

```ts
const projectDeletionConflictMessage =
  'This project has persisted activity and cannot be deleted. Archive it instead.';

async function expectProjectDeletionConflict(projectId: string): Promise<void> {
  const response = await request(app.getHttpServer())
    .delete(`/projects/${projectId}`)
    .expect(409);
  assert.equal(response.body.message, projectDeletionConflictMessage);
}
```

Add these test bodies to the same E2E suite:

```ts
it('deletes a bare DRAFT project and makes it unreachable', async () => {
  const projectId = await createProject('delete-empty-draft');

  await request(app.getHttpServer()).delete(`/projects/${projectId}`).expect(204);
  await request(app.getHttpServer()).get(`/projects/${projectId}/cockpit`).expect(404);

  const listResponse = await request(app.getHttpServer()).get('/projects').expect(200);
  assert.equal(listResponse.body.some((project: { id: string }) => project.id === projectId), false);
});

it('rejects deletion for a non-DRAFT project and for a DRAFT with audit history', async () => {
  const nonDraftProjectId = await createProject('delete-non-draft');
  await request(app.getHttpServer())
    .patch(`/projects/${nonDraftProjectId}/workspace`)
    .send({ status: 'WAITING_INTERNAL' })
    .expect(200);
  await expectProjectDeletionConflict(nonDraftProjectId);

  const retainedProjectId = await createProject('delete-audit-history');
  await request(app.getHttpServer()).post(`/projects/${retainedProjectId}/archive`).expect(201);
  await request(app.getHttpServer()).post(`/projects/${retainedProjectId}/restore`).expect(201);
  await expectProjectDeletionConflict(retainedProjectId);
});

it('returns 404 for a missing project and 400 without echoing a malformed project id', async () => {
  const missingProjectId = '00000000-0000-4000-8000-000000000000';
  await request(app.getHttpServer()).delete(`/projects/${missingProjectId}`).expect(404);

  const invalidProjectId = 'not-a-project-uuid';
  const invalidResponse = await request(app.getHttpServer())
    .delete(`/projects/${invalidProjectId}`)
    .expect(400);
  assertNoSubmittedValues(invalidResponse.body, invalidProjectId);
});
```

- [ ] **Step 2: Run the API suite and confirm the route is red.**

Run:

```powershell
pnpm --filter @project-maker/api test
```

Expected: FAIL because `DELETE /projects/:projectId` is not registered yet.

- [ ] **Step 3: Register the HTTP endpoint with its explicit success status.**

Update the Nest imports and add this controller method after `restore`:

```ts
@Delete(':projectId')
@HttpCode(HttpStatus.NO_CONTENT)
deleteProject(
  @Param('projectId', new ParseUUIDPipe()) projectId: string,
): Promise<void> {
  return this.projectsService.delete(projectId);
}
```

Import `Delete`, `HttpCode`, and `HttpStatus` from `@nestjs/common`. Do not return a body for `204`.

- [ ] **Step 4: Implement the atomic eligibility check and physical delete.**

Add the direct project-owned entity imports to `projects.service.ts`:

```ts
import { CustomerFollowUpEntity } from '../follow-ups/follow-up.entity';
import { InterviewRoundEntity } from '../interviews/interview-round.entity';
import { MarkdownRevisionEntity } from '../markdown/markdown-revision.entity';
import { ProjectQuestionSchemaEntity } from '../question-bank/project-question-schema.entity';
```

Add the private conflict text near the other status constants, then add these members without changing archive or restore behaviour:

```ts
const projectDeletionConflictMessage =
  'This project has persisted activity and cannot be deleted. Archive it instead.';

async delete(projectId: string): Promise<void> {
  await this.dataSource.transaction(async (manager) => {
    const project = await findLockedProject(manager, projectId);
    if (project.status !== draftStatus) {
      throw new ConflictException(projectDeletionConflictMessage);
    }
    if (await hasPersistedProjectActivity(manager, projectId)) {
      throw new ConflictException(projectDeletionConflictMessage);
    }
    await manager.getRepository(Project).remove(project);
  });
}

async function hasPersistedProjectActivity(
  manager: EntityManager,
  projectId: string,
): Promise<boolean> {
  if (await manager.getRepository(AuditEvent).existsBy({ projectId })) {
    return true;
  }
  if (await manager.getRepository(ProjectQuestionSchemaEntity).existsBy({ projectId })) {
    return true;
  }
  if (await manager.getRepository(InterviewRoundEntity).existsBy({ projectId })) {
    return true;
  }
  if (await manager.getRepository(MarkdownRevisionEntity).existsBy({ projectId })) {
    return true;
  }
  return manager.getRepository(CustomerFollowUpEntity).existsBy({ projectId });
}
```

The question-schema and interview-round checks are deliberately both present. A database invariant means a valid round also has a schema, but checking each direct project root makes the deletion policy explicit and future-proof.

- [ ] **Step 5: Run the basic API tests and inspect the returned HTTP contract.**

Run:

```powershell
pnpm --filter @project-maker/api test
pnpm --filter @project-maker/api typecheck
```

Expected: PASS. Verify manually in the test output that a successful delete is `204`, not `200` or `201`; a missing project is `404`; a malformed UUID is `400` without echoing it; and no route returns raw database diagnostics.

- [ ] **Step 6: Review this bounded diff; do not commit.**

Run:

```powershell
git diff --check
git diff -- apps/api/src/projects/projects.controller.ts apps/api/src/projects/projects.service.ts apps/api/test/projects.e2e-spec.ts
```

Expected: one endpoint, one locked eligibility path, and focused policy coverage only. Stop for reviewer/user approval before any Git operation.

## Task 3: Prove retained-data coverage and harden deletion races

**Files:**

- Modify: `apps/api/src/projects/projects.service.ts`
- Modify: `apps/api/test/projects.e2e-spec.ts`

**Interfaces:**

- Consumes: the `ProjectsService.delete(projectId)` implementation from Task 2 and PostgreSQL SQLSTATE `23001` (`restrict_violation`) and `23503` (`foreign_key_violation`) for late referential-integrity failures.
- Produces: deterministic `409` responses when every remaining persistence root or a late referential-integrity race blocks deletion.

- [ ] **Step 1: Add focused failing tests for the remaining persistence roots.**

Add a local helper that removes only test-generated audit events when a test needs to isolate another dependency root:

```ts
async function clearProjectAuditEvents(projectId: string): Promise<void> {
  await dataSource.query('DELETE FROM "audit_events" WHERE "project_id" = $1', [projectId]);
}
```

Add these cases. Each setup uses the real API and real PostgreSQL state:

```ts
it('rejects deletion for DRAFT projects with Markdown and follow-up persistence', async () => {
  const markdownProjectId = await createProject('delete-markdown');
  await request(app.getHttpServer())
    .patch(`/projects/${markdownProjectId}/workspace`)
    .send({ status: 'READY_FOR_PLANNING' })
    .expect(200);
  await request(app.getHttpServer())
    .patch(`/projects/${markdownProjectId}/workspace`)
    .send({ status: 'DRAFT' })
    .expect(200);
  await expectProjectDeletionConflict(markdownProjectId);

  const followUpProjectId = await createProject('delete-follow-up');
  await request(app.getHttpServer())
    .patch(`/projects/${followUpProjectId}/follow-up`)
    .send({ enabled: false, intervalMinutes: 10_080, expiresAt: null })
    .expect(200);
  await clearProjectAuditEvents(followUpProjectId);
  await expectProjectDeletionConflict(followUpProjectId);
});

it('rejects deletion for a project with a published question schema', async () => {
  const projectId = await createProject('delete-schema');
  const bankResponse = await request(app.getHttpServer())
    .get('/settings/base-questions')
    .expect(200);
  const stableKey = bankResponse.body.questions[0]?.stableKey as string | undefined;
  if (!stableKey) {
    throw new Error('The seeded question bank did not return a stable key.');
  }

  await request(app.getHttpServer())
    .post(`/projects/${projectId}/question-schema`)
    .send({ questions: [{ stableKey, required: true, blocking: true }] })
    .expect(201);
  await clearProjectAuditEvents(projectId);
  await expectProjectDeletionConflict(projectId);
});
```

The schema test also covers the interview tree: `interview_rounds.project_schema_id` is non-null and `RESTRICT`-references a project schema, so a valid round cannot exist without the schema blocker.

- [ ] **Step 2: Add failing concurrency and late-foreign-key tests.**

Use a short-lived test trigger to make the parallel delete ordering observable. Always remove the trigger and function in `finally`.

```ts
it('serializes concurrent deletes to one 204 and one 404', async () => {
  const projectId = await createProject('concurrent-delete');
  try {
    await dataSource.query(`
      CREATE OR REPLACE FUNCTION "e2e_delay_project_delete"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        PERFORM pg_sleep(0.2);
        RETURN OLD;
      END;
      $$
    `);
    await dataSource.query(`
      CREATE TRIGGER "trg_e2e_delay_project_delete"
      BEFORE DELETE ON "projects"
      FOR EACH ROW
      EXECUTE FUNCTION "e2e_delay_project_delete"()
    `);

    const [first, second] = await Promise.all([
      request(app.getHttpServer()).delete(`/projects/${projectId}`),
      request(app.getHttpServer()).delete(`/projects/${projectId}`),
    ]);
    assert.deepEqual(
      [first.status, second.status].sort((left, right) => left - right),
      [204, 404],
    );
  } finally {
    await dataSource.query('DROP TRIGGER IF EXISTS "trg_e2e_delay_project_delete" ON "projects"');
    await dataSource.query('DROP FUNCTION IF EXISTS "e2e_delay_project_delete"()');
  }
});
```

Add this temporary `BEFORE DELETE` trigger test. It inserts a valid `customer_follow_ups` row for `OLD.id` after the service's existence checks, asserts the same generic `409`, and proves that the failed transaction leaves the project reachable. PostgreSQL evaluates the `ON DELETE RESTRICT` constraint and returns SQLSTATE `23001`. Always remove the trigger and function in `finally`.

```ts
it('maps a late restrict-violation deletion race to a conflict and retains the project', async () => {
  const projectId = await createProject('late-delete-blocker');
  try {
    await dataSource.query(`
      CREATE OR REPLACE FUNCTION "e2e_add_project_delete_blocker"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        INSERT INTO "customer_follow_ups" ("id", "project_id")
        VALUES ('00000000-0000-4000-8000-000000000001', OLD."id");
        RETURN OLD;
      END;
      $$
    `);
    await dataSource.query(`
      CREATE TRIGGER "trg_e2e_add_project_delete_blocker"
      BEFORE DELETE ON "projects"
      FOR EACH ROW
      EXECUTE FUNCTION "e2e_add_project_delete_blocker"()
    `);

    const response = await request(app.getHttpServer()).delete(`/projects/${projectId}`);
    assert.equal(response.status, 409);
    assert.equal(response.body.message, projectDeletionConflictMessage);
    await request(app.getHttpServer()).get(`/projects/${projectId}/cockpit`).expect(200);
  } finally {
    await dataSource.query(
      'DROP TRIGGER IF EXISTS "trg_e2e_add_project_delete_blocker" ON "projects"',
    );
    await dataSource.query('DROP FUNCTION IF EXISTS "e2e_add_project_delete_blocker"()');
  }
});
```

Add a distinct temporary `AFTER DELETE` trigger fixture to exercise PostgreSQL SQLSTATE `23503`. The trigger attempts to insert the follow-up only after the parent project was deleted, so the child insert itself violates the foreign key. Assert the same generic `409` and that transaction rollback leaves the cockpit reachable. Use a unique function, trigger, and UUID; always remove both database objects in `finally`.

```ts
it('maps a late foreign-key violation deletion race to a conflict and retains the project', async () => {
  const projectId = await createProject('late-delete-fk-blocker');
  try {
    await dataSource.query(`
      CREATE OR REPLACE FUNCTION "e2e_add_deleted_project_fk_blocker"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        INSERT INTO "customer_follow_ups" ("id", "project_id")
        VALUES ('00000000-0000-4000-8000-000000000002', OLD."id");
        RETURN OLD;
      END;
      $$
    `);
    await dataSource.query(`
      CREATE TRIGGER "trg_e2e_add_deleted_project_fk_blocker"
      AFTER DELETE ON "projects"
      FOR EACH ROW
      EXECUTE FUNCTION "e2e_add_deleted_project_fk_blocker"()
    `);

    const response = await request(app.getHttpServer()).delete(`/projects/${projectId}`);
    assert.equal(response.status, 409);
    assert.equal(response.body.message, projectDeletionConflictMessage);
    await request(app.getHttpServer()).get(`/projects/${projectId}/cockpit`).expect(200);
  } finally {
    await dataSource.query(
      'DROP TRIGGER IF EXISTS "trg_e2e_add_deleted_project_fk_blocker" ON "projects"',
    );
    await dataSource.query('DROP FUNCTION IF EXISTS "e2e_add_deleted_project_fk_blocker"()');
  }
});
```

- [ ] **Step 3: Run the API suite and confirm the late race currently leaks as a database error.**

Run:

```powershell
pnpm --filter @project-maker/api test
```

Expected: the root-coverage tests pass once Task 2 is complete, while the `BEFORE DELETE` fixture leaks SQLSTATE `23001` and the `AFTER DELETE` fixture leaks SQLSTATE `23503` as non-`409` responses. That confirms both tests exercise final-delete referential-integrity races rather than a pre-check branch.

- [ ] **Step 4: Map only approved final referential-integrity races to the approved conflict.**

Import `QueryFailedError` from `typeorm`, wrap the existing transaction in a narrow catch, and add this helper near the other persistence helpers:

```ts
async delete(projectId: string): Promise<void> {
  try {
    await this.dataSource.transaction(async (manager) => {
      const project = await findLockedProject(manager, projectId);
      if (project.status !== draftStatus) {
        throw new ConflictException(projectDeletionConflictMessage);
      }
      if (await hasPersistedProjectActivity(manager, projectId)) {
        throw new ConflictException(projectDeletionConflictMessage);
      }
      await manager.getRepository(Project).remove(project);
    });
  } catch (error) {
    if (isProjectDeletionReferentialIntegrityViolation(error)) {
      throw new ConflictException(projectDeletionConflictMessage);
    }
    throw error;
  }
}

const projectDeletionReferentialIntegrityCodes = new Set(['23001', '23503']);

function isProjectDeletionReferentialIntegrityViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as { readonly code?: unknown };
  return (
    typeof driverError.code === 'string' &&
    projectDeletionReferentialIntegrityCodes.has(driverError.code)
  );
}
```

The catch must rethrow every error except `QueryFailedError` instances whose driver code is exactly `23001` or `23503`; do not convert unrelated validation, not-found, or operational failures. The mapping is safe because the delete transaction contains no other foreign-key-writing operation.

- [ ] **Step 5: Run the complete API suite and typecheck.**

Run:

```powershell
pnpm --filter @project-maker/api test
pnpm --filter @project-maker/api typecheck
```

Expected: PASS. Verify that the temporary trigger cleanup runs even if an assertion fails and that the late-row test leaves the project intact.

- [ ] **Step 6: Review this bounded diff; do not commit.**

Run:

```powershell
git diff --check
git diff -- apps/api/src/projects/projects.service.ts apps/api/test/projects.e2e-spec.ts
```

Expected: no migration, no cascade, no modification of protected database triggers, and no error-message leakage. Stop for reviewer/user approval before any Git operation.

## Task 4: Add the cockpit confirmation and browser coverage

**Files:**

- Modify: `apps/web/src/app/projects/project-api.service.ts:140-229`
- Modify: `apps/web/src/app/projects/project-cockpit.page.ts:1-379`
- Modify: `apps/web/src/app/projects/project-cockpit.page.html:56-433`
- Create: `apps/web/e2e/project-delete.spec.ts`

**Interfaces:**

- Consumes: `DELETE /api/projects/:projectId`, the generic `409` from Tasks 2–3, and the existing cockpit action-error surface.
- Produces: `ProjectApiService.deleteProject(projectId)`, cockpit methods `requestProjectDeletion()` / `deleteProject()`, and test IDs `delete-project-button`, `project-delete-confirmation`, `cancel-project-delete-button`, and `confirm-project-delete-button`.

- [ ] **Step 1: Write failing browser tests using stable IDs and real API state.**

Create `apps/web/e2e/project-delete.spec.ts`. Use `APIRequestContext` to create projects and the browser only for the user flow. Keep this helper self-contained:

```ts
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

const apiOrigin = 'http://127.0.0.1:3000';

interface ProjectWorkspace {
  readonly id: string;
}

async function createProject(request: APIRequestContext, name: string): Promise<ProjectWorkspace> {
  const response = await request.post(`${apiOrigin}/projects`, {
    data: {
      name,
      customerContactName: 'Deletion E2E Contact',
      customerContactEmail: `delete-${Date.now()}@example.test`,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as ProjectWorkspace;
}

function nativeButton(page: Page, testId: string): Locator {
  return page.getByTestId(testId).locator('button');
}
```

Every ID in this spec belongs to a PrimeNG `p-button` host. Select its native `button` directly: do not fall back to clicking the host, so a missing control fails fast.

Add these four tests:

```ts
test('does not send DELETE when the user cancels', async ({ page, request }) => {
  const project = await createProject(request, 'Cancel deletion');
  let deleteCount = 0;
  page.on('request', (requestEvent) => {
    if (
      requestEvent.method() === 'DELETE' &&
      requestEvent.url().includes(`/api/projects/${project.id}`)
    ) {
      deleteCount += 1;
    }
  });

  await page.goto(`/projects/${project.id}`);
  await nativeButton(page, 'delete-project-button').click();
  await expect(page.getByTestId('project-delete-confirmation')).toBeVisible();
  await expect(nativeButton(page, 'cancel-project-delete-button')).toBeFocused();
  await nativeButton(page, 'cancel-project-delete-button').click();
  expect(deleteCount).toBe(0);
});

test('deletes an eligible draft and returns to the list', async ({ page, request }) => {
  const project = await createProject(request, 'Confirm deletion');
  await page.goto(`/projects/${project.id}`);
  await nativeButton(page, 'delete-project-button').click();
  const deleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'DELETE' &&
      response.url().includes(`/api/projects/${project.id}`),
  );
  await nativeButton(page, 'confirm-project-delete-button').click();
  expect((await deleteResponse).status()).toBe(204);
  await expect(page).toHaveURL(/\/$/);
  expect((await request.get(`${apiOrigin}/projects/${project.id}/cockpit`)).status()).toBe(404);
});

test('keeps a stale cockpit open after a server-side delete conflict', async ({ page, request }) => {
  const project = await createProject(request, 'Stale deletion conflict');
  await page.goto(`/projects/${project.id}`);
  await nativeButton(page, 'delete-project-button').click();
  expect(
    (
      await request.patch(`${apiOrigin}/projects/${project.id}/workspace`, {
        data: { status: 'WAITING_INTERNAL' },
      })
    ).status(),
  ).toBe(200);

  const deleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'DELETE' &&
      response.url().includes(`/api/projects/${project.id}`),
  );
  await nativeButton(page, 'confirm-project-delete-button').click();
  expect((await deleteResponse).status()).toBe(409);
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
  await expect(page.getByTestId('cockpit-action-error')).toContainText(/cannot be deleted/i);
  await expect(page.getByTestId('cockpit-action-error')).not.toContainText(
    /PostgreSQL|customer_follow_ups|audit_events|stack/i,
  );
});

test('hides deletion for a non-DRAFT cockpit', async ({ page, request }) => {
  const project = await createProject(request, 'Hidden non-draft deletion');
  expect(
    (
      await request.patch(`${apiOrigin}/projects/${project.id}/workspace`, {
        data: { status: 'WAITING_INTERNAL' },
      })
    ).status(),
  ).toBe(200);
  await page.goto(`/projects/${project.id}`);
  await expect(page.getByTestId('delete-project-button')).toHaveCount(0);
});
```

- [ ] **Step 2: Run the focused browser spec and confirm it is red.**

Run:

```powershell
pnpm --filter @project-maker/web exec playwright test e2e/project-delete.spec.ts
```

Expected: FAIL because the cockpit has no delete control or confirmation dialog. Confirm that the local E2E database safety guard accepts the configured database before proceeding.

- [ ] **Step 3: Add the client method and safe client error mapping.**

Add this method to `ProjectApiService` beside archive and restore:

```ts
deleteProject(projectId: string): Observable<void> {
  return this.http
    .delete<void>(`/api/projects/${encodeURIComponent(projectId)}`)
    .pipe(catchError((error: unknown) => this.fail(error, 'delete the project')));
}
```

Add this highest-priority `409` branch in the existing `followUpErrorNextStep` function before its generic `409` return:

```ts
if (action === 'delete the project') {
  return 'The project now has persisted activity and cannot be deleted. Archive it instead.';
}
```

Do not read or concatenate the HTTP error body. The existing error mapper must continue to log only action, status, and status text.

- [ ] **Step 4: Add local confirmation, deletion state, and action guards in the cockpit component.**

Import `Router` from `@angular/router`, `ConfirmationService` from `primeng/api`, and `ConfirmDialog` from `primeng/confirmdialog`. Add `ConfirmDialog` to the standalone `imports` array and `ConfirmationService` to the component `providers` array. Add these fields and methods:

```ts
private readonly confirmationService = inject(ConfirmationService);
private readonly router = inject(Router);

readonly deleting = signal(false);

requestProjectDeletion(): void {
  if (
    !this.isDeletableDraft() ||
    this.deleting() ||
    this.transitioning() ||
    this.saving() ||
    this.followUpSaving() ||
    this.pinging() ||
    this.reviewSending()
  ) {
    return;
  }
  this.confirmationService.confirm({
    key: 'project-delete',
    header: 'Delete project?',
    message: 'Deletion is permanent. It succeeds only while this draft has no persisted activity.',
    defaultFocus: 'none',
    accept: () => this.deleteProject(),
  });
}

deleteProject(): void {
  if (
    !this.isDeletableDraft() ||
    this.deleting() ||
    this.transitioning() ||
    this.saving() ||
    this.followUpSaving() ||
    this.pinging() ||
    this.reviewSending()
  ) {
    return;
  }
  this.deleting.set(true);
  this.actionError.set(null);
  this.feedback.set(null);
  this.api.deleteProject(this.projectId).subscribe({
    next: () => {
      this.deleting.set(false);
      void this.router.navigate(['/']);
    },
    error: (error: Error) => {
      this.actionError.set(error.message);
      this.deleting.set(false);
    },
  });
}

isDeletableDraft(): boolean {
  return this.view()?.cockpit.status === 'DRAFT';
}
```

Add `this.deleting()` to every current mutation guard and disable expression: workspace save, follow-up save, follow-up ping, customer-review email, archive, and restore. Keep the guards explicit; do not create a multi-mode flag or silently ignore a failure.

- [ ] **Step 5: Add the draft-only danger card and custom confirmation footer.**

Place this after the existing lifecycle `p-card` in `project-cockpit.page.html`. It stays inside the current cockpit sidebar and does not require a global overlay or a project-list action.

```html
@if (isDeletableDraft()) {
  <p-card>
    <ng-template #title>Delete project</ng-template>
    <p>Deletion is permanent and only works before the project has persisted activity.</p>
    <p-button
      label="Delete project"
      severity="danger"
      [outlined]="true"
      [loading]="deleting()"
      [disabled]="deleting() || transitioning() || saving() || followUpSaving() || pinging() || reviewSending()"
      data-testid="delete-project-button"
      (onClick)="requestProjectDeletion()"
    />
  </p-card>
}

<p-confirmdialog #projectDeletionDialog key="project-delete" [defaultFocus]="'none'">
  <ng-template #footer>
    <div data-testid="project-delete-confirmation">
      <p-button
        label="Cancel"
        [autofocus]="true"
        data-testid="cancel-project-delete-button"
        (onClick)="projectDeletionDialog.onReject()"
      />
      <p-button
        label="Delete project"
        severity="danger"
        data-testid="confirm-project-delete-button"
        (onClick)="projectDeletionDialog.onAccept()"
      />
    </div>
  </ng-template>
</p-confirmdialog>
```

The local v22 `ConfirmDialog` exposes `onAccept()` and `onReject()` and supports a `footer` template. The explicit `autofocus` on Cancel provides the approved safe initial focus while the custom footer supplies stable browser selectors.

- [ ] **Step 6: Run the focused browser spec, web typecheck, and review the UI diff.**

Run:

```powershell
pnpm --filter @project-maker/web typecheck
pnpm --filter @project-maker/web exec playwright test e2e/project-delete.spec.ts
git diff --check
git diff -- apps/web/src/app/projects/project-api.service.ts apps/web/src/app/projects/project-cockpit.page.ts apps/web/src/app/projects/project-cockpit.page.html apps/web/e2e/project-delete.spec.ts
```

Expected: PASS. Confirm cancel sends zero `DELETE` calls, the visible cancel control is focused, eligible deletion routes to `/`, `409` remains on the cockpit, and non-draft pages render no delete trigger. Stop for reviewer/user approval before any Git operation.

## Task 5: Run the feature completion gate and hand off review

**Files:**

- No source edits expected.

**Interfaces:**

- Consumes: all completed Tasks 1–4.
- Produces: evidence that the full repository checks, browser suite, and local Compose smoke support a review decision; it does not create a commit or external publication.

- [ ] **Step 1: Verify the complete repository quality gate.**

Run:

```powershell
pnpm verify
pnpm test:e2e
```

Expected: PASS. `pnpm verify` covers contracts build preparation, recursive tests, and production builds; `pnpm test:e2e` runs the full real-browser suite against the guarded local E2E database.

- [ ] **Step 2: Run the local container configuration and smoke gate only after confirming local test configuration.**

Run:

```powershell
pnpm compose:config
pnpm compose:up
```

Expected: PASS and healthy Compose services. Do not substitute a production `.env` or a remote database URL. If the command cannot run because local prerequisites are absent, report the exact command, error, and missing prerequisite; do not weaken or skip the check.

- [ ] **Step 3: Perform final scope and security review.**

Run:

```powershell
git status --short
git diff --check
git diff --stat
git diff -- apps/api/src/follow-ups/follow-up.service.ts apps/api/src/projects apps/api/test/projects.e2e-spec.ts apps/web/src/app/projects apps/web/e2e/project-delete.spec.ts
```

Verify all of the following before handoff:

- no migration, schema, cascade, dependency, license, or global-provider change;
- no persisted deletion audit event;
- no raw database/error payload reaches the browser;
- API `204`, `404`, and `409` semantics match the plan;
- only the planned source and test files changed, plus the already-approved planning documents.

- [ ] **Step 4: Present evidence and request Git authorization.**

Report the exact commands and pass/fail results, changed files, remaining risks, current branch/HEAD/worktree state, and the fact that the changes remain uncommitted. Ask the user whether to stage, commit, push, or merge. Do not perform any of those actions until explicitly authorized.

## Requirements Traceability

| Approved requirement | Implementing task(s) |
| --- | --- |
| Follow-up read does not block deletion | 1 |
| Empty `DRAFT` receives physical `204` delete | 2 |
| Non-draft and retained activity receive safe `409` | 2, 3 |
| No cascade or deletion audit | 2, 3, 5 |
| Concurrent / late dependency races remain safe | 3 |
| Cockpit-only destructive confirmation | 4 |
| Cancel, focus, navigation, and stale conflict UX | 4 |
| Full verification, runtime smoke, and no implicit Git write | 5 |
