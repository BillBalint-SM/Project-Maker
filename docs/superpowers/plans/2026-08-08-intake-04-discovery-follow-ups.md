# INTAKE-04.1 Discovery Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first accountable discovery-follow-up vertical slice: a user can create and review a categorised, owner-assigned, date-only follow-up in the project cockpit.

**Architecture:** Add a new discovery-follow-ups domain module and PostgreSQL table; keep it completely separate from the existing customer-email follow-up schedule. The shared contracts define the closed category vocabulary and data shape, the API owns canonical-status assignment, validation, lifecycle locking, persistence, audit, and deletion retention, and the Cockpit consumes the list/create boundary through its existing load-and-action pattern.

**Tech Stack:** Angular 22 reactive forms, PrimeNG 22 DatePicker/Select, NestJS 11, TypeORM 1.1, PostgreSQL, node:test + Supertest, Playwright, pnpm 11.20.0.

## Global Constraints

- Begin execution only after a fresh WORK_STATE preflight, user approval of an execution approach, and a new short-lived branch named dev-intake-04-discovery-follow-ups. Do not reuse an already merged branch.
- Scope is only INTAKE-04.1: create and review discovery follow-ups. Do not add edit, delete, close, resolve, decision/answer, source linkage, scoring, reminders, email, auth, role, or collaboration behavior.
- Keep customer email scheduling at /projects/:projectId/follow-up unchanged. The new plural resource is exactly GET and POST /projects/:projectId/discovery-follow-ups.
- Define the category vocabulary once in the contracts package: BUSINESS, SCOPE, TECHNICAL, DATA, INTEGRATION, SECURITY, OPERATIONS, OTHER. Do not derive it from labels or duplicate it in web or API code.
- Store status as varchar and derive the initial value from generalPlaybookV1.statuses.followUp. The current canonical value is Nyitott, but production code must not create another status constant, enum, or vocabulary.
- Persist dueDate as a PostgreSQL DATE and serialize the browser’s local calendar year, month, and day to YYYY-MM-DD. Never use Date.prototype.toISOString() for this field.
- The API must validate and normalise on the server even when the browser validates first. Error responses must not echo submitted question, owner, nextStep, raw SQL, table names, or stack details.
- Creation must lock the project and save the row plus one safe audit event in one transaction. Archived projects remain readable but reject creation with 409; restoring re-enables creation.
- A persisted discovery follow-up is retained project activity: the project service must check it directly and the foreign key must use ON DELETE RESTRICT. Preserve the existing generic mapping of SQLSTATE 23001 and 23503 to deletion 409.
- Follow repository patterns: explicit raw-SQL migrations with a destructive down method, TypeORM entities, ParseUUIDPipe, the global ValidationPipe, node:test/Supertest real PostgreSQL tests, and stable data-testid selectors.
- Context7 was used for TypeORM’s version-sensitive migration/date guidance. The exact PrimeNG 22 DatePicker behavior is verified from the installed package: dateFormat accepts yy-mm-dd, where yy is a four-digit year and mm/dd are zero-padded; set that format explicitly for a deterministic date-only input.
- Use an isolated localhost PostgreSQL database whose database name includes e2e or test for migrations and browser E2E. The Playwright bootstrap resets the public schema; never point it at a shared or production database.
- The repository’s normal PATH resolves an incompatible Node/pnpm combination. Every verification command in this plan uses the compatible local runtime variables shown below; do not modify global tooling.
- Do not stage, commit, push, create a PR, or merge as part of this plan. Each task ends at a reviewer gate; publication needs a separate explicit user approval.

## File Map

| File | Change | Responsibility |
| --- | --- | --- |
| packages/contracts/src/discovery-follow-ups.ts | Create | Closed category values and request/response types shared by API and web. |
| packages/contracts/src/index.ts | Modify | Export the discovery-follow-up contract surface. |
| packages/contracts/test/discovery-follow-ups.test.mjs | Create | Prove exported categories and canonical initial-status source. |
| apps/api/src/migrations/0006-discovery-follow-ups.ts | Create | Create/drop table, enum, trigger, and ordering index. |
| apps/api/src/database/migration-data-source.ts | Modify | Register migration 0006 after 0005. |
| apps/api/src/discovery-follow-ups/discovery-follow-up.entity.ts | Create | TypeORM persistence mapping for one discovery follow-up. |
| apps/api/src/discovery-follow-ups/dto/create-discovery-follow-up.dto.ts | Create | HTTP body validation with no writable status field. |
| apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts | Create | List/create transaction, normalization, canonical status, and safe audit policy. |
| apps/api/src/discovery-follow-ups/discovery-follow-ups.controller.ts | Create | UUID-guarded GET and POST HTTP boundary. |
| apps/api/src/discovery-follow-ups/discovery-follow-ups.module.ts | Create | Module-local repositories, controller, and service wiring. |
| apps/api/src/app.module.ts | Modify | Load the new domain module and its entity metadata. |
| apps/api/src/projects/projects.service.ts | Modify | Treat a discovery-follow-up row as retained deletion activity. |
| apps/api/src/projects/projects.module.ts | Modify | Make the direct deletion-guard entity dependency explicit. |
| apps/api/test/projects.e2e-spec.ts | Modify | Real PostgreSQL tests for list, create, validation, lifecycle, audit, and deletion retention. |
| apps/web/src/app/projects/project-api.models.ts | Modify | Add discoveryFollowUps to CockpitView. |
| apps/web/src/app/projects/project-api.service.ts | Modify | Fetch/list and create methods with safe client error context. |
| apps/web/src/app/projects/project-cockpit.page.ts | Modify | Reactive form, local-date serialization, mutation state, and view updates. |
| apps/web/src/app/projects/project-cockpit.page.html | Modify | Separate full-width discovery card with owned test IDs and archived read-only state. |
| apps/web/src/app/projects/project-cockpit.page.scss | Modify | Focused layout for the new form and ordered list. |
| apps/web/e2e/discovery-follow-ups.spec.ts | Create | Real browser proof of creation, reload persistence, and archive/restore behavior. |
| docs/roadmap.md | Modify after verified delivery | Mark only INTAKE-04.1 delivered; keep broader INTAKE-04 partial/planned. |
| .planning/STATE.md | Modify after verified delivery | Record the delivered sub-slice and retained scope. |
| docs/product-domain.md | Modify after verified delivery | Distinguish discovery follow-ups from customer email scheduling. |
| docs/operations-handoff.md | Modify after verified delivery | Record migration 0006 and route/lifecycle operation facts. |
| docs/README.md | Modify now and after verification as needed | Link the design and this plan; retain one current entry per artifact. |

## Execution Bootstrap

Run these commands only after the execution approach is approved. They establish a current-state and runtime baseline without changing global tooling.

~~~
& C:\Users\littl\.agents\tools\work-state-preflight.ps1 -RepositoryPath (Get-Location).Path -OutputFormat Markdown
git status --short
git branch --show-current
git rev-parse HEAD
git worktree list --porcelain
git remote -v
git switch -c dev-intake-04-discovery-follow-ups

$runtimeNode = 'C:\Program Files\nodejs\node.exe'
$cachedPnpm = 'C:\Users\littl\AppData\Local\npm-cache\_npx\90ee57dca4845993\node_modules\pnpm\bin\pnpm.cjs'
$cachedPnpmBin = 'C:\Users\littl\AppData\Local\npm-cache\_npx\90ee57dca4845993\node_modules\.bin'
$env:Path = "C:\Program Files\nodejs;$cachedPnpmBin;$env:Path"
& $runtimeNode --version
& $runtimeNode $cachedPnpm --version
~~~

Expected result: the preflight identifies the current repository and main baseline before branching; Node satisfies the repository engine range and pnpm reports 11.20.0. If any Git identity, dirty path, upstream, or runtime fact differs from the approved baseline, stop and report it before editing.

### Task 1: Establish the shared discovery-follow-up contract

**Files:**

- Create: packages/contracts/src/discovery-follow-ups.ts
- Modify: packages/contracts/src/index.ts
- Create: packages/contracts/test/discovery-follow-ups.test.mjs

**Interfaces:**

- Consumes: generalPlaybookV1 from packages/contracts/src/index.ts and the immutable general.v1 follow-up status vocabulary.
- Produces:

~~~ts
export const discoveryFollowUpCategories: readonly [
  'BUSINESS',
  'SCOPE',
  'TECHNICAL',
  'DATA',
  'INTEGRATION',
  'SECURITY',
  'OPERATIONS',
  'OTHER',
];

