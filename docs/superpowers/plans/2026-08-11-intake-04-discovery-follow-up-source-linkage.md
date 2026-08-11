# INTAKE-04.3b Discovery Follow-up Source Linkage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow employees to attach an open discovery follow-up to its current Initial Intake checklist source, preserve compact provenance after resolution, and safely add, replace, or remove the link.

**Architecture:** The Cockpit remains an orchestration shell. The Discovery follow-ups deep module owns source-option state, relationship draft, confirmation, markup, styles, and browser coverage. The API stores a nullable immutable snapshot foreign key, uses one shared interview-domain current-source selector, and exposes a dedicated relationship command instead of widening generic working-detail PATCH.

**Tech Stack:** Angular 22.1 standalone signals and reactive forms, PrimeNG 22.0, RxJS 7.8, NestJS 11.1, TypeORM 1.1, PostgreSQL 18, class-validator 0.14.2, Playwright 1.62, TypeScript 6, Node 26, and pnpm 11.20.

## Global Constraints

- Implement only the approved [source-linkage design](../specs/2026-08-11-intake-04-discovery-follow-up-source-linkage-design.md).
- Execute from a freshly verified, clean `main` that contains the approved documentation. Create a new `dev-intake-04-source-linkage` branch; do not implement on `dev-intake-04-source-linkage-design`.
- Keep API calls, state, relationship rules, confirmation, markup, local SCSS, and stable selectors inside `apps/web/src/app/projects/discovery-follow-ups/`. Extending the existing operation-ID vocabulary is allowed only to preserve cross-module mutual exclusion.
- A new/replacement link must use the newest open `INITIAL_INTAKE` by `createdAt DESC, id ASC`, falling back to newest completed by the same ordering. Historical links stay readable and are never automatically repointed or cleared.
- Creation accepts omitted `sourceSnapshotId` for unlinked records; explicit creation `null` is invalid. The dedicated command requires `sourceSnapshotId` and accepts a UUID or explicit `null` to remove.
- Generic `PATCH` remains only its five working fields plus `expectedVersion` and rejects `sourceSnapshotId` through the existing whitelist.
- Migration `0011` adds nullable `source_snapshot_id` with a `round_question_snapshots(id) ON DELETE RESTRICT` foreign key and an index. Down reverses index, foreign key, column.
- Every real source mutation locks project then follow-up, checks archive/open/version state, increments the TypeORM version once, and writes one redacted audit event in the same transaction.
- Same-target commands and empty removals are no-ops: unchanged response/version and no audit. Evaluate the no-op after lifecycle/version checks but before new-candidate validation so a historical source stays a harmless no-op after a later intake becomes current.
- Candidate selection shows order/topic/control point/full question. Cards and audits show only compact order/topic/control point, never source UUID, full question, answers, rationales, owner, next step, or version.
- Source-options failure is visible/retriable but does not block unlinked creation, readable history, or source removal. Resolved rows have no source controls. Archive clears source drafts and closes local confirmation.
- Do not change global styles, style budgets, Angular/PrimeNG versions, dependencies, lockfile, Cockpit shell markup/state, interview UI, readiness UI/output, customer follow-up, project lifecycle, authorization, or notification behavior.
- Use stable `data-testid` selectors and real database/API/browser flows. An aborted source-options browser request is permitted only to prove the isolated failure/retry path.
- Context7 was selected for PrimeNG confirmation behavior, but its query endpoint returned HTTP 503 during planning. Before the UI task, retry Context7 if available; otherwise the installed `primeng@22.0.0` declarations are the version-accurate primary source: `ConfirmDialog.key` matches the confirmation key and `onAccept()`/`onReject()` are public. The installed `class-validator@0.14.2` source confirms `IsOptional` cannot be used because it treats null as omitted.
- Run migrations and browser checks only against disposable loopback PostgreSQL databases whose names contain `e2e` or `test`. Never print database URLs, passwords, answers, or tokens.
- Never stage, commit, push, create a pull request, or merge without a refreshed WORK_STATE, final diff review, verification evidence, and explicit user approval.

---

## File Map

| File | Change | Responsibility |
| --- | --- | --- |
| `packages/contracts/src/discovery-follow-ups.ts` | Modify | Source candidate/reference contracts, optional create source, command input, response source. |
| `apps/api/src/migrations/0011-discovery-follow-up-source-linkage.ts` | Create | Nullable relationship, restrictive FK, index, reversible migration. |
| `apps/api/src/database/migration-data-source.ts` | Modify | Register `0011`. |
| `apps/api/src/interviews/current-initial-intake-source.ts` | Create | Shared deterministic source-round selection. |
| `apps/api/src/readiness/readiness.service.ts` | Modify | Consume the selector instead of retaining a private duplicate. |
| `apps/api/src/discovery-follow-ups/discovery-follow-up.entity.ts` | Modify | Map `sourceSnapshotId`. |
| `apps/api/src/discovery-follow-ups/dto/discovery-follow-up-details.dto.ts` | Create | Shared five-field working-detail validators. |
| `apps/api/src/discovery-follow-ups/dto/create-discovery-follow-up.dto.ts` | Modify | Omitted-or-UUID source validation. |
| `apps/api/src/discovery-follow-ups/dto/update-discovery-follow-up.dto.ts` | Modify | Details plus version only; no source field. |
| `apps/api/src/discovery-follow-ups/dto/set-discovery-follow-up-source-link.dto.ts` | Create | UUID-or-null command validation. |
| `apps/api/src/discovery-follow-ups/discovery-follow-ups.controller.ts` | Modify | Source options GET and source-link PUT. |
| `apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts` | Modify | Mapping, eligibility, creation, mutation, and audit. |
| `apps/api/test/projects.e2e-spec.ts` | Modify | Real migration/API/audit/lifecycle/provenance proof. |
| `apps/web/src/app/projects/cockpit-operation-policy.ts` | Modify | Add `discovery-source-link` operation ID only. |
| `apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts` | Modify | Typed read/command adapters and useful error mapping. |
| `apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts` | Modify | Local forms, options, confirmation, mutually exclusive actions. |
| `apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html` | Modify | Optional source selector, compact display, local dialog, stable selectors. |
| `apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.scss` | Modify | Local source-link styles. |
| `apps/web/e2e/discovery-follow-ups.spec.ts` | Modify | Real browser workflows and regressions. |
| `docs/assets/user-guide/08-discovery-source-linkage.png` | Create after verification | Sanitized guide visual. |
| `docs/roadmap.md`, `docs/product-domain.md`, `docs/user-guide.md`, `docs/operations-handoff.md`, `.planning/STATE.md` | Modify after verification | Current delivered-state documentation only. |

## Produced Interfaces

~~~ts
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

export interface SetDiscoveryFollowUpSourceLinkInput {
  readonly sourceSnapshotId: string | null;
  readonly expectedVersion: number;
}

export async function findCurrentInitialIntakeSource(
  manager: EntityManager,
  projectId: string,
): Promise<InterviewRoundEntity | null>;
~~~

~~~text
GET /projects/:projectId/discovery-follow-ups/source-options
PUT /projects/:projectId/discovery-follow-ups/:followUpId/source-link
~~~

## Execution Bootstrap

Before implementation, refresh state and verify that the approved documentation is already in the clean main baseline:

~~~powershell
& C:\Users\littl\.agents\tools\work-state-preflight.ps1 -RepositoryPath (Get-Location).Path -OutputFormat Markdown
git status --short
git branch --show-current
git rev-parse HEAD
git worktree list --porcelain
git remote -v
git fetch origin --prune
git rev-parse origin/main
git log -1 --oneline origin/main
~~~

Only after explicit user permission for the branch action:

~~~powershell
git switch main
git pull --ff-only origin main
git switch -c dev-intake-04-source-linkage
~~~

Use the existing safe Playwright bootstrap for full browser tests. For focused API checks, start an explicit disposable loopback PostgreSQL container, set `DATABASE_URL` only for the active shell, run migrations, and stop that exact container after each task. Do not output the generated connection string.

### Task 1: Establish the persistence, DTO, and source-selection boundaries

**Files:**

- Modify: `packages/contracts/src/discovery-follow-ups.ts`
- Create: `apps/api/src/migrations/0011-discovery-follow-up-source-linkage.ts`
- Modify: `apps/api/src/database/migration-data-source.ts`
- Create: `apps/api/src/interviews/current-initial-intake-source.ts`
- Modify: `apps/api/src/readiness/readiness.service.ts`
- Modify: `apps/api/src/discovery-follow-ups/discovery-follow-up.entity.ts`
- Create: `apps/api/src/discovery-follow-ups/dto/discovery-follow-up-details.dto.ts`
- Modify: `apps/api/src/discovery-follow-ups/dto/create-discovery-follow-up.dto.ts`
- Modify: `apps/api/src/discovery-follow-ups/dto/update-discovery-follow-up.dto.ts`
- Create: `apps/api/src/discovery-follow-ups/dto/set-discovery-follow-up-source-link.dto.ts`
- Modify: `apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts`
- Modify: `apps/api/test/projects.e2e-spec.ts`

**Interfaces:**

- Consumes: current discovery contracts, migrations `0006`–`0010`, strict
  global ValidationPipe, the Readiness source-round rule, and TypeORM version
  entities.
- Produces: a nullable relationship, source-safe DTO inheritance, and a shared
  source-round function used by two domain consumers.
- Preserves: all old follow-ups are unlinked and return `source: null`;
  readiness keeps its current open-first/completed-fallback result.

- [ ] **Step 1: Add red response and whitelist assertions.**

In the existing discovery creation/list E2E case, assert explicit null
provenance:

~~~ts
assert.equal(later.body.source, null);
assert.equal(earlier.body.source, null);
assert.equal(reloadedLater.source, null);
~~~

Extend the existing local reload cast so this assertion remains type-checked:

~~~ts
as {
  decisionOrAnswer: string | null;
  version: number;
  source: null;
} | undefined;
~~~

Add a generic PATCH request that has every valid detail field plus an extra
source field and assert `400` and input redaction:

~~~ts
const rejectedPatch = await request(app.getHttpServer())
  .patch('/projects/' + projectId + '/discovery-follow-ups/' + later.body.id)
  .send({
    category: later.body.category,
    question: later.body.question,
    owner: later.body.owner,
    dueDate: later.body.dueDate,
    nextStep: later.body.nextStep,
    expectedVersion: later.body.version,
    sourceSnapshotId: '00000000-0000-4000-8000-000000000099',
  })
  .expect(400);

assertNoSubmittedValues(
  rejectedPatch.body,
  '00000000-0000-4000-8000-000000000099',
);
~~~

- [ ] **Step 2: Prove the tests are red on a disposable migrated database.**

~~~powershell
pnpm --filter @project-maker/api migration:run
pnpm --filter @project-maker/api exec tsc --project ./test/tsconfig.json
node --test apps/api/dist-test/test/projects.e2e-spec.js
~~~

Expected: the source-null assertion fails before mapper/entity work. The
generic PATCH assertion remains as a guard for Task 1's DTO extraction.

- [ ] **Step 3: Add contracts and DTOs that isolate source linkage from PATCH.**

Add the two source interfaces and command input shown in **Produced
Interfaces**. Add this optional property to `CreateDiscoveryFollowUpInput`:

~~~ts
readonly sourceSnapshotId?: string;
~~~

Append this exact response field to `DiscoveryFollowUp`:

~~~ts
readonly source: DiscoveryFollowUpSourceReference | null;
~~~

Create `discovery-follow-up-details.dto.ts` with the five existing validators:

~~~ts
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  discoveryFollowUpCategories,
  type DiscoveryFollowUpCategory,
} from '@project-maker/contracts/discovery-follow-ups';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
const nonBlankPattern = /\S/;

export class DiscoveryFollowUpDetailsDto {
  @IsIn(discoveryFollowUpCategories)
  category!: DiscoveryFollowUpCategory;

  @IsString()
  @IsNotEmpty()
  @Matches(nonBlankPattern)
  @MaxLength(10_000)
  question!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(nonBlankPattern)
  @MaxLength(255)
  owner!: string;

  @IsString()
  @Matches(dateOnlyPattern)
  @IsISO8601({ strict: true })
  dueDate!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(nonBlankPattern)
  @MaxLength(10_000)
  nextStep!: string;
}
~~~

Make the create DTO extend it and accept only omission or UUID:

~~~ts
import { IsUUID, ValidateIf } from 'class-validator';

@ValidateIf((_object, value) => value !== undefined)
@IsUUID()
sourceSnapshotId?: string;
~~~

Make `UpdateDiscoveryFollowUpDto` extend `DiscoveryFollowUpDetailsDto`, then
retain only its existing `@IsInt() @Min(1) expectedVersion` property. It must
not extend create. Create the command DTO:

~~~ts
import { IsInt, IsUUID, Min, ValidateIf } from 'class-validator';