export type DiscoveryFollowUpCategory =
  (typeof discoveryFollowUpCategories)[number];

export interface CreateDiscoveryFollowUpInput {
  readonly category: DiscoveryFollowUpCategory;
  readonly question: string;
  readonly owner: string;
  readonly dueDate: string;
  readonly nextStep: string;
}

export interface DiscoveryFollowUp {
  readonly id: string;
  readonly projectId: string;
  readonly category: DiscoveryFollowUpCategory;
  readonly question: string;
  readonly owner: string;
  readonly dueDate: string;
  readonly status: string;
  readonly nextStep: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
~~~

- Produces no DiscoveryFollowUpStatus type, exported status array, writable initial status, source linkage, or resolution field.

- [ ] **Step 1: Add the contract export test before the implementation.**

Create packages/contracts/test/discovery-follow-ups.test.mjs with this test:

~~~js
import assert from 'node:assert/strict';
import test from 'node:test';

test('discovery follow-ups export the closed categories and use the canonical follow-up status source', async () => {
  const {
    discoveryFollowUpCategories,
    generalPlaybookV1,
  } = await import('../dist/index.js');

  assert.deepEqual(discoveryFollowUpCategories, [
    'BUSINESS',
    'SCOPE',
    'TECHNICAL',
    'DATA',
    'INTEGRATION',
    'SECURITY',
    'OPERATIONS',
    'OTHER',
  ]);
  assert.equal(generalPlaybookV1.statuses.followUp[0], 'Nyitott');
  assert.ok(generalPlaybookV1.statuses.followUp.includes('Nyitott'));
});
~~~

- [ ] **Step 2: Run the focused contract test and prove the export is absent.**

~~~
& $runtimeNode $cachedPnpm --filter @project-maker/contracts build
& $runtimeNode $cachedPnpm --filter @project-maker/contracts exec node --test test/discovery-follow-ups.test.mjs
~~~

Expected result: FAIL because discoveryFollowUpCategories is not yet exported.

- [ ] **Step 3: Add the sole category vocabulary and the two data interfaces.**

Create packages/contracts/src/discovery-follow-ups.ts:

~~~ts
export const discoveryFollowUpCategories = [
  'BUSINESS',
  'SCOPE',
  'TECHNICAL',
  'DATA',
  'INTEGRATION',
  'SECURITY',
  'OPERATIONS',
  'OTHER',
] as const;

export type DiscoveryFollowUpCategory =
  (typeof discoveryFollowUpCategories)[number];

export interface CreateDiscoveryFollowUpInput {
  readonly category: DiscoveryFollowUpCategory;
  readonly question: string;
  readonly owner: string;
  readonly dueDate: string;
  readonly nextStep: string;
}

export interface DiscoveryFollowUp {
  readonly id: string;
  readonly projectId: string;
  readonly category: DiscoveryFollowUpCategory;
  readonly question: string;
  readonly owner: string;
  readonly dueDate: string;
  readonly status: string;
  readonly nextStep: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
~~~

Append this one export beside the other domain exports in packages/contracts/src/index.ts:

~~~ts
export * from './discovery-follow-ups.js';
~~~

- [ ] **Step 4: Build and run the focused contract test.**

~~~
& $runtimeNode $cachedPnpm --filter @project-maker/contracts test
~~~

Expected result: PASS. The existing general.v1 tests still prove the status source stays immutable.

- [ ] **Step 5: Review the narrow contract diff.**

~~~
git diff --check
git diff -- packages/contracts/src/index.ts packages/contracts/src/discovery-follow-ups.ts packages/contracts/test/discovery-follow-ups.test.mjs
~~~

Expected result: exactly one category vocabulary, the two data interfaces, one export, and one focused test. Do not stage or commit; stop for reviewer approval before Task 2.

### Task 2: Add durable storage and a read-only list boundary

**Files:**

- Create: apps/api/src/migrations/0006-discovery-follow-ups.ts
- Modify: apps/api/src/database/migration-data-source.ts
- Create: apps/api/src/discovery-follow-ups/discovery-follow-up.entity.ts
- Create: apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts
- Create: apps/api/src/discovery-follow-ups/discovery-follow-ups.controller.ts
- Create: apps/api/src/discovery-follow-ups/discovery-follow-ups.module.ts
- Modify: apps/api/src/app.module.ts
- Modify: apps/api/test/projects.e2e-spec.ts

**Interfaces:**

- Consumes: DiscoveryFollowUp and DiscoveryFollowUpCategory from @project-maker/contracts.
- Produces:

~~~ts
@Controller('projects/:projectId/discovery-follow-ups')
export class DiscoveryFollowUpsController {
  @Get()
  list(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Promise<readonly DiscoveryFollowUp[]>;
}

export class DiscoveryFollowUpsService {
  constructor(private readonly dataSource: DataSource) {}

  list(projectId: string): Promise<readonly DiscoveryFollowUp[]>;
}
~~~

- Produces the database table discovery_follow_ups and its one ordering index. It does not yet expose POST, a DTO, a form, or deletion-guard integration.

- [ ] **Step 1: Add the failing real-API list tests.**

Insert these node:test cases in the existing ProjectsController E2E describe block:

~~~ts
it('lists no discovery follow-ups for an existing project without writing a row', async () => {
  const projectId = await createProject('discovery-follow-ups-empty');

  const response = await request(app.getHttpServer())
    .get('/projects/' + projectId + '/discovery-follow-ups')
    .expect(200);

  assert.deepEqual(response.body, []);
  const rows = await dataSource.query<Array<{ count: string }>>(
    'SELECT COUNT(*)::text AS "count" FROM "discovery_follow_ups" WHERE "project_id" = $1',
    [projectId],
  );
  assert.equal(rows[0]?.count, '0');
});

it('returns 404 when listing discovery follow-ups for a missing project', async () => {
  await request(app.getHttpServer())
    .get('/projects/00000000-0000-4000-8000-000000000000/discovery-follow-ups')
    .expect(404);
});
~~~

- [ ] **Step 2: Run the API suite and confirm the route is unavailable.**

~~~
& $runtimeNode $cachedPnpm --filter @project-maker/api test
~~~

Expected result: FAIL at the new list test with 404 or a migration/table error, while existing tests provide the regression baseline.

- [ ] **Step 3: Create migration 0006 with the table, exact constraints, trigger, and deterministic-list index.**

Create apps/api/src/migrations/0006-discovery-follow-ups.ts with this migration class and SQL structure:

~~~ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DiscoveryFollowUps0006DiscoveryFollowUps1786348800000
  implements MigrationInterface
{
  name = 'DiscoveryFollowUps0006DiscoveryFollowUps1786348800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "discovery_follow_up_category" AS ENUM (
        'BUSINESS', 'SCOPE', 'TECHNICAL', 'DATA',
        'INTEGRATION', 'SECURITY', 'OPERATIONS', 'OTHER'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "discovery_follow_ups" (
        "id" uuid PRIMARY KEY,
        "project_id" uuid NOT NULL,
        "category" "discovery_follow_up_category" NOT NULL,
        "question" text NOT NULL,
        "owner" varchar(255) NOT NULL,
        "due_date" date NOT NULL,
        "status" varchar(100) NOT NULL,
        "next_step" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_discovery_follow_ups_question_not_blank"
          CHECK (btrim("question") <> ''),
        CONSTRAINT "chk_discovery_follow_ups_question_length"
          CHECK (char_length("question") <= 10000),
        CONSTRAINT "chk_discovery_follow_ups_owner_not_blank"
          CHECK (btrim("owner") <> ''),
        CONSTRAINT "chk_discovery_follow_ups_status_not_blank"
          CHECK (btrim("status") <> ''),
        CONSTRAINT "chk_discovery_follow_ups_next_step_not_blank"
          CHECK (btrim("next_step") <> ''),
        CONSTRAINT "chk_discovery_follow_ups_next_step_length"
          CHECK (char_length("next_step") <= 10000),
        CONSTRAINT "fk_discovery_follow_ups_project"
          FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE FUNCTION "set_discovery_follow_ups_updated_at"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        NEW."updated_at" = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_discovery_follow_ups_updated_at"
      BEFORE UPDATE ON "discovery_follow_ups"
      FOR EACH ROW EXECUTE FUNCTION "set_discovery_follow_ups_updated_at"()
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_discovery_follow_ups_project_due_created_id"
      ON "discovery_follow_ups" ("project_id", "due_date", "created_at", "id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "idx_discovery_follow_ups_project_due_created_id"`,
    );
    await queryRunner.query(
      `DROP TRIGGER "trg_discovery_follow_ups_updated_at" ON "discovery_follow_ups"`,
    );
    await queryRunner.query(`DROP TABLE "discovery_follow_ups"`);
    await queryRunner.query(`DROP FUNCTION "set_discovery_follow_ups_updated_at"()`);
    await queryRunner.query(`DROP TYPE "discovery_follow_up_category"`);
  }
}
~~~

Keep the repository’s readable multiline raw-SQL formatting when writing the actual file; the statements above specify every identifier, constraint, and dependency. Register the named class after InitialIntakeOpenRound0005InitialIntakeOpenRound1786262400000 in apps/api/src/database/migration-data-source.ts.

- [ ] **Step 4: Add the entity, module, service list method, and controller GET route.**

Create apps/api/src/discovery-follow-ups/discovery-follow-up.entity.ts:

~~~ts
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  discoveryFollowUpCategories,
  type DiscoveryFollowUpCategory,
} from '@project-maker/contracts';

@Entity({ name: 'discovery_follow_ups' })
export class DiscoveryFollowUpEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({
    type: 'enum',
    enum: discoveryFollowUpCategories,
    enumName: 'discovery_follow_up_category',
  })
  category!: DiscoveryFollowUpCategory;

  @Column({ type: 'text' })
  question!: string;

  @Column({ type: 'varchar', length: 255 })
  owner!: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate!: string;

  @Column({ type: 'varchar', length: 100 })
  status!: string;

  @Column({ name: 'next_step', type: 'text' })
  nextStep!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
~~~

Create the read path in apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts:

~~~ts
async list(projectId: string): Promise<readonly DiscoveryFollowUp[]> {
  await findProject(this.dataSource.manager, projectId, false);
  const rows = await this.dataSource.getRepository(DiscoveryFollowUpEntity).find({
    where: { projectId },
    order: { dueDate: 'ASC', createdAt: 'ASC', id: 'ASC' },
  });
  return rows.map(toDiscoveryFollowUp);
}

async function findProject(
  manager: EntityManager,
  projectId: string,
  lock: boolean,
): Promise<Project> {
  const project = await manager.getRepository(Project).findOne({
    where: { id: projectId },
    lock: lock ? { mode: 'pessimistic_write' } : undefined,
  });
  if (!project) {
    throw new NotFoundException('Project not found.');
  }
  return project;
}

function toDiscoveryFollowUp(value: DiscoveryFollowUpEntity): DiscoveryFollowUp {
  return {
    id: value.id,
    projectId: value.projectId,
    category: value.category,
    question: value.question,
    owner: value.owner,
    dueDate: value.dueDate,
    status: value.status,
    nextStep: value.nextStep,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}
~~~

Create the controller route:

~~~ts
@Controller('projects/:projectId/discovery-follow-ups')
export class DiscoveryFollowUpsController {
  constructor(
    private readonly discoveryFollowUpsService: DiscoveryFollowUpsService,
  ) {}

  @Get()
  list(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Promise<readonly DiscoveryFollowUp[]> {
    return this.discoveryFollowUpsService.list(projectId);
  }
}
~~~

Create a module with TypeOrmModule.forFeature([DiscoveryFollowUpEntity, Project]), this controller, and this service. Import the module in AppModule. Do not import CustomerFollowUpModule into it and do not create a synthetic default row.

- [ ] **Step 5: Run migration and the full API test suite against the disposable local database.**

~~~
& $runtimeNode $cachedPnpm --filter @project-maker/api migration:run
& $runtimeNode $cachedPnpm --filter @project-maker/api test
& $runtimeNode $cachedPnpm --filter @project-maker/api typecheck
~~~

Expected result: PASS. The list response is [] for a new project, no table row is written, and missing projects remain 404.

- [ ] **Step 6: Review the persistence/read boundary.**

~~~
git diff --check
git diff -- apps/api/src/migrations/0006-discovery-follow-ups.ts apps/api/src/database/migration-data-source.ts apps/api/src/discovery-follow-ups apps/api/src/app.module.ts apps/api/test/projects.e2e-spec.ts
~~~

Expected result: the only public behavior is GET; no create DTO, POST route, or write behavior has slipped in. Do not stage or commit; stop for reviewer approval before Task 3.

### Task 3: Add validated creation, canonical status, lifecycle behavior, and safe audit

**Files:**

- Create: apps/api/src/discovery-follow-ups/dto/create-discovery-follow-up.dto.ts
- Modify: apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts
- Modify: apps/api/src/discovery-follow-ups/discovery-follow-ups.controller.ts
- Modify: apps/api/src/discovery-follow-ups/discovery-follow-ups.module.ts
- Modify: apps/api/test/projects.e2e-spec.ts

**Interfaces:**

- Consumes: CreateDiscoveryFollowUpInput, DiscoveryFollowUp, discoveryFollowUpCategories, generalPlaybookV1, DiscoveryFollowUpEntity, AuditEvent, Project, and the Task 2 list boundary.
- Produces:

~~~ts
export class CreateDiscoveryFollowUpDto
  implements CreateDiscoveryFollowUpInput
{
  category!: DiscoveryFollowUpCategory;
  question!: string;
  owner!: string;
  dueDate!: string;
  nextStep!: string;
}

export class DiscoveryFollowUpsService {
  create(
    projectId: string,
    input: CreateDiscoveryFollowUpInput,
  ): Promise<DiscoveryFollowUp>;
}
~~~

- Produces POST /projects/:projectId/discovery-follow-ups. The client has no writable status field; each successful POST writes exactly one DISCOVERY_FOLLOW_UP_CREATED audit event with four safe keys.

- [ ] **Step 1: Add failing API tests for valid creation, deterministic order, status, audit, archived behavior, and validation.**

Add these focused cases to apps/api/test/projects.e2e-spec.ts. Reuse the existing createProject and assertNoSubmittedValues helpers.

~~~ts
it('creates discovery follow-ups with the canonical initial status and deterministic list order', async () => {
  const projectId = await createProject('discovery-follow-up-create');

  const later = await request(app.getHttpServer())
    .post('/projects/' + projectId + '/discovery-follow-ups')
    .send({
      category: 'TECHNICAL',
      question: '  Which API version is supported?  ',
      owner: '  API team  ',
      dueDate: '2026-09-17',
      nextStep: '  Confirm against the vendor contract.  ',
    })
    .expect(201);
  const earlier = await request(app.getHttpServer())
    .post('/projects/' + projectId + '/discovery-follow-ups')
    .send({
      category: 'BUSINESS',
      question: 'What approval is required?',
      owner: 'Product owner',
      dueDate: '2026-09-16',
      nextStep: 'Book an approval decision.',
    })
    .expect(201);

  assert.equal(later.body.status, 'Nyitott');
  assert.equal(later.body.question, 'Which API version is supported?');
  assert.equal(later.body.owner, 'API team');
  assert.equal(later.body.nextStep, 'Confirm against the vendor contract.');
  assert.equal(later.body.dueDate, '2026-09-17');

  const list = await request(app.getHttpServer())
    .get('/projects/' + projectId + '/discovery-follow-ups')
    .expect(200);
  assert.deepEqual(
    list.body.map((value: { id: string; dueDate: string }) => ({
      id: value.id,
      dueDate: value.dueDate,
    })),
    [
      { id: earlier.body.id, dueDate: '2026-09-16' },
      { id: later.body.id, dueDate: '2026-09-17' },
    ],
  );

  const auditRows = await dataSource.query<
    Array<{ event_type: string; payload: Record<string, unknown> }>
  >(
    'SELECT "event_type", "payload" FROM "audit_events" WHERE "project_id" = $1 AND "event_type" = $2 ORDER BY "created_at" ASC, "id" ASC',
    [projectId, 'DISCOVERY_FOLLOW_UP_CREATED'],
  );
  assert.deepEqual(auditRows, [
    {
      event_type: 'DISCOVERY_FOLLOW_UP_CREATED',
      payload: {
        followUpId: later.body.id,
        category: 'TECHNICAL',
        dueDate: '2026-09-17',
        status: 'Nyitott',
      },
    },
    {
      event_type: 'DISCOVERY_FOLLOW_UP_CREATED',
      payload: {
        followUpId: earlier.body.id,
        category: 'BUSINESS',
        dueDate: '2026-09-16',
        status: 'Nyitott',
      },
    },
  ]);
  assert.doesNotMatch(JSON.stringify(auditRows), /API team|vendor contract|approval decision/);
});

it('rejects invalid discovery follow-up input without echoing submitted values', async () => {
  const projectId = await createProject('discovery-follow-up-validation');
  const tooLongQuestion = 'Q'.repeat(10_001);
  const tooLongOwner = 'O'.repeat(256);
  const tooLongNextStep = 'N'.repeat(10_001);
  const invalidBodies: ReadonlyArray<{
    readonly body: Record<string, string>;
    readonly forbidden: readonly string[];
  }> = [
    {
      body: {
        category: 'NOT_A_CATEGORY',
        question: 'unknown-category-question-sentinel',
        owner: 'Owner',
        dueDate: '2026-09-16',
        nextStep: 'Next',
      },
      forbidden: ['NOT_A_CATEGORY', 'unknown-category-question-sentinel'],
    },
    {
      body: {
        question: 'missing-category-question-sentinel',
        owner: 'Owner',
        dueDate: '2026-09-16',
        nextStep: 'Next',
      },
      forbidden: ['missing-category-question-sentinel'],
    },
    {
      body: {
        category: 'BUSINESS',
        question: '   ',
        owner: 'Owner',
        dueDate: '2026-09-16',
        nextStep: 'blank-question-next-step-sentinel',
      },
      forbidden: ['blank-question-next-step-sentinel'],
    },
    {
      body: {
        category: 'BUSINESS',
        question: 'blank-owner-question-sentinel',
        owner: '   ',
        dueDate: '2026-09-16',
        nextStep: 'Next',
      },
      forbidden: ['blank-owner-question-sentinel'],
    },
    {
      body: {
        category: 'BUSINESS',
        question: 'blank-next-step-question-sentinel',
        owner: 'Owner',
        dueDate: '2026-09-16',
        nextStep: '   ',
      },
      forbidden: ['blank-next-step-question-sentinel'],
    },
    {
      body: {
        category: 'BUSINESS',
        question: 'missing-next-step-question-sentinel',
        owner: 'Owner',
        dueDate: '2026-09-16',
      },
      forbidden: ['missing-next-step-question-sentinel'],
    },
    {
      body: {
        category: 'BUSINESS',
        question: 'missing-due-date-question-sentinel',
        owner: 'Owner',
        nextStep: 'Next',
      },
      forbidden: ['missing-due-date-question-sentinel'],
    },
    {
      body: {
        category: 'BUSINESS',
        question: 'owner-limit-question-sentinel',
        owner: tooLongOwner,
        dueDate: '2026-09-16',
        nextStep: 'Next',
      },
      forbidden: ['owner-limit-question-sentinel', tooLongOwner],
    },
    {
      body: {
        category: 'BUSINESS',
        question: tooLongQuestion,
        owner: 'Owner',
        dueDate: '2026-09-16',
        nextStep: 'Next',
      },
      forbidden: [tooLongQuestion],
    },
    {
      body: {
        category: 'BUSINESS',
        question: 'impossible-date-question-sentinel',
        owner: 'Owner',
        dueDate: '2026-02-30',
        nextStep: 'Next',
      },
      forbidden: [
        'impossible-date-question-sentinel',
        '2026-02-30',
      ],
    },
    {
      body: {
        category: 'BUSINESS',
        question: 'next-step-limit-question-sentinel',
        owner: 'Owner',
        dueDate: '2026-09-16',
        nextStep: tooLongNextStep,
      },
      forbidden: [
        'next-step-limit-question-sentinel',
        tooLongNextStep,
      ],
    },
    {
      body: {
        category: 'BUSINESS',
        question: 'malformed-date-question-sentinel',
        owner: 'Owner',
        dueDate: 'not-a-date',
        nextStep: 'Next',
      },
      forbidden: ['malformed-date-question-sentinel', 'not-a-date'],
    },
    {
      body: {
        category: 'BUSINESS',
        question: 'unexpected-status-question-sentinel',
        owner: 'Owner',
        dueDate: '2026-09-16',
        nextStep: 'unexpected-status-next-step-sentinel',
        status: 'Folyamatban',
      },
      forbidden: [
        'unexpected-status-question-sentinel',
        'unexpected-status-next-step-sentinel',
        'Folyamatban',
      ],
    },
  ];

  for (const { body, forbidden } of invalidBodies) {
    const response = await request(app.getHttpServer())
      .post('/projects/' + projectId + '/discovery-follow-ups')
      .send(body)
      .expect(400);
    for (const value of forbidden) {
      assertNoSubmittedValues(response.body, value);
    }
  }
});

it('keeps discovery follow-ups readable while archived and permits creation after restore', async () => {
  const projectId = await createProject('discovery-follow-up-archive');
  await request(app.getHttpServer())
    .post('/projects/' + projectId + '/discovery-follow-ups')
    .send({
      category: 'OPERATIONS',
      question: 'Who owns operational handoff?',
      owner: 'Delivery lead',
      dueDate: '2026-09-18',
      nextStep: 'Assign an owner.',
    })
    .expect(201);
  await request(app.getHttpServer()).post('/projects/' + projectId + '/archive').expect(201);
  await request(app.getHttpServer())
    .get('/projects/' + projectId + '/discovery-follow-ups')
    .expect(200);
  await request(app.getHttpServer())
    .post('/projects/' + projectId + '/discovery-follow-ups')
    .send({
      category: 'OPERATIONS',
      question: 'Blocked while archived',
      owner: 'Delivery lead',
      dueDate: '2026-09-19',
      nextStep: 'Restore first.',
    })
    .expect(409);
  await request(app.getHttpServer()).post('/projects/' + projectId + '/restore').expect(201);
  await request(app.getHttpServer())
    .post('/projects/' + projectId + '/discovery-follow-ups')
    .send({
      category: 'OPERATIONS',
      question: 'Created after restore',
      owner: 'Delivery lead',
      dueDate: '2026-09-19',
      nextStep: 'Continue handoff.',
    })
    .expect(201);
});
~~~

- [ ] **Step 2: Run the API suite and observe the missing POST boundary.**

~~~
& $runtimeNode $cachedPnpm --filter @project-maker/api test
~~~

Expected result: FAIL because POST is not registered.

- [ ] **Step 3: Create a strict DTO with no status property.**

Create apps/api/src/discovery-follow-ups/dto/create-discovery-follow-up.dto.ts:

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
  type CreateDiscoveryFollowUpInput,
  type DiscoveryFollowUpCategory,
} from '@project-maker/contracts';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

export class CreateDiscoveryFollowUpDto
  implements CreateDiscoveryFollowUpInput
{
  @IsIn(discoveryFollowUpCategories)
  category!: DiscoveryFollowUpCategory;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(10_000)
  question!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(255)
  owner!: string;

  @IsString()
  @Matches(dateOnlyPattern)
  @IsISO8601({ strict: true })
  dueDate!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(10_000)
  nextStep!: string;
}
~~~

Do not add a status decorator or property. The global forbidNonWhitelisted pipe must reject an incoming status field before service code runs.

- [ ] **Step 4: Extend the service and controller with the smallest transactional create path.**

Add this controller method:

~~~ts
@Post()
create(
  @Param('projectId', new ParseUUIDPipe()) projectId: string,
  @Body() input: CreateDiscoveryFollowUpDto,
): Promise<DiscoveryFollowUp> {
  return this.discoveryFollowUpsService.create(projectId, input);
}
~~~

Add this method and helpers to DiscoveryFollowUpsService. Import randomUUID, BadRequestException, ConflictException, InternalServerErrorException, AuditEvent, generalPlaybookV1, CreateDiscoveryFollowUpInput, and EntityManager as required.

~~~ts
async create(
  projectId: string,
  input: CreateDiscoveryFollowUpInput,
): Promise<DiscoveryFollowUp> {
  return this.dataSource.transaction(async (manager) => {
    const project = await findProject(manager, projectId, true);
    rejectArchivedProject(project);
    const value = {
      category: input.category,
      question: normalizeRequiredText(input.question, 'question must not be blank.'),
      owner: normalizeRequiredText(input.owner, 'owner must not be blank.'),
      dueDate: parseDueDate(input.dueDate),
      nextStep: normalizeRequiredText(input.nextStep, 'nextStep must not be blank.'),
      status: initialDiscoveryFollowUpStatus(),
    };
    const saved = await manager.getRepository(DiscoveryFollowUpEntity).save({
      id: randomUUID(),
      projectId,
      ...value,
    });
    const followUp = toDiscoveryFollowUp(saved);
    await saveDiscoveryFollowUpAuditEvent(manager, followUp);
    return followUp;
  });
}

function normalizeRequiredText(value: string, errorMessage: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new BadRequestException(errorMessage);
  }
  return normalized;
}

function parseDueDate(value: string): string {
  const parsed = new Date(value + 'T00:00:00.000Z');
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException('dueDate must be a real calendar date.');
  }
  return value;
}

function initialDiscoveryFollowUpStatus(): string {
  const status = generalPlaybookV1.statuses.followUp[0];
  if (!status || !generalPlaybookV1.statuses.followUp.includes(status)) {
    throw new InternalServerErrorException(
      'Canonical follow-up status configuration is invalid.',
    );
  }
  return status;
}

function rejectArchivedProject(project: Project): void {
  if (project.status === 'ARCHIVED') {
    throw new ConflictException('Archived projects cannot create discovery follow-ups.');
  }
}

async function saveDiscoveryFollowUpAuditEvent(
  manager: EntityManager,
  followUp: DiscoveryFollowUp,
): Promise<void> {
  await manager.getRepository(AuditEvent).save({
    id: randomUUID(),
    projectId: followUp.projectId,
    eventType: 'DISCOVERY_FOLLOW_UP_CREATED',
    payload: {
      followUpId: followUp.id,
      category: followUp.category,
      dueDate: followUp.dueDate,
      status: followUp.status,
    },
  });
}
~~~

Ensure DiscoveryFollowUpsModule registers AuditEvent in TypeOrmModule.forFeature together with DiscoveryFollowUpEntity and Project. Do not use a transaction outside the service and do not emit unsafe content in the audit payload.

- [ ] **Step 5: Run the API tests, migration check, and typecheck.**

~~~
& $runtimeNode $cachedPnpm --filter @project-maker/api migration:show
& $runtimeNode $cachedPnpm --filter @project-maker/api test
& $runtimeNode $cachedPnpm --filter @project-maker/api typecheck
~~~

Expected result: PASS. The actual returned initial status is Nyitott; malformed and impossible dates both return sanitized 400; the archived POST returns 409; and the audit payload contains exactly the four safe keys.

- [ ] **Step 6: Review the API write boundary.**

~~~
git diff --check
git diff -- apps/api/src/discovery-follow-ups apps/api/test/projects.e2e-spec.ts
~~~

Expected result: no extra state-transition or resolution route, no separate status list, and no unsafe audit value. Do not stage or commit; stop for reviewer approval before Task 4.

### Task 4: Make discovery follow-ups a direct project-deletion blocker

**Files:**

- Modify: apps/api/src/projects/projects.service.ts
- Modify: apps/api/src/projects/projects.module.ts
- Modify: apps/api/test/projects.e2e-spec.ts

**Interfaces:**

- Consumes: DiscoveryFollowUpEntity and the existing hasPersistedProjectActivity(manager, projectId) deletion guard.
- Produces: a generic deletion 409 for a DRAFT project with a discovery_follow_ups row, even after its audit rows are removed.

- [ ] **Step 1: Add the direct-root deletion regression test.**

Add this to the existing project-deletion E2E group:

~~~ts
it('rejects deletion for a DRAFT project with a persisted discovery follow-up', async () => {
  const projectId = await createProject('delete-discovery-follow-up');
  await request(app.getHttpServer())
    .post('/projects/' + projectId + '/discovery-follow-ups')
    .send({
      category: 'SECURITY',
      question: 'Which security approval is required?',
      owner: 'Security lead',
      dueDate: '2026-09-20',
      nextStep: 'Schedule the review.',
    })
    .expect(201);

  await clearProjectAuditEvents(projectId);
  await expectProjectDeletionConflict(projectId);
});
~~~

- [ ] **Step 2: Run the API suite and prove the direct application guard is missing.**

~~~
& $runtimeNode $cachedPnpm --filter @project-maker/api test
~~~

Expected result: FAIL because clearing audit history leaves the project deletion path unaware of discovery_follow_ups.

- [ ] **Step 3: Add the entity to the retained-activity checks and module metadata.**

Import DiscoveryFollowUpEntity in apps/api/src/projects/projects.service.ts, then insert this check immediately before the existing CustomerFollowUpEntity return:

~~~ts
if (
  await manager.getRepository(DiscoveryFollowUpEntity).existsBy({ projectId })
) {
  return true;
}
~~~

Extend apps/api/src/projects/projects.module.ts so its TypeOrmModule.forFeature array includes DiscoveryFollowUpEntity beside Project and AuditEvent:

~~~ts
TypeOrmModule.forFeature([
  Project,
  AuditEvent,
  DiscoveryFollowUpEntity,
])
~~~

Do not change projectDeletionReferentialIntegrityCodes. The application check is the primary behavior; the migration’s RESTRICT foreign key and the existing 23001/23503 mapping remain the late-race safety net.

- [ ] **Step 4: Run the deletion, API, and type checks.**

~~~
& $runtimeNode $cachedPnpm --filter @project-maker/api test
& $runtimeNode $cachedPnpm --filter @project-maker/api typecheck
~~~

Expected result: PASS. Existing customer-follow-up deletion coverage still passes and the new discovery-follow-up test proves the direct root guard.

- [ ] **Step 5: Review the deletion-specific diff.**

~~~
git diff --check
git diff -- apps/api/src/projects/projects.service.ts apps/api/src/projects/projects.module.ts apps/api/test/projects.e2e-spec.ts
~~~

Expected result: one new entity import, one existsBy guard, one module registration, and one direct-root test. Do not stage or commit; stop for reviewer approval before Task 5.

### Task 5: Deliver the Cockpit form and ordered read view

**Files:**

- Modify: apps/web/src/app/projects/project-api.models.ts
- Modify: apps/web/src/app/projects/project-api.service.ts
- Modify: apps/web/src/app/projects/project-cockpit.page.ts
- Modify: apps/web/src/app/projects/project-cockpit.page.html
- Modify: apps/web/src/app/projects/project-cockpit.page.scss
- Create: apps/web/e2e/discovery-follow-ups.spec.ts

**Interfaces:**

- Consumes:

~~~ts
interface CockpitView {
  readonly project: ProjectWorkspace;
  readonly cockpit: ProjectCockpit;
  readonly followUp: CustomerFollowUpState;
  readonly discoveryFollowUps: readonly DiscoveryFollowUp[];
}

createDiscoveryFollowUp(
  projectId: string,
  input: CreateDiscoveryFollowUpInput,
): Observable<DiscoveryFollowUp>;
~~~

- Produces the owned Cockpit test IDs:

~~~text
discovery-follow-ups-card
discovery-follow-up-form
discovery-follow-up-category-select
discovery-follow-up-question-input
discovery-follow-up-owner-input
discovery-follow-up-due-date-input
discovery-follow-up-next-step-input
create-discovery-follow-up-button
discovery-follow-ups-list
discovery-follow-up-item
discovery-follow-up-status
discovery-follow-up-due-date
~~~

- Produces one local helper:

~~~ts
function toLocalDateOnly(value: Date): string;
~~~

- [ ] **Step 1: Write the failing real-browser happy-path test.**

Create apps/web/e2e/discovery-follow-ups.spec.ts:

~~~ts
import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';

const apiOrigin = 'http://127.0.0.1:3000';

interface ProjectWorkspace {
  readonly id: string;
}

async function createProject(
  request: APIRequestContext,
  name: string,
): Promise<ProjectWorkspace> {
  const response = await request.post(apiOrigin + '/projects', {
    data: {
      name,
      customerContactName: 'Discovery E2E Contact',
      customerContactEmail: 'discovery-e2e@example.test',
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as ProjectWorkspace;
}

function nativeButton(page: Page, testId: string): Locator {
  return page.getByTestId(testId).locator('button');
}

test('creates a discovery follow-up, preserves its local date after reload, and displays the canonical status', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'Discovery follow-up browser flow');
  await page.goto('/projects/' + project.id);

  await page.getByTestId('discovery-follow-up-category-select').click();
  await page.getByRole('option', { name: 'BUSINESS', exact: true }).click();
  await page.getByTestId('discovery-follow-up-question-input').fill(
    'Which approval is needed?',
  );
  await page.getByTestId('discovery-follow-up-owner-input').fill(
    'Product owner',
  );
  const dueDateInput = page
    .getByTestId('discovery-follow-up-due-date-input')
    .locator('input');
  await dueDateInput.fill('2026-09-21');
  await dueDateInput.press('Tab');
  await page.getByTestId('discovery-follow-up-next-step-input').fill(
    'Book the approval meeting.',
  );

  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes(
        '/api/projects/' + project.id + '/discovery-follow-ups',
      ),
  );
  await nativeButton(page, 'create-discovery-follow-up-button').click();
  expect((await createResponse).status()).toBe(201);

  await expect(page.getByTestId('cockpit-action-success')).toBeVisible();
  await expect(page.getByTestId('discovery-follow-up-item')).toHaveCount(1);
  await expect(page.getByTestId('discovery-follow-up-status')).toHaveText('Nyitott');
  await expect(page.getByTestId('discovery-follow-up-due-date')).toHaveText(
    '2026-09-21',
  );

  await page.reload();
  await expect(page.getByTestId('discovery-follow-up-item')).toHaveCount(1);
  await expect(page.getByTestId('discovery-follow-up-status')).toHaveText('Nyitott');
  await expect(page.getByTestId('discovery-follow-up-due-date')).toHaveText(
    '2026-09-21',
  );
});
~~~

- [ ] **Step 2: Run the focused browser test and prove the card is absent.**

~~~
& $runtimeNode $cachedPnpm --filter @project-maker/web exec playwright test e2e/discovery-follow-ups.spec.ts
~~~

Expected result: FAIL because the first owned discovery-follow-up selector is absent.

- [ ] **Step 3: Extend the Cockpit data client without changing customer email behavior.**

In project-api.models.ts, import DiscoveryFollowUp and add discoveryFollowUps to CockpitView. In project-api.service.ts, extend loadCockpit:

~~~ts
return forkJoin({
  cockpit: this.http.get<ProjectCockpit>(
    '/api/projects/' + encodedProjectId + '/cockpit',
  ),
  projects: this.http.get<readonly ProjectWorkspace[]>('/api/projects'),
  followUp: this.http
    .get<CustomerFollowUpState>(
      '/api/projects/' + encodedProjectId + '/follow-up',
    )
    .pipe(
      catchError((error: unknown) =>
        this.fail(error, 'load project follow-up settings'),
      ),
    ),
  discoveryFollowUps: this.http
    .get<readonly DiscoveryFollowUp[]>(
      '/api/projects/' + encodedProjectId + '/discovery-follow-ups',
    )
    .pipe(
      catchError((error: unknown) =>
        this.fail(error, 'load discovery follow-ups'),
      ),
    ),
}).pipe(
  map(({ cockpit, projects, followUp, discoveryFollowUps }) => {
    const project = projects.find((candidate) => candidate.id === projectId);
    if (!project) {
      throw new Error(
        'The cockpit loaded, but its project is missing from the project list. Refresh the page; if the problem continues, check the API data.',
      );
    }
    return { cockpit, project, followUp, discoveryFollowUps };
  }),
  catchError((error: unknown) => this.fail(error, 'load the project cockpit')),
);
~~~

Add the client method:

~~~ts
createDiscoveryFollowUp(
  projectId: string,
  input: CreateDiscoveryFollowUpInput,
): Observable<DiscoveryFollowUp> {
  return this.http
    .post<DiscoveryFollowUp>(
      '/api/projects/' +
        encodeURIComponent(projectId) +
        '/discovery-follow-ups',
      input,
    )
    .pipe(
      catchError((error: unknown) =>
        this.fail(error, 'create a discovery follow-up'),
      ),
    );
}
~~~

In followUpErrorNextStep, add a branch for action === 'create a discovery follow-up': return a generic archived-or-changed-project guidance for 409 and generic category/required-text/due-date guidance for 400. Do not pass raw HTTP response details through the client error surface.

- [ ] **Step 4: Add the reactive form, local-date serializer, view update, and mutation guards.**

Import DiscoveryFollowUp, DiscoveryFollowUpCategory, CreateDiscoveryFollowUpInput, and discoveryFollowUpCategories into project-cockpit.page.ts. Add these state and form members:

~~~ts
readonly discoveryFollowUpSaving = signal(false);
readonly discoveryFollowUpCategoryOptions = discoveryFollowUpCategories.map(
  (value) => ({ label: value, value }),
);
readonly discoveryFollowUpForm = new FormGroup({
  category: new FormControl<DiscoveryFollowUpCategory | null>(null, {
    validators: [Validators.required],
  }),
  question: new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.pattern(/\S/),
      Validators.maxLength(10_000),
    ],
  }),
  owner: new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.pattern(/\S/),
      Validators.maxLength(255),
    ],
  }),
  dueDate: new FormControl<Date | null>(null, {
    validators: [Validators.required],
  }),
  nextStep: new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.pattern(/\S/),
      Validators.maxLength(10_000),
    ],
  }),
});
~~~