export class SetDiscoveryFollowUpSourceLinkDto
  implements SetDiscoveryFollowUpSourceLinkInput
{
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  sourceSnapshotId!: string | null;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
~~~

The global ValidationPipe does not skip missing/null values. Consequently
omitted command source reaches `IsUUID` and fails, explicit command null skips
only `IsUUID`, omitted create skips all source validators, and explicit create
null fails UUID validation.

- [ ] **Step 4: Create migration `0011` and map the nullable entity field.**

Create `apps/api/src/migrations/0011-discovery-follow-up-source-linkage.ts`:

~~~ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DiscoveryFollowUpSourceLinkage0011DiscoveryFollowUpSourceLinkage1786780800000
  implements MigrationInterface
{
  name = 'DiscoveryFollowUpSourceLinkage0011DiscoveryFollowUpSourceLinkage1786780800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "discovery_follow_ups" ADD COLUMN "source_snapshot_id" uuid',
    );
    await queryRunner.query(`
      ALTER TABLE "discovery_follow_ups"
      ADD CONSTRAINT "fk_discovery_follow_ups_source_snapshot"
      FOREIGN KEY ("source_snapshot_id")
      REFERENCES "round_question_snapshots"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_discovery_follow_ups_source_snapshot_id"
      ON "discovery_follow_ups" ("source_snapshot_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "idx_discovery_follow_ups_source_snapshot_id"',
    );
    await queryRunner.query(`
      ALTER TABLE "discovery_follow_ups"
      DROP CONSTRAINT "fk_discovery_follow_ups_source_snapshot"
    `);
    await queryRunner.query(
      'ALTER TABLE "discovery_follow_ups" DROP COLUMN "source_snapshot_id"',
    );
  }
}
~~~

Register it after migration `0010`. Add this entity mapping:

~~~ts
@Column({ name: 'source_snapshot_id', type: 'uuid', nullable: true })
sourceSnapshotId!: string | null;
~~~

For this task, pass `source: null` through the mapper for existing rows. Task
2 replaces it with a batch-loaded immutable projection before any feature flow
can create a link.

- [ ] **Step 5: Extract the shared deterministic source selector and refactor Readiness.**

Create `apps/api/src/interviews/current-initial-intake-source.ts`:

~~~ts
import { EntityManager } from 'typeorm';

import { InterviewRoundEntity } from './interview-round.entity';

export async function findCurrentInitialIntakeSource(
  manager: EntityManager,
  projectId: string,
): Promise<InterviewRoundEntity | null> {
  const rounds = manager.getRepository(InterviewRoundEntity);
  const openRound = await rounds.findOne({
    where: { projectId, type: 'INITIAL_INTAKE', status: 'OPEN' },
    order: { createdAt: 'DESC', id: 'ASC' },
  });
  if (openRound) {
    return openRound;
  }
  return rounds.findOne({
    where: { projectId, type: 'INITIAL_INTAKE', status: 'COMPLETED' },
    order: { createdAt: 'DESC', id: 'ASC' },
  });
}
~~~

In Readiness replace the private method call with:

~~~ts
const sourceRound = await findCurrentInitialIntakeSource(
  this.dataSource.manager,
  projectId,
);
~~~

Remove only the redundant private selector and unused entity import.

- [ ] **Step 6: Prove migration reversibility and narrow regressions.**

~~~powershell
pnpm --filter @project-maker/api migration:run
pnpm --filter @project-maker/api migration:revert
pnpm --filter @project-maker/api migration:run
pnpm --filter @project-maker/api exec tsc --project ./test/tsconfig.json
node --test apps/api/dist-test/test/projects.e2e-spec.js apps/api/dist-test/test/question-rounds.e2e-spec.js
pnpm --filter @project-maker/contracts build
pnpm --filter @project-maker/api typecheck
git diff --check
~~~

Expected: `0011` alone reverses/reapplies; legacy discovery responses return
null source; generic PATCH rejects source; readiness keeps its exact source
selection behavior.

- [ ] **Step 7: Review this task without Git mutation.**

~~~powershell
git diff -- packages/contracts/src/discovery-follow-ups.ts apps/api/src/migrations/0011-discovery-follow-up-source-linkage.ts apps/api/src/database/migration-data-source.ts apps/api/src/interviews/current-initial-intake-source.ts apps/api/src/readiness/readiness.service.ts apps/api/src/discovery-follow-ups apps/api/test/projects.e2e-spec.ts
~~~

Expected: no dependency, Cockpit shell, interview UI, or readiness-output
change. Stop the exact disposable container and restore the prior
`DATABASE_URL` before beginning Task 2.

### Task 2: Deliver source options, historical mapping, and optional linked creation

**Files:**

- Modify: `apps/api/src/discovery-follow-ups/discovery-follow-ups.controller.ts`
- Modify: `apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts`
- Modify: `apps/api/test/projects.e2e-spec.ts`

**Interfaces:**

- Consumes: Task 1 contracts/entity/selector/DTOs and immutable round snapshots.
- Produces: a source-options read, batch historical projection, and optional
  linked creation.
- Preserves: archived projects can read candidates, unlinked creation requires
  no intake, and generic PATCH remains source-free.

- [ ] **Step 1: Write failing candidate and linked-creation API tests.**

Add a test helper that obtains one seeded base-question stable key, publishes a
one-question schema with `required: false` and `blocking: false`, then creates
an `INITIAL_INTAKE`. It returns the real snapshot:

~~~ts
async function createInitialIntakeSource(
  projectId: string,
): Promise<{
  readonly roundId: string;
  readonly snapshot: {
    readonly id: string;
    readonly order: number;
    readonly topic: string;
    readonly controlPoint: string;
    readonly text: string;
  };
}> {
  const bank = await request(app.getHttpServer())
    .get('/settings/base-questions')
    .expect(200);
  const stableKey = bank.body.questions[0]?.stableKey as string | undefined;
  if (!stableKey) {
    throw new Error('Seeded question bank did not provide a source stable key.');
  }
  await request(app.getHttpServer())
    .post('/projects/' + projectId + '/question-schema')
    .send({
      questions: [{ stableKey, required: false, blocking: false }],
    })
    .expect(201);
  const round = await request(app.getHttpServer())
    .post('/projects/' + projectId + '/rounds')
    .send({ type: 'INITIAL_INTAKE' })
    .expect(201);
  return { roundId: round.body.id, snapshot: round.body.questions[0] };
}
~~~

Write the source-options expectation:

~~~ts
const options = await request(app.getHttpServer())
  .get('/projects/' + projectId + '/discovery-follow-ups/source-options')
  .expect(200);

assert.deepEqual(options.body, [
  {
    snapshotId: source.snapshot.id,
    order: source.snapshot.order,
    topic: source.snapshot.topic,
    controlPoint: source.snapshot.controlPoint,
    text: source.snapshot.text,
  },
]);
~~~

Then create a linked follow-up:

~~~ts
const created = await request(app.getHttpServer())
  .post('/projects/' + projectId + '/discovery-follow-ups')
  .send({
    category: 'BUSINESS',
    question: 'Which discovery decision still needs proof?',
    owner: 'Product owner',
    dueDate: '2026-10-01',
    nextStep: 'Review the intake evidence.',
    sourceSnapshotId: source.snapshot.id,
  })
  .expect(201);

assert.deepEqual(created.body.source, {
  snapshotId: source.snapshot.id,
  order: source.snapshot.order,
  topic: source.snapshot.topic,
  controlPoint: source.snapshot.controlPoint,
});
assert.equal(created.body.version, 1);
~~~

Add independent tests for:

1. no current source returns `[]`, including after project archive;
2. unlinked creation succeeds with no source round and returns `source: null`;
3. explicit creation `sourceSnapshotId: null` returns `400` and does not echo a
   submitted free-text marker;
4. a well-formed foreign-project or non-current snapshot returns `409` and
   writes neither follow-up nor audit; and
5. linked creation's one existing audit event is exactly:

~~~ts
{
  event_type: 'DISCOVERY_FOLLOW_UP_CREATED',
  payload: {
    followUpId: created.body.id,
    category: 'BUSINESS',
    dueDate: '2026-10-01',
    status: 'Nyitott',
    sourceOrder: String(source.snapshot.order),
    sourceTopic: source.snapshot.topic,
    sourceControlPoint: source.snapshot.controlPoint,
  },
}
~~~

Use `assert.doesNotMatch(JSON.stringify(auditRows), ...)` to prove the audit
does not contain the source snapshot ID or full source text.

- [ ] **Step 2: Run the focused tests and retain the intended failure.**

~~~powershell
pnpm --filter @project-maker/api migration:run
pnpm --filter @project-maker/api exec tsc --project ./test/tsconfig.json
node --test apps/api/dist-test/test/projects.e2e-spec.js
~~~

Expected: FAIL because the static source-options route, batch source mapper,
and linked creation behavior are absent.

- [ ] **Step 3: Implement batch historical source projection.**

Import `In`, `RoundQuestionSnapshotEntity`, source contracts, and the shared
selector. Keep mapping deterministic and avoid one query per list row:

~~~ts
async function loadSourceSnapshotsByFollowUp(
  manager: EntityManager,
  followUps: readonly DiscoveryFollowUpEntity[],
): Promise<ReadonlyMap<string, RoundQuestionSnapshotEntity>> {
  const ids = followUps
    .map((followUp) => followUp.sourceSnapshotId)
    .filter((id): id is string => id !== null);
  if (ids.length === 0) {
    return new Map();
  }
  const snapshots = await manager.getRepository(RoundQuestionSnapshotEntity).findBy({
    id: In(ids),
  });
  return new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
}

function toSourceReference(
  snapshot: RoundQuestionSnapshotEntity,
): DiscoveryFollowUpSourceReference {
  return {
    snapshotId: snapshot.id,
    order: snapshot.order,
    topic: snapshot.topic,
    controlPoint: snapshot.controlPoint,
  };
}
~~~

When an entity has a non-null source ID missing from storage, fail loudly with
`InternalServerErrorException('Stored discovery follow-up source is missing.')`.
A null ID maps to null. Use the same helper for single returned rows, and the
batch map for `list`.

- [ ] **Step 4: Add the source-options read route.**

Implement the service read without a lifecycle mutation lock:

~~~ts
async listSourceOptions(
  projectId: string,
): Promise<readonly DiscoveryFollowUpSourceOption[]> {
  await findProject(this.dataSource, projectId);
  const sourceRound = await findCurrentInitialIntakeSource(
    this.dataSource.manager,
    projectId,
  );
  if (!sourceRound) {
    return [];
  }
  const snapshots = await this.dataSource
    .getRepository(RoundQuestionSnapshotEntity)
    .find({
      where: { roundId: sourceRound.id },
      order: { order: 'ASC', id: 'ASC' },
    });
  return snapshots.map((snapshot) => ({
    snapshotId: snapshot.id,
    order: snapshot.order,
    topic: snapshot.topic,
    controlPoint: snapshot.controlPoint,
    text: snapshot.text,
  }));
}
~~~

Add the static controller route before `@Get()`:

~~~ts
@Get('source-options')
listSourceOptions(
  @Param('projectId', new ParseUUIDPipe()) projectId: string,
): Promise<readonly DiscoveryFollowUpSourceOption[]> {
  return this.discoveryFollowUpsService.listSourceOptions(projectId);
}
~~~

- [ ] **Step 5: Implement linked creation and the one safe creation audit.**

Resolve a supplied UUID only inside the existing project-locked creation
transaction:

~~~ts
async function requireCurrentSourceSnapshot(
  manager: EntityManager,
  projectId: string,
  sourceSnapshotId: string,
): Promise<RoundQuestionSnapshotEntity> {
  const sourceRound = await findCurrentInitialIntakeSource(manager, projectId);
  if (!sourceRound) {
    throw new ConflictException('No current Initial Intake source is available.');
  }
  const snapshot = await manager.getRepository(RoundQuestionSnapshotEntity).findOneBy({
    id: sourceSnapshotId,
    roundId: sourceRound.id,
  });
  if (!snapshot) {
    throw new ConflictException(
      'Selected source is not part of the current Initial Intake.',
    );
  }
  return snapshot;
}
~~~

Store source ID only when supplied:

~~~ts
const sourceSnapshot =
  input.sourceSnapshotId === undefined
    ? null
    : await requireCurrentSourceSnapshot(
        manager,
        projectId,
        input.sourceSnapshotId,
      );

const saved = await manager.getRepository(DiscoveryFollowUpEntity).save({
  id: randomUUID(),
  projectId,
  category: input.category,
  question: normalizeRequiredText(input.question, 'question must not be blank.'),
  owner: normalizeRequiredText(input.owner, 'owner must not be blank.'),
  dueDate: parseDueDate(input.dueDate),
  status: await initialDiscoveryFollowUpStatus(),
  decisionOrAnswer: null,
  nextStep: normalizeRequiredText(input.nextStep, 'nextStep must not be blank.'),
  sourceSnapshotId: sourceSnapshot?.id ?? null,
});
~~~

Extend the existing creation audit only with compact fields when
`followUp.source` is non-null:

~~~ts
...(followUp.source
  ? {
      sourceOrder: String(followUp.source.order),
      sourceTopic: followUp.source.topic,
      sourceControlPoint: followUp.source.controlPoint,
    }
  : {}),
~~~

Do not create a second audit event.

- [ ] **Step 6: Run the focused API proof and review the boundary.**

~~~powershell
pnpm --filter @project-maker/api exec tsc --project ./test/tsconfig.json
node --test apps/api/dist-test/test/projects.e2e-spec.js
pnpm --filter @project-maker/contracts build
pnpm --filter @project-maker/api typecheck
git diff --check
git diff -- apps/api/src/discovery-follow-ups/discovery-follow-ups.controller.ts apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts apps/api/test/projects.e2e-spec.ts
~~~

Expected: PASS. Full text exists only in candidate responses; cards/audits
receive compact provenance; no source round never prevents unlinked creation.
Stop the task database and restore the prior `DATABASE_URL` before Task 3.

### Task 3: Implement the locked source-link command and redacted audit policy

**Files:**

- Modify: `apps/api/src/discovery-follow-ups/discovery-follow-ups.controller.ts`
- Modify: `apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts`
- Modify: `apps/api/test/projects.e2e-spec.ts`

**Interfaces:**

- Consumes: Task 1 command DTO/contract and Task 2 source resolver/projection,
  plus existing project/follow-up lock helpers and status policy.
- Produces: `PUT source-link` with versioned add/replace/remove, safe no-op,
  resolved provenance, and one redacted audit event per real relationship write.
- Preserves: create, generic edit, resolution, source-options, project
  ownership, lifecycle, and audit history behavior.

- [ ] **Step 1: Write failing relationship, lifecycle, provenance, and audit tests.**

Create a first non-required Initial Intake source, link a follow-up to it,
complete it through `POST /projects/:projectId/rounds/:roundId/complete`, then
create a second open Initial Intake. This proves historical display and
current-only replacement eligibility.

Use the dedicated command for actual mutations:

~~~ts
const added = await request(app.getHttpServer())
  .put(
    '/projects/' +
      projectId +
      '/discovery-follow-ups/' +
      followUp.id +
      '/source-link',
  )
  .send({
    sourceSnapshotId: currentSource.snapshot.id,
    expectedVersion: followUp.version,
  })
  .expect(200);

const removed = await request(app.getHttpServer())
  .put(
    '/projects/' +
      projectId +
      '/discovery-follow-ups/' +
      followUp.id +
      '/source-link',
  )
  .send({
    sourceSnapshotId: null,
    expectedVersion: added.body.version,
  })
  .expect(200);
~~~

Assert in dedicated cases:

1. add, replace, and remove each advance the version once and return compact
   source or null;
2. same-target add and already-empty removal return `200`, unchanged version,
   and unchanged source-link audit count;
3. a same-target request for a historical first source stays a no-op after the
   second source becomes current, while selecting another non-current snapshot
   returns `409`;
4. stale version, archived project, resolved follow-up, malformed UUID, missing
   `sourceSnapshotId`, invalid `expectedVersion`, foreign project/follow-up,
   and foreign/ineligible snapshot return `400`, `404`, or `409` without data
   or audit change;
5. resolved linked rows retain source in `GET discovery-follow-ups` and reject
   direct source command with `409`;
6. an initially valid command followed by the same original version is a
   deterministic stale-write `409` and does not add a second audit event; and
7. JSON errors omit submitted UUID/free-text markers, table/SQL wording, and
   stack trace wording.

Compare the replacement audit exactly:

~~~ts
{
  event_type: 'DISCOVERY_FOLLOW_UP_SOURCE_LINK_CHANGED',
  payload: {
    followUpId: followUp.id,
    sourceAction: 'REPLACED',
    previousSourceOrder: String(firstSource.snapshot.order),
    previousSourceTopic: firstSource.snapshot.topic,
    previousSourceControlPoint: firstSource.snapshot.controlPoint,
    sourceOrder: String(secondSource.snapshot.order),
    sourceTopic: secondSource.snapshot.topic,
    sourceControlPoint: secondSource.snapshot.controlPoint,
  },
}
~~~

For `ADDED` omit all previous-source keys. For `REMOVED` omit all next-source
keys. Assert no source-link audit payload contains snapshot ID or question text.

- [ ] **Step 2: Compile and run the red source-command tests.**

~~~powershell
pnpm --filter @project-maker/api migration:run
pnpm --filter @project-maker/api exec tsc --project ./test/tsconfig.json
node --test apps/api/dist-test/test/projects.e2e-spec.js
~~~

Expected: FAIL because no source-link route or transaction behavior exists.

- [ ] **Step 3: Add the narrow controller route.**

Import `Put` and `SetDiscoveryFollowUpSourceLinkDto`, then add:

~~~ts
@Put(':followUpId/source-link')
@HttpCode(HttpStatus.OK)
setSourceLink(
  @Param('projectId', new ParseUUIDPipe()) projectId: string,
  @Param('followUpId', new ParseUUIDPipe()) followUpId: string,
  @Body() input: SetDiscoveryFollowUpSourceLinkDto,
): Promise<DiscoveryFollowUp> {
  return this.discoveryFollowUpsService.setSourceLink(
    projectId,
    followUpId,
    input,
  );
}
~~~

Do not add a source field to PATCH or a generic persistence route.

- [ ] **Step 4: Implement locked no-op before candidate validation, then real mutation.**

Add `setSourceLink` in the service following this order:

~~~ts
return this.dataSource.transaction(async (manager) => {
  const project = await findLockedProject(manager, projectId);
  rejectArchivedProjectForSourceLinking(project);

  const entity = await findLockedDiscoveryFollowUp(
    manager,
    projectId,
    followUpId,
  );
  if (entity.status !== (await initialDiscoveryFollowUpStatus())) {
    throw new ConflictException('Discovery follow-up is not open.');
  }
  if (entity.version !== input.expectedVersion) {
    throw new ConflictException('Discovery follow-up has changed.');
  }

  const previousSnapshot = await requireStoredSourceSnapshot(
    manager,
    entity.sourceSnapshotId,
  );
  if (entity.sourceSnapshotId === input.sourceSnapshotId) {
    return toDiscoveryFollowUp(entity, previousSnapshot);
  }

  const nextSnapshot =
    input.sourceSnapshotId === null
      ? null
      : await requireCurrentSourceSnapshot(
          manager,
          projectId,
          input.sourceSnapshotId,
        );
  entity.sourceSnapshotId = nextSnapshot?.id ?? null;
  const saved = await manager.getRepository(DiscoveryFollowUpEntity).save(entity);
  const followUp = toDiscoveryFollowUp(saved, nextSnapshot);
  await saveDiscoveryFollowUpSourceLinkAuditEvent(
    manager,
    followUp,
    previousSnapshot ? toSourceReference(previousSnapshot) : null,
  );
  return followUp;
});
~~~

`requireStoredSourceSnapshot` returns null for a null ID and fails with the
same explicit internal consistency error for a non-null missing snapshot.
Never revalidate historical snapshots in list, generic edit, resolution, or
same-target no-op.

- [ ] **Step 5: Write the source-link audit helper with no identifier leak.**

Derive the action and string-only payload solely from compact references:

~~~ts
const sourceAction =
  previousSource === null
    ? 'ADDED'
    : followUp.source === null
      ? 'REMOVED'
      : 'REPLACED';

const payload: AuditPayload = {
  followUpId: followUp.id,
  sourceAction,
  ...(previousSource
    ? {
        previousSourceOrder: String(previousSource.order),
        previousSourceTopic: previousSource.topic,
        previousSourceControlPoint: previousSource.controlPoint,
      }
    : {}),
  ...(followUp.source
    ? {
        sourceOrder: String(followUp.source.order),
        sourceTopic: followUp.source.topic,
        sourceControlPoint: followUp.source.controlPoint,
      }
    : {}),
};
~~~

Save it with event type `DISCOVERY_FOLLOW_UP_SOURCE_LINK_CHANGED` in the same
manager transaction. Do not pass source UUID, question text, answer, rationale,
owner, next step, version, or expected version to the helper.

For existing `update` and `resolve` return paths, load and return stored source
provenance without evaluating current eligibility.

- [ ] **Step 6: Run focused command and regression checks.**

~~~powershell
pnpm --filter @project-maker/api exec tsc --project ./test/tsconfig.json
node --test apps/api/dist-test/test/projects.e2e-spec.js apps/api/dist-test/test/question-rounds.e2e-spec.js
pnpm --filter @project-maker/contracts build
pnpm --filter @project-maker/api typecheck
git diff --check
~~~

Expected: PASS. Every actual relationship write has exactly one safe audit
event, all no-op/historical paths avoid writes, and existing follow-up/readiness
flows still pass.

- [ ] **Step 7: Review the API seam without staging.**

~~~powershell
git diff -- apps/api/src/discovery-follow-ups apps/api/test/projects.e2e-spec.ts
~~~

Expected: no error message/audit payload exposes source UUID or sensitive
source content. Stop the task database and restore `DATABASE_URL` before
browser work.

### Task 4: Define real-browser acceptance tests before changing the UI

**Files:**

- Modify: `apps/web/e2e/discovery-follow-ups.spec.ts`

**Interfaces:**

- Consumes: completed real API routes and the existing Playwright bootstrap.
- Produces: stable, user-workflow acceptance tests for source selection,
  relationship changes, failure recovery, archive handling, and history.
- Preserves: all five existing discovery browser workflows and their stable
  selector discipline.

- [ ] **Step 1: Add a real Initial Intake source fixture.**

Create a helper in the existing browser spec that creates a project, gets one
seeded base-question stable key, publishes a non-required one-question schema,
and creates an actual `INITIAL_INTAKE`. Return its first immutable snapshot:

~~~ts
interface SourceSnapshot {
  readonly id: string;
  readonly order: number;
  readonly topic: string;
  readonly controlPoint: string;
  readonly text: string;
}

async function createSourceLinkageFixture(
  request: APIRequestContext,
): Promise<{ readonly project: ProjectWorkspace; readonly source: SourceSnapshot }> {
  const project = await createProject(request, 'Discovery source linkage browser flow');
  const bankResponse = await request.get(apiOrigin + '/settings/base-questions');
  expect(bankResponse.status()).toBe(200);
  const bank = (await bankResponse.json()) as {
    readonly questions: readonly { readonly stableKey: string }[];
  };
  const stableKey = bank.questions[0]?.stableKey;
  if (!stableKey) {
    throw new Error('Seeded question bank did not provide a stable key.');
  }
  const schemaResponse = await request.post(
    apiOrigin + '/projects/' + project.id + '/question-schema',
    {
      data: { questions: [{ stableKey, required: false, blocking: false }] },
    },
  );
  expect(schemaResponse.status()).toBe(201);
  const roundResponse = await request.post(
    apiOrigin + '/projects/' + project.id + '/rounds',
    { data: { type: 'INITIAL_INTAKE' } },
  );
  expect(roundResponse.status()).toBe(201);
  const round = (await roundResponse.json()) as {
    readonly questions: readonly SourceSnapshot[];
  };
  const source = round.questions[0];
  if (!source) {
    throw new Error('Initial Intake did not create a source snapshot.');
  }
  return { project, source };
}
~~~

- [ ] **Step 2: Add failing creation and relationship browser workflows.**

Add tests using only these stable IDs:

1. `discovery-follow-up-source-select` shows full source text; creating a
   linked follow-up returns `201`; after reload its
   `discovery-follow-up-source-reference` shows compact order/topic/control
   point but does not contain the source text.
2. `link-discovery-follow-up-source-button` opens
   `discovery-follow-up-source-link-form` and disables all Edit, Resolve, Link,
   Change, and Remove actions across rows.
3. `discovery-follow-up-source-link-select` plus
   `save-discovery-follow-up-source-link-button` sends `PUT 200` and survives
   reload.
4. `change-discovery-follow-up-source-button` creates one deliberate
   replacement. `remove-discovery-follow-up-source-button` opens
   `discovery-follow-up-source-remove-confirmation`; Cancel leaves data intact
   and Confirm sends a `PUT` with null.
5. After real resolution, the linked row retains compact provenance and has no
   Link/Change/Remove test IDs.

Scope duplicated IDs to a specific row:

~~~ts
const item = page
  .getByTestId('discovery-follow-up-item')
  .filter({ has: page.getByTestId('discovery-follow-up-source-reference') });

await expect(item.getByTestId('discovery-follow-up-source-reference')).toContainText(
  String(fixture.source.order),
);
await expect(item).not.toContainText(fixture.source.text);
~~~

- [ ] **Step 3: Add failing isolated options-error and archive tests.**

Abort only the next source-options GET, never a successful API flow:

~~~ts
let abortNextSourceOptions = true;
await page.route(
  '**/api/projects/' + project.id + '/discovery-follow-ups/source-options',
  async (route) => {
    if (abortNextSourceOptions && route.request().method() === 'GET') {
      abortNextSourceOptions = false;
      await route.abort('failed');
      return;
    }
    await route.continue();
  },
);
~~~

Assert visible `discovery-follow-up-source-options-error` and
`retry-discovery-follow-up-source-options-button`, then create an unlinked
follow-up successfully. Retry the real request and assert the selector is
usable. In a separate test, open a source-link form and removal confirmation,
archive through the existing real cockpit control, then assert no local draft
or confirmation remains and source actions stay disabled until restore.

- [ ] **Step 4: Run the focused browser file and retain the expected failure.**

~~~powershell
pnpm --dir apps/web exec playwright test discovery-follow-ups.spec.ts
~~~

Expected: the new selectors and UI behavior fail; existing browser tests remain
the immediate regression safety net.

### Task 5: Implement the deep-module source-link user experience

**Files:**

- Modify: `apps/web/src/app/projects/cockpit-operation-policy.ts`
- Modify: `apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts`
- Modify: `apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts`
- Modify: `apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html`
- Modify: `apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.scss`
- Modify: `apps/web/e2e/discovery-follow-ups.spec.ts`

**Interfaces:**

- Consumes: Tasks 2–3 API behavior, existing Cockpit operation leases, local
  PrimeNG 22 confirmation pattern, and Task 4 tests.
- Produces: optional creation linkage, compact history, link/change/remove,
  explicit confirmation, independent failure/retry, and mutually exclusive UI.
- Preserves: source state remains in the deep module, while the Cockpit only
  continues to emit its existing committed-change refresh.

- [ ] **Step 1: Add the source-link operation ID and typed adapter calls.**

Append `'discovery-source-link'` to `cockpitOperationIds` after
`'discovery-update'`. Do not alter Cockpit page signals, markup, provider, or
styles.

Extend the operation union/map:

~~~ts
export type DiscoveryOperation =
  | 'load'
  | 'load-source-options'
  | 'create'
  | 'update'
  | 'set-source-link'
  | 'resolve';

const discoveryActions: Readonly<Record<DiscoveryOperation, string>> = {
  load: 'load discovery follow-ups',
  'load-source-options': 'load Initial Intake source options',
  create: 'create a discovery follow-up',
  update: 'update a discovery follow-up',
  'set-source-link': 'change the discovery follow-up source',
  resolve: 'resolve a discovery follow-up',
};
~~~

Add adapter methods:

~~~ts
listSourceOptions(
  projectId: string,
): Observable<readonly DiscoveryFollowUpSourceOption[]> {
  return this.http
    .get<readonly DiscoveryFollowUpSourceOption[]>(
      '/api/projects/' +
        encodeURIComponent(projectId) +
        '/discovery-follow-ups/source-options',
    )
    .pipe(catchError((error: unknown) => this.fail(error, 'load-source-options')));
}

setSourceLink(
  projectId: string,
  followUpId: string,
  input: SetDiscoveryFollowUpSourceLinkInput,
): Observable<DiscoveryFollowUp> {
  return this.http
    .put<DiscoveryFollowUp>(
      '/api/projects/' +
        encodeURIComponent(projectId) +
        '/discovery-follow-ups/' +
        encodeURIComponent(followUpId) +
        '/source-link',
      input,
    )
    .pipe(catchError((error: unknown) => this.fail(error, 'set-source-link')));
}
~~~

Map source-link `409` to an instruction to refresh candidates and choose
again. Never render server request bodies or identifiers.

- [ ] **Step 2: Add module-local source options/forms and archive clearing.**

Import and locally provide `ConfirmationService`; import standalone
`ConfirmDialog`. Add source module signals and its required inline-form control:

~~~ts
readonly sourceOptions = signal<readonly DiscoveryFollowUpSourceOption[]>([]);
readonly sourceOptionsLoading = signal(true);
readonly sourceOptionsError = signal<string | null>(null);
readonly openedSourceLinkId = signal<string | null>(null);
readonly savingSourceLinkId = signal<string | null>(null);
readonly sourceLinkBaseline = signal<DiscoveryFollowUp | null>(null);

readonly sourceLinkForm = new FormGroup({
  sourceSnapshotId: new FormControl<string | null>(null, {
    validators: [Validators.required],
  }),
});
~~~

Add an unvalidated `sourceSnapshotId: new FormControl<string | null>(null)` to
the creation form. Call `loadFollowUps()` and `loadSourceOptions()`
independently from `ngOnInit`. On archive clear source state and call local
`confirmationService.close()`.

Implement independent source-option state exactly as follows:

~~~ts
loadSourceOptions(): void {
  this.sourceOptionsLoading.set(true);
  this.sourceOptionsError.set(null);
  this.api
    .listSourceOptions(this.projectId())
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (options) => {
        this.sourceOptions.set(options);
        this.sourceOptionsLoading.set(false);
      },
      error: (error: Error) => {
        this.sourceOptionsError.set(error.message);
        this.sourceOptionsLoading.set(false);
      },
    });
}

private clearSourceLinkState(): void {
  this.openedSourceLinkId.set(null);
  this.savingSourceLinkId.set(null);
  this.sourceLinkBaseline.set(null);
  this.sourceLinkForm.reset({ sourceSnapshotId: null });
}
~~~

Create choices whose label contains full source text only during selection:

~~~ts
readonly sourceOptionChoices = computed(() =>
  this.sourceOptions().map((option) => ({
    label:
      '#' +
      option.order +
      ' · ' +
      option.topic +
      ' · ' +
      option.controlPoint +
      ' — ' +
      option.text,
    value: option.snapshotId,
  })),
);
~~~

When creation has no selected source, omit the property:

~~~ts
...(value.sourceSnapshotId === null
  ? {}
  : { sourceSnapshotId: value.sourceSnapshotId }),
~~~

- [ ] **Step 3: Implement mutually exclusive link/change/save/cancel behavior.**

Add `openedSourceLinkId` to the current edit and resolution guard predicates.
Open only a current, open row when no other row action/form exists and source
options are successfully loaded and non-empty:

~~~ts
openSourceLink(followUpId: string): void {
  const followUp = this.followUps().find((candidate) => candidate.id === followUpId);
  if (
    !followUp ||
    !this.isCanonicalOpen(followUp) ||
    this.sourceLinkActionDisabled() ||
    this.sourceOptionsLoading() ||
    this.sourceOptionsError() !== null ||
    this.sourceOptions().length === 0
  ) {
    return;
  }
  this.actionError.set(null);
  this.sourceLinkForm.reset({ sourceSnapshotId: null });
  this.sourceLinkBaseline.set(followUp);
  this.openedSourceLinkId.set(followUpId);
}
~~~

Use the baseline version as `expectedVersion`, acquire
`'discovery-source-link'`, replace only the returned list row, clear the local
form, send success feedback, and emit `committedChange`. On `400`/`409` keep
the selected draft and active form; display the typed adapter error. Cancel
only clears local source state. Both Link and Change start blank so selecting a
new current source is deliberate. An existing link may still be removed when
no candidates are available.

Define the action guard and source save using the existing lease/finalize
pattern:

~~~ts
sourceLinkActionDisabled(): boolean {
  return (
    this.mutationDisabled() ||
    this.openedEditId() !== null ||
    this.openedResolutionId() !== null ||
    this.openedSourceLinkId() !== null
  );
}

saveSourceLink(followUpId: string): void {
  const baseline = this.sourceLinkBaseline();
  const selectedSourceId = this.sourceLinkForm.getRawValue().sourceSnapshotId;
  if (
    !baseline ||
    baseline.id !== followUpId ||
    selectedSourceId === null ||
    this.mutationDisabled() ||
    this.savingSourceLinkId() !== null
  ) {
    return;
  }
  const lease = this.operationPolicy.tryAcquire('discovery-source-link');
  if (!lease) {
    return;
  }
  this.savingSourceLinkId.set(followUpId);
  this.actionError.set(null);
  this.api
    .setSourceLink(this.projectId(), followUpId, {
      sourceSnapshotId: selectedSourceId,
      expectedVersion: baseline.version,
    })
    .pipe(
      finalize(() => this.savingSourceLinkId.set(null)),
      releaseCockpitOperationOnFinalize(lease),
      takeUntilDestroyed(this.destroyRef),
    )
    .subscribe({
      next: (updated) => {
        this.followUps.update((current) =>
          sortDiscoveryFollowUps(
            current.map((candidate) =>
              candidate.id === updated.id ? updated : candidate,
            ),
          ),
        );
        this.clearSourceLinkState();
        this.feedback.set('Discovery follow-up source updated.');
        this.committedChange.emit();
      },
      error: (error: Error) => this.actionError.set(error.message),
    });
}
~~~

- [ ] **Step 4: Render compact sources and a local explicit removal confirmation.**

Use the local confirmation service:

~~~ts
this.confirmationService.confirm({
  key: 'discovery-follow-up-source-remove',
  header: 'Remove source link?',
  message:
    'This removes the recorded origin. A later intake round may make the old source unavailable for reattachment.',
  defaultFocus: 'none',
  accept: () => this.removeSourceLink(followUp),
});
~~~

Implement removal through the same command, not by editing the local row:

~~~ts
removeSourceLink(followUp: DiscoveryFollowUp): void {
  if (
    !this.isCanonicalOpen(followUp) ||
    followUp.source === null ||
    this.sourceLinkActionDisabled()
  ) {
    return;
  }
  const lease = this.operationPolicy.tryAcquire('discovery-source-link');
  if (!lease) {
    return;
  }
  this.savingSourceLinkId.set(followUp.id);
  this.actionError.set(null);
  this.api
    .setSourceLink(this.projectId(), followUp.id, {
      sourceSnapshotId: null,
      expectedVersion: followUp.version,
    })
    .pipe(
      finalize(() => this.savingSourceLinkId.set(null)),
      releaseCockpitOperationOnFinalize(lease),
      takeUntilDestroyed(this.destroyRef),
    )
    .subscribe({
      next: (updated) => {
        this.followUps.update((current) =>
          sortDiscoveryFollowUps(
            current.map((candidate) =>
              candidate.id === updated.id ? updated : candidate,
            ),
          ),
        );
        this.feedback.set('Discovery follow-up source removed.');
        this.committedChange.emit();
      },
      error: (error: Error) => this.actionError.set(error.message),
    });
}
~~~

Place the private dialog in this component:

~~~html
<p-confirmdialog
  #sourceRemovalDialog
  key="discovery-follow-up-source-remove"
  [defaultFocus]="'none'"
>
  <ng-template #footer>
    <div data-testid="discovery-follow-up-source-remove-confirmation">
      <p-button
        label="Cancel"
        [autofocus]="true"
        data-testid="cancel-discovery-follow-up-source-remove-button"
        (onClick)="sourceRemovalDialog.onReject()"
      />
      <p-button
        label="Remove source"
        severity="danger"
        data-testid="confirm-discovery-follow-up-source-remove-button"
        (onClick)="sourceRemovalDialog.onAccept()"
      />
    </div>
  </ng-template>
</p-confirmdialog>
~~~

Render cards with only:

~~~html
@if (followUp.source; as source) {
  <p data-testid="discovery-follow-up-source-reference">
    <strong>Source:</strong>
    #{{ source.order }} · {{ source.topic }} · {{ source.controlPoint }}
  </p>
}
~~~

No card or dialog binds source snapshot ID. Resolved rows render this compact
display but no source action IDs.

- [ ] **Step 5: Add selector/error markup and minimal local styles.**

Inside creation form, render:

~~~html
<p-select
  inputId="discovery-follow-up-source"
  styleClass="full-width"
  formControlName="sourceSnapshotId"
  [options]="sourceOptionChoices()"
  optionLabel="label"
  optionValue="value"
  [disabled]="sourceOptionsLoading() || sourceOptionsError() !== null"
  data-testid="discovery-follow-up-source-select"
/>
~~~

Render `discovery-follow-up-source-options-error`,
`retry-discovery-follow-up-source-options-button`, and
`discovery-follow-up-source-options-empty` around it. Use the same choices in
the inline `discovery-follow-up-source-link-form` with
`discovery-follow-up-source-link-select`, save, and cancel IDs. Add only local
grid/flex/border-top SCSS matching current edit/resolution conventions. Do not
edit `project-cockpit.page.scss` or build budget configuration.

The inline form is open only for the selected row and must use the form state
from Step 3:

~~~html
@if (openedSourceLinkId() === followUp.id) {
  <form
    class="discovery-follow-up-source-link-form"
    [formGroup]="sourceLinkForm"
    (ngSubmit)="saveSourceLink(followUp.id)"
    data-testid="discovery-follow-up-source-link-form"
  >
    <p-select
      inputId="discovery-follow-up-source-link"
      styleClass="full-width"
      formControlName="sourceSnapshotId"
      [options]="sourceOptionChoices()"
      optionLabel="label"
      optionValue="value"
      data-testid="discovery-follow-up-source-link-select"
    />
    <p-button
      type="submit"
      label="Save source"
      [disabled]="sourceLinkForm.invalid || savingSourceLinkId() !== null"
      data-testid="save-discovery-follow-up-source-link-button"
    />
    <p-button
      type="button"
      label="Cancel"
      severity="secondary"
      [outlined]="true"
      [disabled]="savingSourceLinkId() !== null"
      data-testid="cancel-discovery-follow-up-source-link-button"
      (onClick)="clearSourceLinkState()"
    />
  </form>
}
~~~

- [ ] **Step 6: Run focused UI tests and quality gates.**

~~~powershell
pnpm --filter @project-maker/web typecheck
pnpm --dir apps/web exec playwright test discovery-follow-ups.spec.ts
pnpm --filter @project-maker/web build
git diff --check
~~~

Expected: focused browser tests pass via real API. If the known Cockpit SCSS
warning remains 175 B over budget, prove it is byte-for-byte unchanged from the
clean base and that no Cockpit SCSS/budget file changed; any new warning or
increase is a regression to fix.

- [ ] **Step 7: Review deep-module locality without staging.**

~~~powershell
git diff -- apps/web/src/app/projects/cockpit-operation-policy.ts apps/web/src/app/projects/discovery-follow-ups apps/web/e2e/discovery-follow-ups.spec.ts
~~~

Expected: the sole shared change is the operation ID; business state, rules,
markup, SCSS, and browser tests remain co-located in Discovery follow-ups.

### Task 6: Verify the complete slice, then synchronize delivery documentation

**Files:**

- Create: `docs/assets/user-guide/08-discovery-source-linkage.png`
- Modify: `docs/roadmap.md`
- Modify: `docs/product-domain.md`
- Modify: `docs/user-guide.md`
- Modify: `docs/operations-handoff.md`
- Modify: `.planning/STATE.md`

**Interfaces:**

- Consumes: passing code/test evidence from Tasks 1–5.
- Produces: current-state product, employee, operational, and planning
  documentation that represents delivered behavior only.
- Preserves: the separation between discovery work items and customer-email
  follow-ups, plus all remaining independent roadmap opportunities.

- [ ] **Step 1: Run complete verification on a fresh disposable database.**

Set `DATABASE_URL` to a newly created localhost database whose name contains
`source_linkage_full_e2e`, then run:

~~~powershell
pnpm typecheck
pnpm --filter @project-maker/api test
pnpm --filter @project-maker/web build
pnpm test:e2e
pnpm verify
~~~

Expected: every command passes. The Playwright bootstrap may reset only that
disposable loopback database before migrations. Record new suite counts only
when actually observed; do not reuse earlier results.

- [ ] **Step 2: Capture and inspect a sanitized user-guide visual.**

Use the successful real-browser fixture to capture one open linked follow-up
with its compact reference—not the selector's full question text. Save it at
`docs/assets/user-guide/08-discovery-source-linkage.png` and inspect it at
original resolution. It may contain synthetic project wording only; it must
not contain a token, password, customer personal data, answer, rationale, or
UUID.

- [ ] **Step 3: Update roadmap and product-domain current state.**

In `docs/roadmap.md`, move `INTAKE-04.3b` to DELIVERED with this verified
boundary: optional linked creation, current-source candidates, open-only
add/change/remove, resolved historical provenance, version/no-op/audit
safeguards, and real API/browser evidence. Update parent `INTAKE-04` to say its
accepted planned scope is complete without claiming customer scheduling,
lifecycle, SCORE-01.2, or other unrelated work.

In `docs/product-domain.md`, add that a discovery follow-up has zero or one
immutable source snapshot; new/replacement eligibility is open Initial Intake
first/completed fallback; a later intake does not rewrite old links; resolved
provenance is immutable; and cards/audits intentionally use compact human
reference rather than source ID/full question.

- [ ] **Step 4: Update employee, operational, and planning documents.**

In `docs/user-guide.md`:

1. add the new image in the Discovery follow-up section;
2. add optional source selection to creation;
3. explain Link, Change, removal confirmation, isolated retry, no-source
   state, conflict recovery, resolved immutability, and archive draft clearing;
4. replace the existing statement that checklist/source linkage is unavailable;
5. explain that full question text is only a selection aid, while cards/audits
   preserve compact provenance.

In `docs/operations-handoff.md`, add migration `0011` to the expected list,
document its restricted foreign key/index/down order, both routes, safe audit
shape, and that rollback removes only the relationship objects. Do not place
credentials, source UUIDs, answers, or source text in the handoff.

In `.planning/STATE.md`, update delivery state from fresh verification evidence
and keep unrelated future features explicitly planned.

- [ ] **Step 5: Review docs, assets, and scope.**

~~~powershell
git diff --check
git diff --stat
git diff -- docs/roadmap.md docs/product-domain.md docs/user-guide.md docs/operations-handoff.md .planning/STATE.md
Test-Path -LiteralPath 'docs/assets/user-guide/08-discovery-source-linkage.png' -PathType Leaf
rg -n "sourceSnapshotId|snapshotId" docs/user-guide.md docs/operations-handoff.md docs/roadmap.md docs/product-domain.md
~~~

Expected: no employee/operations document exposes source UUID. The image exists
and was visually inspected. Documentation calls only verified behavior
delivered. Stop the final disposable database and restore `DATABASE_URL`.

### Task 7: Final review and explicit Git handoff

**Files:**

- Review: every file listed in **File Map**.

**Interfaces:**

- Consumes: final verification and documentation results, plus refreshed local
  and remote Git state.
- Produces: an evidence-backed review packet. Commit, push, PR, and merge
  remain user-authorized actions rather than automatic plan steps.

- [ ] **Step 1: Run the required state gate and security/scope review.**

~~~powershell
& C:\Users\littl\.agents\tools\work-state-preflight.ps1 -RepositoryPath (Get-Location).Path -OutputFormat Markdown
git status --short
git diff --check
git diff --name-only
git diff -- apps/api/src/discovery-follow-ups apps/api/src/interviews/current-initial-intake-source.ts apps/api/src/readiness/readiness.service.ts apps/web/src/app/projects/discovery-follow-ups apps/web/src/app/projects/cockpit-operation-policy.ts apps/api/test/projects.e2e-spec.ts apps/web/e2e/discovery-follow-ups.spec.ts docs .planning/STATE.md
~~~

Verify explicitly:

1. only bounded source-link API/UI/tests/docs paths changed;
2. no dependencies, lockfile, global styles, budgets, Cockpit shell, interview
   UI, or readiness output changed;
3. generic PATCH cannot accept source;
4. source UUID/full question/answers/rationales/owner/next-step/version are not
   present in source-link audits, employee docs, or client error copy;
5. migration `0011` down order is index, foreign key, column; and
6. a known Cockpit SCSS warning, if emitted, is unchanged from base rather than
   newly worsened.

- [ ] **Step 2: Present evidence and request separate Git authorization.**

Report fresh WORK_STATE, changed paths, migration proof, focused/full
test/build results, screenshot inspection, and any unchanged known warning.
Ask explicitly for permission to stage and commit the exact reviewed files; do
not infer authorization from plan approval.

- [ ] **Step 3: Only after authorization, stage and commit the verified slice.**

Refresh WORK_STATE immediately before staging, inspect the staged diff, then
use this exact bounded set:

~~~powershell
git add packages/contracts/src/discovery-follow-ups.ts apps/api/src/migrations/0011-discovery-follow-up-source-linkage.ts apps/api/src/database/migration-data-source.ts apps/api/src/interviews/current-initial-intake-source.ts apps/api/src/readiness/readiness.service.ts apps/api/src/discovery-follow-ups apps/api/test/projects.e2e-spec.ts apps/web/src/app/projects/cockpit-operation-policy.ts apps/web/src/app/projects/discovery-follow-ups apps/web/e2e/discovery-follow-ups.spec.ts docs .planning/STATE.md
git diff --cached --check
git diff --cached --stat
git commit -m "feat(intake-04): link follow-ups to intake sources"
~~~

After commit, invalidate the old state record and run the preflight again.
Push, create a pull request, and merge only after the user also explicitly
authorizes those external GitHub actions and refreshed branch/PR state is
unambiguous.

## Plan Self-Review

**Spec coverage:** Tasks 1–3 cover persistence, DTO isolation, shared source
selection, source options, linked creation, locks, lifecycle, version/no-op,
historical provenance, and audit redaction. Tasks 4–5 cover all employee
workflows, confirmation, failure/retry, archive behavior, stable selectors, and
deep-module locality. Tasks 6–7 cover proof, documentation, screenshot
hygiene, and controlled delivery.

**Type consistency:** `sourceSnapshotId` is only the internal relationship
input/storage identifier; `source` is the returned compact reference;
`DiscoveryFollowUpSourceOption` is a candidate; and
`SetDiscoveryFollowUpSourceLinkInput` is the relationship command. The helper
name, routes, and `discovery-source-link` operation ID remain consistent across
all tasks.

**Safety review:** The plan depends on installed PrimeNG 22/class-validator
semantics, real API/database/browser tests, reversible migration proof, a
strict audit redaction boundary, and no automatic Git mutation.