Add the submit method and helpers:

~~~ts
createDiscoveryFollowUp(): void {
  this.discoveryFollowUpForm.markAllAsTouched();
  const current = this.view();
  const value = this.discoveryFollowUpForm.getRawValue();
  if (
    !current ||
    this.discoveryFollowUpControlsDisabled() ||
    !value.category ||
    !value.dueDate ||
    this.discoveryFollowUpForm.invalid
  ) {
    return;
  }

  const input: CreateDiscoveryFollowUpInput = {
    category: value.category,
    question: value.question.trim(),
    owner: value.owner.trim(),
    dueDate: toLocalDateOnly(value.dueDate),
    nextStep: value.nextStep.trim(),
  };
  this.discoveryFollowUpSaving.set(true);
  this.actionError.set(null);
  this.feedback.set(null);
  this.api.createDiscoveryFollowUp(this.projectId, input).subscribe({
    next: (created) => {
      this.view.update((existing) =>
        existing
          ? {
              ...existing,
              discoveryFollowUps: sortDiscoveryFollowUps([
                ...existing.discoveryFollowUps,
                created,
              ]),
            }
          : existing,
      );
      this.resetDiscoveryFollowUpForm();
      this.feedback.set('Discovery follow-up created.');
      this.discoveryFollowUpSaving.set(false);
      this.refreshAuditEvents();
    },
    error: (error: Error) => {
      this.actionError.set(error.message);
      this.discoveryFollowUpSaving.set(false);
    },
  });
}

discoveryFollowUpControlsDisabled(): boolean {
  return (
    this.discoveryFollowUpSaving() ||
    this.saving() ||
    this.followUpSaving() ||
    this.pinging() ||
    this.reviewSending() ||
    this.transitioning() ||
    this.deleting() ||
    this.isArchived()
  );
}

private resetDiscoveryFollowUpForm(): void {
  this.discoveryFollowUpForm.reset({
    category: null,
    question: '',
    owner: '',
    dueDate: null,
    nextStep: '',
  });
}

function toLocalDateOnly(value: Date): string {
  const year = String(value.getFullYear()).padStart(4, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function sortDiscoveryFollowUps(
  values: readonly DiscoveryFollowUp[],
): readonly DiscoveryFollowUp[] {
  return [...values].sort(
    (left, right) =>
      left.dueDate.localeCompare(right.dueDate) ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  );
}
~~~

In the error callback, use error: (error: Error) and set this.actionError from error.message, matching every existing Cockpit mutation. In setView, call resetDiscoveryFollowUpForm after the existing form resets. In applyWorkspaceResponse, preserve the list explicitly because the current code reconstructs CockpitView:

~~~ts
this.view.set({
  project,
  cockpit: {
    projectId: project.id,
    status: project.status,
    ballOwner: project.ballOwner,
    nextAction: project.nextAction,
    dueAt: project.dueAt,
  },
  followUp: current.followUp,
  discoveryFollowUps: current.discoveryFollowUps,
});
~~~

Add discoveryFollowUpSaving() explicitly to the existing workspace, customer-follow-up, lifecycle, and delete mutation guards so the Cockpit cannot issue competing requests. Do not introduce a generic multi-mode flag or change the customer-email actions.

- [ ] **Step 5: Add the separate full-width card and focused styles.**

Add the following card immediately after the closing cockpit-grid div and before the confirmation dialog. It deliberately stays outside the narrow right sidebar.

~~~html
<p-card data-testid="discovery-follow-ups-card">
  <ng-template #title>Discovery follow-ups</ng-template>
  <ng-template #subtitle>
    Record one accountable unresolved discovery item. Archived projects remain readable.
  </ng-template>

  <form
    class="discovery-follow-up-form"
    [formGroup]="discoveryFollowUpForm"
    (ngSubmit)="createDiscoveryFollowUp()"
    data-testid="discovery-follow-up-form"
  >
    <fieldset
      class="discovery-follow-up-fields"
      [disabled]="discoveryFollowUpControlsDisabled()"
    >
      <legend class="sr-only">Create discovery follow-up</legend>
      <div class="field">
        <label for="discovery-follow-up-category">Category</label>
        <p-select
          inputId="discovery-follow-up-category"
          styleClass="full-width"
          formControlName="category"
          [options]="discoveryFollowUpCategoryOptions"
          optionLabel="label"
          optionValue="value"
          [disabled]="discoveryFollowUpControlsDisabled()"
          data-testid="discovery-follow-up-category-select"
        />
        @if (
          discoveryFollowUpForm.controls.category.invalid &&
          discoveryFollowUpForm.controls.category.touched
        ) {
          <small class="field-error">Choose a category.</small>
        }
      </div>
      <div class="field">
        <label for="discovery-follow-up-question">Question</label>
        <textarea
          pTextarea
          id="discovery-follow-up-question"
          class="full-width"
          rows="3"
          formControlName="question"
          data-testid="discovery-follow-up-question-input"
        ></textarea>
        @if (
          discoveryFollowUpForm.controls.question.hasError('maxlength') &&
          discoveryFollowUpForm.controls.question.touched
        ) {
          <small class="field-error">Question must be 10,000 characters or fewer.</small>
        } @else if (
          discoveryFollowUpForm.controls.question.invalid &&
          discoveryFollowUpForm.controls.question.touched
        ) {
          <small class="field-error">Question is required.</small>
        }
      </div>
      <div class="field">
        <label for="discovery-follow-up-owner">Owner</label>
        <input
          pInputText
          id="discovery-follow-up-owner"
          class="full-width"
          formControlName="owner"
          data-testid="discovery-follow-up-owner-input"
        />
        @if (
          discoveryFollowUpForm.controls.owner.hasError('maxlength') &&
          discoveryFollowUpForm.controls.owner.touched
        ) {
          <small class="field-error">Owner must be 255 characters or fewer.</small>
        } @else if (
          discoveryFollowUpForm.controls.owner.invalid &&
          discoveryFollowUpForm.controls.owner.touched
        ) {
          <small class="field-error">Owner is required.</small>
        }
      </div>
      <div class="field">
        <label for="discovery-follow-up-due-date">Due date</label>
        <p-datepicker
          inputId="discovery-follow-up-due-date"
          styleClass="full-width"
          formControlName="dueDate"
          [dateFormat]="'yy-mm-dd'"
          [showIcon]="true"
          [appendTo]="'body'"
          [disabled]="discoveryFollowUpControlsDisabled()"
          data-testid="discovery-follow-up-due-date-input"
        />
        @if (
          discoveryFollowUpForm.controls.dueDate.invalid &&
          discoveryFollowUpForm.controls.dueDate.touched
        ) {
          <small class="field-error">Enter a due date as YYYY-MM-DD.</small>
        }
      </div>
      <div class="field">
        <label for="discovery-follow-up-next-step">Next step</label>
        <textarea
          pTextarea
          id="discovery-follow-up-next-step"
          class="full-width"
          rows="3"
          formControlName="nextStep"
          data-testid="discovery-follow-up-next-step-input"
        ></textarea>
        @if (
          discoveryFollowUpForm.controls.nextStep.hasError('maxlength') &&
          discoveryFollowUpForm.controls.nextStep.touched
        ) {
          <small class="field-error">Next step must be 10,000 characters or fewer.</small>
        } @else if (
          discoveryFollowUpForm.controls.nextStep.invalid &&
          discoveryFollowUpForm.controls.nextStep.touched
        ) {
          <small class="field-error">Next step is required.</small>
        }
      </div>
    </fieldset>
    <p-button
      type="submit"
      label="Create discovery follow-up"
      [loading]="discoveryFollowUpSaving()"
      [disabled]="discoveryFollowUpControlsDisabled()"
      data-testid="create-discovery-follow-up-button"
    />
  </form>

  @if (current.discoveryFollowUps.length === 0) {
    <p class="discovery-follow-up-empty">No discovery follow-ups recorded.</p>
  } @else {
    <ol class="discovery-follow-up-list" data-testid="discovery-follow-ups-list">
      @for (followUp of current.discoveryFollowUps; track followUp.id) {
        <li class="discovery-follow-up-item" data-testid="discovery-follow-up-item">
          <div class="discovery-follow-up-meta">
            <strong>{{ followUp.category }}</strong>
            <p-tag [value]="followUp.status" data-testid="discovery-follow-up-status" />
            <time [attr.datetime]="followUp.dueDate" data-testid="discovery-follow-up-due-date">
              {{ followUp.dueDate }}
            </time>
          </div>
          <p>{{ followUp.question }}</p>
          <p><strong>Owner:</strong> {{ followUp.owner }}</p>
          <p><strong>Next step:</strong> {{ followUp.nextStep }}</p>
        </li>
      }
    </ol>
  }
</p-card>
~~~

In project-cockpit.page.scss, add only component-local rules for .discovery-follow-up-form, .discovery-follow-up-fields, .discovery-follow-up-list, .discovery-follow-up-item, and .discovery-follow-up-meta. Use the existing .field, full-width, list, and responsive-grid conventions; do not rework the cockpit grid or sidebar.

- [ ] **Step 6: Run type checks and the focused browser happy path.**

~~~
& $runtimeNode $cachedPnpm --filter @project-maker/web typecheck
& $runtimeNode $cachedPnpm --filter @project-maker/web exec playwright test e2e/discovery-follow-ups.spec.ts
~~~

Expected result: PASS. The test fills the owned ISO date input, POST returns 201, Nyitott and 2026-09-21 appear, and reload preserves the record.

- [ ] **Step 7: Review the web slice.**

~~~
git diff --check
git diff -- apps/web/src/app/projects/project-api.models.ts apps/web/src/app/projects/project-api.service.ts apps/web/src/app/projects/project-cockpit.page.ts apps/web/src/app/projects/project-cockpit.page.html apps/web/src/app/projects/project-cockpit.page.scss apps/web/e2e/discovery-follow-ups.spec.ts
~~~

Expected result: customer follow-up controls and email endpoints are untouched; the new form is a separate card with its own state and test IDs. Do not stage or commit; stop for reviewer approval before Task 6.

### Task 6: Prove archive/restore behavior, synchronize documentation, and run final gates

**Files:**

- Modify: apps/web/e2e/discovery-follow-ups.spec.ts
- Modify: docs/roadmap.md
- Modify: .planning/STATE.md
- Modify: docs/product-domain.md
- Modify: docs/operations-handoff.md
- Modify: docs/README.md only if a distinct completed-delivery link is required

**Interfaces:**

- Consumes: the live API endpoints, the Cockpit test IDs from Task 5, migration 0006, and the verified acceptance criteria.
- Produces: browser proof that archive is read-only and restore re-enables creation; current-state documentation that distinguishes delivered INTAKE-04.1 from the still-partial parent requirement.

- [ ] **Step 1: Add the failing browser archive/restore test.**

Append this test to apps/web/e2e/discovery-follow-ups.spec.ts:

~~~ts
test('keeps the discovery list visible while archived and re-enables creation after restore', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'Discovery follow-up archive flow');
  const creation = await request.post(
    apiOrigin + '/projects/' + project.id + '/discovery-follow-ups',
    {
      data: {
        category: 'OPERATIONS',
        question: 'Who owns handoff?',
        owner: 'Delivery lead',
        dueDate: '2026-09-22',
        nextStep: 'Confirm the owner.',
      },
    },
  );
  expect(creation.status()).toBe(201);
  expect(
    (
      await request.post(apiOrigin + '/projects/' + project.id + '/archive')
    ).status(),
  ).toBe(201);

  await page.goto('/projects/' + project.id);
  await expect(page.getByTestId('discovery-follow-up-item')).toHaveCount(1);
  await expect(nativeButton(page, 'create-discovery-follow-up-button')).toBeDisabled();

  expect(
    (
      await request.post(apiOrigin + '/projects/' + project.id + '/restore')
    ).status(),
  ).toBe(201);
  await page.reload();
  await expect(nativeButton(page, 'create-discovery-follow-up-button')).toBeEnabled();
});
~~~

- [ ] **Step 2: Run the focused browser specification.**

~~~
& $runtimeNode $cachedPnpm --filter @project-maker/web exec playwright test e2e/discovery-follow-ups.spec.ts
~~~

Expected result: FAIL if archived fieldsets/buttons remain enabled or the list disappears; PASS after the Task 5 archived guard is confirmed or corrected.

- [ ] **Step 3: Update current-state documentation only after the code and focused tests pass.**

Make these factual documentation edits:

1. In docs/roadmap.md, add INTAKE-04.1 as DELIVERED with the route, persisted fields, canonical Nyitott initial status, archive read-only behavior, audit event, and deletion-retention protection. Keep the broader INTAKE-04 parent listed as partial/planned with edit, resolve, source linkage, answer/decision, and scoring work still outstanding.
2. In .planning/STATE.md, record that INTAKE-04.1 is a delivered first vertical slice only after all verification gates pass. Do not change the broader requirement checkbox in .planning/REQUIREMENTS.md.
3. In docs/product-domain.md, define discovery follow-up as a project-owned unresolved work item and clarify that customer follow-up remains an email cadence/schedule.
4. In docs/operations-handoff.md, add migration 0006, list/create route semantics, the archive/restore behavior, safe audit payload, and the fact that migration down drops discovery-follow-up data.
5. Keep docs/README.md as a concise index: retain the design and implementation-plan links already present. Do not turn it into a duplicate feature guide.

- [ ] **Step 4: Create a disposable, isolated PostgreSQL verification database.**

Run this from the repository root. It refuses to reuse an existing container or occupied port, generates an ephemeral password without printing it, and exposes only loopback.

~~~powershell
$verifyContainer = 'project-maker-intake04-e2e'
$verifyDatabase = 'project_maker_intake04_e2e'
$verifyUser = 'project_maker'
$verifyPassword = [guid]::NewGuid().ToString('N')
$verifyPort = 55432
$existingContainer = docker ps -a --filter "name=^/$verifyContainer$" --format '{{.Names}}'
if ($existingContainer) {
  throw "Container $verifyContainer already exists; inspect it before continuing."
}
$listeningPort = Get-NetTCPConnection -LocalPort $verifyPort -State Listen -ErrorAction SilentlyContinue
if ($listeningPort) {
  throw "Port $verifyPort is already listening; choose an unused local port."
}
$dockerArgs = @(
  'run',
  '--detach',
  '--rm',
  '--name',
  $verifyContainer,
  '--publish',
  ('127.0.0.1:' + $verifyPort + ':5432'),
  '--env',
  ('POSTGRES_DB=' + $verifyDatabase),
  '--env',
  ('POSTGRES_USER=' + $verifyUser),
  '--env',
  ('POSTGRES_PASSWORD=' + $verifyPassword),
  'postgres:18.4-alpine3.24'
)
docker @dockerArgs
for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
  docker exec $verifyContainer pg_isready -U $verifyUser -d $verifyDatabase
  if ($LASTEXITCODE -eq 0) {
    break
  }
  Start-Sleep -Seconds 1
}
if ($LASTEXITCODE -ne 0) {
  throw 'Isolated PostgreSQL did not become ready.'
}
$env:DATABASE_URL = 'postgresql://' + $verifyUser + ':' + $verifyPassword + '@127.0.0.1:' + $verifyPort + '/' + $verifyDatabase
~~~

Expected result: a new loopback-only PostgreSQL container is healthy. Do not echo DATABASE_URL or the generated password.

- [ ] **Step 5: Run the complete verification matrix against the disposable database.**

~~~
& $runtimeNode $cachedPnpm --filter @project-maker/contracts test
& $runtimeNode $cachedPnpm --filter @project-maker/api migration:run
& $runtimeNode $cachedPnpm --filter @project-maker/api test
& $runtimeNode $cachedPnpm --filter @project-maker/api typecheck
& $runtimeNode $cachedPnpm --filter @project-maker/web typecheck
& $runtimeNode $cachedPnpm --filter @project-maker/web exec playwright test e2e/discovery-follow-ups.spec.ts
& $runtimeNode $cachedPnpm verify
& $runtimeNode $cachedPnpm test:e2e
~~~

Expected result: all commands pass. Playwright starts the real API, resets only the disposable local e2e database, runs all migrations including 0006, and exercises the actual browser flow. If any check fails, preserve the failure output, stop, and use systematic debugging before changing code.

- [ ] **Step 6: Stop only the container created in Step 4 and clear the in-process secret.**

~~~
docker stop $verifyContainer
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Remove-Variable verifyPassword
~~~

Expected result: the temporary container is removed by its own --rm policy. Do not stop any other Docker container.

- [ ] **Step 7: Perform final scope and secrecy review.**

~~~
git diff --check
git status --short
git diff --name-only
git diff --check -- . ':!pnpm-lock.yaml'
$untrackedPaths = @(git ls-files --others --exclude-standard)
foreach ($untrackedPath in $untrackedPaths) {
  git diff --no-index --check -- NUL $untrackedPath
  if ($LASTEXITCODE -gt 1) {
    throw "Whitespace validation failed for $untrackedPath."
  }
}
rg -n --hidden --glob '!node_modules/**' --glob '!dist/**' --glob '!dist-test/**' '(postgresql://[^[:space:]]+:[^[:space:]]+@|POSTGRES_PASSWORD=|BEGIN [A-Za-z0-9_-]{20,})' .
& C:\Users\littl\.agents\tools\work-state-preflight.ps1 -RepositoryPath (Get-Location).Path -OutputFormat Markdown
~~~

Expected result: no whitespace errors, no generated artifacts, no credentials, no unintended legacy/stack/config changes, and a fresh WORK_STATE record. Review every changed path against this plan before requesting separate stage/commit approval.

## Acceptance-Criteria Traceability

| Acceptance criterion | Verification task |
| --- | --- |
| Create from Cockpit, success, and refresh persistence | Tasks 3 and 5 browser happy path |
| Exact canonical Nyitott without a second vocabulary | Task 1 contract test and Task 3 API/browser assertions |
| Closed categories, text bounds, missing data, malformed/impossible dates | Task 3 DTO, service date round-trip, and negative API test |
| Local date round-trips as unchanged YYYY-MM-DD | Task 5 local formatter and browser typed ISO-date assertion |
| Empty GET does not write; list order deterministic | Tasks 2 and 3 API tests |
| Archive read-only, GET readable, restore creates again | Task 3 API test and Task 6 browser test |
| One safe audit event only | Task 3 direct database assertion |
| Persisted row blocks bare DRAFT deletion | Task 4 direct-root test after audit deletion |
| Customer email scheduling remains separate | Tasks 2, 5, and complete API/browser regressions |
| No resolution/linking/scoring/auth delivered | Global constraints and final scope review |

## Plan Self-Review

**Spec coverage:** All ten accepted criteria map to an implementation and a verification step above. The migration, canonical status derivation, runtime validation, lifecycle lock, audit minimization, deletion guard, Cockpit card, date-only serialization, real PostgreSQL tests, real browser tests, documentation state, and retained non-goals are all covered.

**Placeholder scan:** This plan contains no deferred implementation markers. Every code-bearing task names the files, exported or consumed interface, test behavior, expected failure, implementation shape, and passing command.

**Type consistency:** The same names flow through every layer: DiscoveryFollowUpCategory, CreateDiscoveryFollowUpInput, DiscoveryFollowUp, DiscoveryFollowUpEntity, DiscoveryFollowUpsService, createDiscoveryFollowUp, discoveryFollowUps, toLocalDateOnly, and sortDiscoveryFollowUps. The API writes status but the request type, DTO, and browser form omit it.

## Execution Handoff

Plan complete. Implement task-by-task with a fresh review gate after each task and no Git publication action unless separately approved.

1. **Subagent-Driven (recommended):** use superpowers:subagent-driven-development, one fresh worker per task, with review between tasks.
2. **Inline Execution:** use superpowers:executing-plans in this task, executing the tasks in small batches with review checkpoints.
