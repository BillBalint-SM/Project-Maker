# INTAKE-04.2 Discovery Follow-up Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Cockpit user resolve an existing discovery follow-up with a canonical final status and a persisted answer or rationale.

**Architecture:** Extend the shared follow-up response with nullable resolution content and export the resolved-status policy as a value derived from `generalPlaybookV1`. Add one nullable PostgreSQL column and one explicit, transactional resolve command. The Cockpit uses that command through an inline reactive form that updates only the returned row; it does not become a general follow-up editor.

**Tech Stack:** Angular 22.1 reactive forms, PrimeNG 22.0.0, NestJS 11.1, TypeORM 1.1, PostgreSQL, node:test + Supertest, Playwright 1.62, pnpm 11.20.0, Node 26.

## Global Constraints

- Execute only from `dev-intake-04-follow-up-resolution` after a fresh `WORK_STATE` preflight. Do not reuse a merged development branch.
- Scope is only `INTAKE-04.2`: resolve an existing discovery follow-up. Exclude general edit, delete, cancel, reopen, source linkage, scoring, notifications, email, auth, roles, collaboration, dependency changes, and legacy desktop work.
- Keep customer email scheduling at `/projects/:projectId/follow-up` unchanged. The new command is exactly `POST /projects/:projectId/discovery-follow-ups/:followUpId/resolve`.
- Derive allowed target statuses only from `generalPlaybookV1.scoring.readiness.resolvedFollowUpStatuses`. Do not create a local status enum, literal array, or policy copy.
- The two-field request is `{ status, decisionOrAnswer }`. The answer/rationale is trimmed, nonblank, and at most 10,000 characters. Do not place it in audit payloads or sanitized error responses.
- Use `@HttpCode(HttpStatus.OK)` so the state transition returns `200 OK` rather than NestJS's default `201` for a `POST` handler.
- Migration `0007` adds only nullable `decision_or_answer text`. Its `down` drops that column and its answer data; do not add a database rule that duplicates the versioned playbook policy.
- Resolve in one transaction: lock project, reject archive, lock the project-owned row, reject already resolved state, validate policy, save the row, save exactly one safe audit event.
- The resolution audit event is `DISCOVERY_FOLLOW_UP_RESOLVED` with exactly `{ followUpId, status }`. It excludes answer/rationale, question, owner, due date, and next step.
- Archive remains readable; resolution returns `409` while archived; restore re-enables resolution of unresolved items.
- Follow current raw-SQL migration, `ParseUUIDPipe`, strict `ValidationPipe`, real PostgreSQL E2E, Angular signal/reactive-form, and stable `data-testid` conventions.
- Use a fresh loopback PostgreSQL database whose name includes `e2e` or `test`. Never run migration or browser tests against shared/production data.
- Use the compatible local runtime variables below. Do not change global Node, pnpm, PrimeNG, Angular, or package configuration.
- Existing approved design/index files are expected to be dirty. Before code edits, any changed path outside those files and this plan is a stop-and-inspect condition.
- Do not stage, commit, push, create a PR, or merge within this plan. Publication requires separate explicit approval after the final diff review.
- Delivery documentation changes occur only after all tests pass. The parent `INTAKE-04` requirement stays unchecked because edit and source-linkage work remain separate.

---

## File Map

| File | Change | Responsibility |
| --- | --- | --- |
| `packages/contracts/src/discovery-follow-ups.ts` | Modify | Add resolve input and nullable answer response field. |
| `packages/contracts/src/index.ts` | Modify | Export the resolved-status value derived after `generalPlaybookV1` is built. |
| `packages/contracts/test/discovery-follow-ups.test.mjs` | Modify | Prove the derived policy and status-vocabulary membership. |
| `apps/api/src/migrations/0007-discovery-follow-up-resolution.ts` | Create | Add/drop the nullable answer column. |
| `apps/api/src/database/migration-data-source.ts` | Modify | Register migration 0007 after migration 0006. |
| `apps/api/src/discovery-follow-ups/discovery-follow-up.entity.ts` | Modify | Map `decision_or_answer`. |
| `apps/api/src/discovery-follow-ups/dto/resolve-discovery-follow-up.dto.ts` | Create | Validate the two HTTP body fields. |
| `apps/api/src/discovery-follow-ups/discovery-follow-ups.controller.ts` | Modify | Add UUID-guarded, explicit-200 resolve command. |
| `apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts` | Modify | Lock, validate, persist, map, and audit resolution. |
| `apps/api/test/projects.e2e-spec.ts` | Modify | Real API coverage for success, persistence, redaction, lifecycle, and conflict. |
| `apps/web/src/app/projects/project-api.service.ts` | Modify | Add typed resolve client method. |
| `apps/web/src/app/projects/project-cockpit.page.ts` | Modify | Add reactive state, guards, and row replacement. |
| `apps/web/src/app/projects/project-cockpit.page.html` | Modify | Add inline resolve form, answer display, and test IDs. |
| `apps/web/src/app/projects/project-cockpit.page.scss` | Modify | Add focused inline form layout. |
| `apps/web/e2e/discovery-follow-ups.spec.ts` | Modify | Live browser resolve/reload/archive proof. |
| `docs/README.md` | Modify now | Index this plan. |
| `docs/roadmap.md`, `.planning/STATE.md`, `docs/product-domain.md`, `docs/operations-handoff.md` | Modify after verification | Record only delivered facts and retained scope. |

## Execution Bootstrap

Run this before Task 1.

~~~powershell
& C:\Users\littl\.agents\tools\work-state-preflight.ps1 -RepositoryPath (Get-Location).Path -OutputFormat Markdown
git status --short
git branch --show-current
git rev-parse HEAD
git worktree list --porcelain
git remote -v

$runtimeNode = 'C:\Program Files\nodejs\node.exe'
$cachedPnpm = 'C:\Users\littl\AppData\Local\npm-cache\_npx\90ee57dca4845993\node_modules\pnpm\bin\pnpm.cjs'
$cachedPnpmBin = 'C:\Users\littl\AppData\Local\npm-cache\_npx\90ee57dca4845993\node_modules\.bin'
$env:Path = "C:\Program Files\nodejs;$cachedPnpmBin;$env:Path"
& $runtimeNode --version
& $runtimeNode $cachedPnpm --version

function Start-IsolatedProjectMakerPostgres {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Container,
    [Parameter(Mandatory = $true)]
    [string]$Database,
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  $user = 'project_maker'
  $password = [guid]::NewGuid().ToString('N')
  $containerStarted = $false

  try {
    $existingContainer = docker ps -a --filter ('name=^/' + $Container + '$') --format '{{.Names}}'
    if ($existingContainer) {
      throw "Container $Container already exists; inspect it before continuing."
    }

    $listeningPort = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($listeningPort) {
      throw "Port $Port is already listening; choose an unused local port."
    }

    docker run --detach --rm --name $Container --publish ('127.0.0.1:' + $Port + ':5432') --env ('POSTGRES_DB=' + $Database) --env ('POSTGRES_USER=' + $user) --env ('POSTGRES_PASSWORD=' + $password) postgres:18.4-alpine3.24 | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw 'Failed to start the isolated PostgreSQL container.'
    }
    $containerStarted = $true

    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
      docker exec $Container pg_isready -U $user -d $Database | Out-Null
      if ($LASTEXITCODE -eq 0) {
        $ready = $true
        break
      }
      Start-Sleep -Seconds 1
    }
    if (-not $ready) {
      throw 'Isolated PostgreSQL did not become ready.'
    }

    return [pscustomobject]@{
      Container = $Container
      DatabaseUrl = 'postgresql://' + $user + ':' + $password + '@127.0.0.1:' + $Port + '/' + $Database
    }
  } catch {
    if ($containerStarted) {
      docker stop $Container | Out-Null
    }
    throw
  }
}

function Stop-IsolatedProjectMakerPostgres {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Container
  )

  docker stop $Container | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to stop isolated PostgreSQL container $Container."
  }
}
~~~

Expected result: branch `dev-intake-04-follow-up-resolution`, known approved
documentation paths only, Node in the repository engine range, and pnpm
`11.20.0`. Stop before editing if identity, branch, head, worktree, upstream,
or changed paths differ. Keep this bootstrap and every task-level database
block in the same PowerShell session. Do not write or print the returned
`DatabaseUrl` object or its temporary password.

### Task 1: Establish contract and nullable persistence representation

**Files:**

- Modify: `packages/contracts/src/discovery-follow-ups.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/test/discovery-follow-ups.test.mjs`
- Create: `apps/api/src/migrations/0007-discovery-follow-up-resolution.ts`
- Modify: `apps/api/src/database/migration-data-source.ts`
- Modify: `apps/api/src/discovery-follow-ups/discovery-follow-up.entity.ts`
- Modify: `apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts`

**Interfaces:**

- Consumes: `generalPlaybookV1`, the existing `DiscoveryFollowUp` interface,
  migration 0006, and the existing entity.
- Produces:

~~~ts
export const resolvedDiscoveryFollowUpStatuses: readonly string[];

export interface ResolveDiscoveryFollowUpInput {
  readonly status: string;
  readonly decisionOrAnswer: string;
}

export interface DiscoveryFollowUp {
  readonly id: string;
  readonly projectId: string;
  readonly category: DiscoveryFollowUpCategory;
  readonly question: string;
  readonly owner: string;
  readonly dueDate: string;
  readonly status: string;
  readonly decisionOrAnswer: string | null;
  readonly nextStep: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
~~~

- Produces migration class
  `DiscoveryFollowUpResolution0007DiscoveryFollowUpResolution1786435200000`.
- Does not alter the general v1 JSON, customer email data, or deletion guard.

- [ ] **Step 1: Add the failing contract export test.**

Append this exact test to `packages/contracts/test/discovery-follow-ups.test.mjs`:

~~~js
test('discovery follow-ups expose the canonical resolved status policy', async () => {
  const {
    generalPlaybookV1,
    resolvedDiscoveryFollowUpStatuses,
  } = await import('../dist/index.js');

  assert.deepEqual(
    resolvedDiscoveryFollowUpStatuses,
    generalPlaybookV1.scoring.readiness.resolvedFollowUpStatuses,
  );
  assert.deepEqual(resolvedDiscoveryFollowUpStatuses, [
    'Megválaszolva',
    'Nem releváns',
  ]);
  for (const status of resolvedDiscoveryFollowUpStatuses) {
    assert.ok(generalPlaybookV1.statuses.followUp.includes(status));
  }
});
~~~

- [ ] **Step 2: Run it before implementation.**

~~~powershell
& $runtimeNode $cachedPnpm --filter @project-maker/contracts test
~~~

Expected: FAIL because `resolvedDiscoveryFollowUpStatuses` is absent. Preserve
the failure output. Do not solve it with a copied local status list.

- [ ] **Step 3: Add the shared contract fields and derived export.**

Add this interface after `CreateDiscoveryFollowUpInput` in
`packages/contracts/src/discovery-follow-ups.ts`:

~~~ts
export interface ResolveDiscoveryFollowUpInput {
  readonly status: string;
  readonly decisionOrAnswer: string;
}
~~~

Add this one property after `status` in the existing `DiscoveryFollowUp`
interface:

~~~ts
readonly decisionOrAnswer: string | null;
~~~

Add this after the `generalPlaybookV1` declaration in
`packages/contracts/src/index.ts`. It must not be declared in the
domain-module file, which would create an index/module import cycle.

~~~ts
export const resolvedDiscoveryFollowUpStatuses =
  generalPlaybookV1.scoring.readiness.resolvedFollowUpStatuses;
~~~

- [ ] **Step 4: Add migration 0007 and entity mapping.**

Create `apps/api/src/migrations/0007-discovery-follow-up-resolution.ts`:

~~~ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DiscoveryFollowUpResolution0007DiscoveryFollowUpResolution1786435200000
  implements MigrationInterface
{
  name = 'DiscoveryFollowUpResolution0007DiscoveryFollowUpResolution1786435200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "discovery_follow_ups" ADD COLUMN "decision_or_answer" text',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "discovery_follow_ups" DROP COLUMN "decision_or_answer"',
    );
  }
}
~~~

Import that class after migration 0006 and append it after migration 0006 in
the `migrations` array of `apps/api/src/database/migration-data-source.ts`.

Add this mapping directly after `status` in
`apps/api/src/discovery-follow-ups/discovery-follow-up.entity.ts`:

~~~ts
@Column({ name: 'decision_or_answer', type: 'text', nullable: true })
decisionOrAnswer!: string | null;
~~~

Update the existing `toDiscoveryFollowUp` mapper in
`apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts` at the
same time, placing this property between `status` and `nextStep`:

~~~ts
decisionOrAnswer: value.decisionOrAnswer,
~~~

- [ ] **Step 5: Re-run focused type and contract checks.**

~~~powershell
& $runtimeNode $cachedPnpm --filter @project-maker/contracts test
& $runtimeNode $cachedPnpm --filter @project-maker/api typecheck
~~~

Expected: PASS. The policy is derived, the new input compiles, and unresolved
records can represent a null answer.

- [ ] **Step 6: Prove the migration up/down/up cycle on an isolated database.**

~~~powershell
$verifyContainer = 'project-maker-intake04-resolution-contract-e2e'
$verifyDatabase = 'project_maker_intake04_resolution_contract_e2e'
$verifyUser = 'project_maker'
$verifyPassword = [guid]::NewGuid().ToString('N')
$verifyPort = 55433
$priorDatabaseUrl = $env:DATABASE_URL
$containerStarted = $false

try {
  $existingContainer = docker ps -a --filter "name=^/$verifyContainer$" --format '{{.Names}}'
  if ($existingContainer) { throw "Container $verifyContainer already exists; inspect it before continuing." }
  $listeningPort = Get-NetTCPConnection -LocalPort $verifyPort -State Listen -ErrorAction SilentlyContinue
  if ($listeningPort) { throw "Port $verifyPort is already listening; choose an unused local port." }

  docker run --detach --rm --name $verifyContainer --publish ('127.0.0.1:' + $verifyPort + ':5432') --env ('POSTGRES_DB=' + $verifyDatabase) --env ('POSTGRES_USER=' + $verifyUser) --env ('POSTGRES_PASSWORD=' + $verifyPassword) postgres:18.4-alpine3.24
  if ($LASTEXITCODE -ne 0) { throw 'Failed to start the isolated PostgreSQL container.' }
  $containerStarted = $true

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
    docker exec $verifyContainer pg_isready -U $verifyUser -d $verifyDatabase | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw 'Isolated PostgreSQL did not become ready.' }

  $env:DATABASE_URL = 'postgresql://' + $verifyUser + ':' + $verifyPassword + '@127.0.0.1:' + $verifyPort + '/' + $verifyDatabase
  & $runtimeNode $cachedPnpm --filter @project-maker/api migration:run
  & $runtimeNode $cachedPnpm --filter @project-maker/api migration:revert
  & $runtimeNode $cachedPnpm --filter @project-maker/api migration:run
} finally {
  if ($containerStarted) { docker stop $verifyContainer | Out-Null }
  if ($null -eq $priorDatabaseUrl) { Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue } else { $env:DATABASE_URL = $priorDatabaseUrl }
  Remove-Variable verifyPassword -ErrorAction SilentlyContinue
}
~~~

Expected: migrations 0001–0007 apply, only migration 0007 reverses on the
disposable database, and it reapplies. Do not print the temporary password or
database URL.

- [ ] **Step 7: Review Task 1.**

~~~powershell
git diff --check
git diff -- packages/contracts/src/discovery-follow-ups.ts packages/contracts/src/index.ts packages/contracts/test/discovery-follow-ups.test.mjs apps/api/src/migrations/0007-discovery-follow-up-resolution.ts apps/api/src/database/migration-data-source.ts apps/api/src/discovery-follow-ups/discovery-follow-up.entity.ts apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts
~~~

Expected: exactly one nullable column/property, one derived policy export, and
no copied status vocabulary. Do not stage or commit.

### Task 2: Implement the transactional resolve API and its real PostgreSQL proof

**Files:**

- Create: `apps/api/src/discovery-follow-ups/dto/resolve-discovery-follow-up.dto.ts`
- Modify: `apps/api/src/discovery-follow-ups/discovery-follow-ups.controller.ts`
- Modify: `apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts`
- Modify: `apps/api/test/projects.e2e-spec.ts`

**Interfaces:**

- Consumes: `ResolveDiscoveryFollowUpInput`, migration/entity changes,
  `loadGeneralPlaybookV1`, and global strict DTO validation.
- Produces:

~~~ts
async resolve(
  projectId: string,
  followUpId: string,
  input: ResolveDiscoveryFollowUpInput,
): Promise<DiscoveryFollowUp>;
~~~

- Produces `200 OK` and one `DISCOVERY_FOLLOW_UP_RESOLVED` event.
- Does not add an item `PATCH` endpoint.

- [ ] **Step 0: Start Task 2's dedicated API database.**

In the PowerShell session created by Execution Bootstrap, run:

~~~powershell
$task2PriorDatabaseUrl = $env:DATABASE_URL
$task2Postgres = Start-IsolatedProjectMakerPostgres -Container 'project-maker-intake04-resolution-api-e2e' -Database 'project_maker_intake04_resolution_api_e2e' -Port 55434
$env:DATABASE_URL = $task2Postgres.DatabaseUrl
& $runtimeNode $cachedPnpm --filter @project-maker/api migration:run
~~~

Expected: a fresh loopback-only PostgreSQL database has migrations 0001–0007
applied before the API proof runs. If this block fails after the container
starts, run Task 2 Step 8 immediately, then diagnose the preserved failure.

- [ ] **Step 1: Add a failing API success-and-audit test.**

Add an API E2E test after the existing discovery create/list test. Create one
follow-up, then issue the resolution command using concatenated route parts:

~~~ts
const resolutionResponse = await request(app.getHttpServer())
  .post(
    '/projects/' +
      projectId +
      '/discovery-follow-ups/' +
      created.body.id +
      '/resolve',
  )
  .send({
    status: 'Megválaszolva',
    decisionOrAnswer: '  Sponsor approval is recorded in CAB-42.  ',
  })
  .expect(200);

assert.equal(resolutionResponse.body.status, 'Megválaszolva');
assert.equal(
  resolutionResponse.body.decisionOrAnswer,
  'Sponsor approval is recorded in CAB-42.',
);
~~~

Reload through `GET /discovery-follow-ups` and assert the same status/answer.
Query `audit_events` by event type and assert exactly:

~~~ts
{
  event_type: 'DISCOVERY_FOLLOW_UP_RESOLVED',
  payload: {
    followUpId: created.body.id,
    status: 'Megválaszolva',
  },
}
~~~

Assert the serialized audit result does not contain
`Sponsor approval`, `CAB-42`, question, owner, or next-step fixture text.
Create a second follow-up and resolve it as `Nem releváns` with a nonblank
rationale to exercise both current policy values.

- [ ] **Step 2: Run the API test before the command exists.**

~~~powershell
& $runtimeNode $cachedPnpm --filter @project-maker/api test
~~~

Expected: FAIL because the route, method, or nullable response field does not
exist. Preserve the result.

- [ ] **Step 3: Add failing negative and lifecycle coverage.**

Add an invalid-body table in `projects.e2e-spec.ts`. Each row posts to a real
created follow-up, expects `400`, and calls the existing
`assertNoSubmittedValues` helper for every sentinel.

| Request body | Sentinels that must not appear |
| --- | --- |
| `{ status: 'Folyamatban', decisionOrAnswer: 'invalid-status-sentinel' }` | `Folyamatban`, `invalid-status-sentinel` |
| `{ status: 'Megválaszolva', decisionOrAnswer: '   ' }` | `Megválaszolva` |
| `{ status: 'Megválaszolva', decisionOrAnswer: 'A'.repeat(10001) }` | the long value |
| `{ decisionOrAnswer: 'missing-status-sentinel' }` | `missing-status-sentinel` |
| `{ status: 'Megválaszolva' }` | `Megválaszolva` |
| `{ status: 'Megválaszolva', decisionOrAnswer: 'unexpected-answer-sentinel', ignored: 'unexpected-field-sentinel' }` | both sentinels |

Add separate requests with an invalid follow-up UUID (`400`), a valid but
absent follow-up UUID (`404`), and absent project UUID (`404`).

Add one archive/restore test: create unresolved item, archive project, expect
`409` on resolve, restore, resolve successfully, then query one resolution
audit event. Add one duplicate test: resolve once, resolve again, expect
`409`, and assert the event count remains one.

- [ ] **Step 4: Add the DTO and controller handler.**

Create `apps/api/src/discovery-follow-ups/dto/resolve-discovery-follow-up.dto.ts`:

~~~ts
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import type { ResolveDiscoveryFollowUpInput } from '@project-maker/contracts';

const nonBlankPattern = /\S/;

export class ResolveDiscoveryFollowUpDto
  implements ResolveDiscoveryFollowUpInput
{
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  status!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(nonBlankPattern)
  @MaxLength(10_000)
  decisionOrAnswer!: string;
}
~~~

Extend the controller imports with `HttpCode` and `HttpStatus`. Import the DTO
and add this handler after `create`:

~~~ts
@Post(':followUpId/resolve')
@HttpCode(HttpStatus.OK)
resolve(
  @Param('projectId', new ParseUUIDPipe()) projectId: string,
  @Param('followUpId', new ParseUUIDPipe()) followUpId: string,
  @Body() input: ResolveDiscoveryFollowUpDto,
): Promise<DiscoveryFollowUp> {
  return this.discoveryFollowUpsService.resolve(projectId, followUpId, input);
}
~~~

- [ ] **Step 5: Implement service transaction, policy validation, and audit.**

Import `ResolveDiscoveryFollowUpInput`. Add this public method:

~~~ts
async resolve(
  projectId: string,
  followUpId: string,
  input: ResolveDiscoveryFollowUpInput,
): Promise<DiscoveryFollowUp> {
  return this.dataSource.transaction(async (manager) => {
    const project = await findLockedProject(manager, projectId);
    rejectArchivedProjectForResolution(project);

    const entity = await findLockedDiscoveryFollowUp(manager, projectId, followUpId);
    const resolvedStatuses = await loadResolvedDiscoveryFollowUpStatuses();
    if (resolvedStatuses.includes(entity.status)) {
      throw new ConflictException('Discovery follow-up is already resolved.');
    }

    entity.status = requireResolvedDiscoveryFollowUpStatus(input.status, resolvedStatuses);
    entity.decisionOrAnswer = normalizeRequiredText(
      input.decisionOrAnswer,
      'decisionOrAnswer must not be blank.',
    );

    const saved = await manager.getRepository(DiscoveryFollowUpEntity).save(entity);
    const followUp = toDiscoveryFollowUp(saved);
    await saveDiscoveryFollowUpResolutionAuditEvent(manager, followUp);
    return followUp;
  });
}
~~~

Add these helpers next to existing project/audit helpers:

~~~ts
async function findLockedDiscoveryFollowUp(
  manager: EntityManager,
  projectId: string,
  followUpId: string,
): Promise<DiscoveryFollowUpEntity> {
  const followUp = await manager.getRepository(DiscoveryFollowUpEntity).findOne({
    where: { id: followUpId, projectId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!followUp) {
    throw new NotFoundException('Discovery follow-up not found.');
  }
  return followUp;
}

function rejectArchivedProjectForResolution(project: Project): void {
  if (project.status === 'ARCHIVED') {
    throw new ConflictException('Archived projects cannot resolve discovery follow-ups.');
  }
}

async function loadResolvedDiscoveryFollowUpStatuses(): Promise<readonly string[]> {
  const generalPlaybookV1 = await loadGeneralPlaybookV1();
  const statuses = generalPlaybookV1.scoring.readiness.resolvedFollowUpStatuses;
  if (
    statuses.length === 0 ||
    statuses.some((status) => !generalPlaybookV1.statuses.followUp.includes(status))
  ) {
    throw new InternalServerErrorException(
      'Canonical resolved follow-up status configuration is invalid.',
    );
  }
  return statuses;
}

function requireResolvedDiscoveryFollowUpStatus(
  value: string,
  allowedStatuses: readonly string[],
): string {
  if (!allowedStatuses.includes(value)) {
    throw new BadRequestException(
      'status must be a canonical resolved follow-up status.',
    );
  }
  return value;
}

async function saveDiscoveryFollowUpResolutionAuditEvent(
  manager: EntityManager,
  followUp: DiscoveryFollowUp,
): Promise<void> {
  const payload: AuditPayload = {
    followUpId: followUp.id,
    status: followUp.status,
  };
  await manager.getRepository(AuditEvent).save({
    id: randomUUID(),
    projectId: followUp.projectId,
    eventType: 'DISCOVERY_FOLLOW_UP_RESOLVED',
    payload,
  });
}
~~~

Keep the creation-specific archive message/function separate. The Task 1
mapper change already exposes a nullable answer for both existing and
newly-resolved rows.

- [ ] **Step 6: Verify API behavior against the Task 2 database.**

Keep Task 2's dedicated database assigned to the current PowerShell session.
Run:

~~~powershell
& $runtimeNode $cachedPnpm --filter @project-maker/contracts test
& $runtimeNode $cachedPnpm --filter @project-maker/api migration:run
& $runtimeNode $cachedPnpm --filter @project-maker/api test
& $runtimeNode $cachedPnpm --filter @project-maker/api typecheck
~~~

Expected: PASS. The real suite proves both final states, persisted normalized
answer, redaction, `400/404/409` behavior, archive/restore, one audit record,
and all existing API regression cases.

- [ ] **Step 7: Review Task 2.**

~~~powershell
git diff --check
git diff -- apps/api/src/discovery-follow-ups/discovery-follow-ups.controller.ts apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts apps/api/src/discovery-follow-ups/dto/resolve-discovery-follow-up.dto.ts apps/api/test/projects.e2e-spec.ts
~~~

Expected: one command route, one DTO, one lock order, and one safe audit event.
No generic update endpoint. Do not stage or commit.

- [ ] **Step 8: Clean up the Task 2 database.**

After Step 7, or immediately after any Task 2 failure, run:

~~~powershell
Stop-IsolatedProjectMakerPostgres -Container $task2Postgres.Container
if ($null -eq $task2PriorDatabaseUrl) {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
} else {
  $env:DATABASE_URL = $task2PriorDatabaseUrl
}
Remove-Variable task2Postgres, task2PriorDatabaseUrl -ErrorAction SilentlyContinue
~~~

Expected: only the named disposable container is stopped and the prior process
environment is restored exactly.

### Task 3: Add Cockpit interaction and real-browser evidence

**Files:**

- Modify: `apps/web/src/app/projects/project-api.service.ts`
- Modify: `apps/web/src/app/projects/project-cockpit.page.ts`
- Modify: `apps/web/src/app/projects/project-cockpit.page.html`
- Modify: `apps/web/src/app/projects/project-cockpit.page.scss`
- Modify: `apps/web/e2e/discovery-follow-ups.spec.ts`

**Interfaces:**

- Consumes: `ResolveDiscoveryFollowUpInput`, `DiscoveryFollowUp`,
  `resolvedDiscoveryFollowUpStatuses`, and the API command.
- Produces:

~~~ts
resolveDiscoveryFollowUp(
  projectId: string,
  followUpId: string,
  input: ResolveDiscoveryFollowUpInput,
): Observable<DiscoveryFollowUp>;
~~~

- Produces one open inline form and a per-item saving ID.
- Does not add editor, source selector, reopen action, or client-owned status list.

- [ ] **Step 0: Start Task 3's dedicated web-E2E database.**

In the same PowerShell session, run:

~~~powershell
$task3PriorDatabaseUrl = $env:DATABASE_URL
$task3Postgres = Start-IsolatedProjectMakerPostgres -Container 'project-maker-intake04-resolution-web-e2e' -Database 'project_maker_intake04_resolution_web_e2e' -Port 55436
$env:DATABASE_URL = $task3Postgres.DatabaseUrl
& $runtimeNode $cachedPnpm --filter @project-maker/api migration:run
~~~

Expected: a fresh, loopback-only database whose name satisfies the web E2E
local-database guard. The Playwright API server resets this disposable schema
and runs migrations again; that is intentional.

- [ ] **Step 1: Add a failing live browser happy path.**

Add a request helper to `apps/web/e2e/discovery-follow-ups.spec.ts` that posts
a standard valid discovery follow-up and returns its `id`. Then add this test
flow:

1. Create project and follow-up with the API request fixture.
2. Open the Cockpit and click
   `resolve-discovery-follow-up-button` through `nativeButton`.
3. Click the input inside
   `discovery-follow-up-resolution-status-select`, press `ArrowDown` then
   `Enter` to select the first contract-derived option without a text-fallback
   locator.
4. Fill `discovery-follow-up-decision-or-answer-input` with
   `The sponsor approved the scope.`.
5. Wait for the real `POST` URL ending in `/resolve` and assert `200` after
   clicking `save-discovery-follow-up-resolution-button`.
6. Assert success surface, status `Megválaszolva`,
   `discovery-follow-up-decision-or-answer` content, and zero remaining
   resolve buttons; reload and assert the same status/answer.

- [ ] **Step 2: Run the focused browser spec before client implementation.**

~~~powershell
& $runtimeNode $cachedPnpm --filter @project-maker/web exec playwright test e2e/discovery-follow-ups.spec.ts
~~~

Expected: FAIL because the stable resolve controls and client command are
absent. Do not mock the API.

- [ ] **Step 3: Add typed API client method.**

Extend the contracts import in `project-api.service.ts` and add this method
after `createDiscoveryFollowUp`:

~~~ts
resolveDiscoveryFollowUp(
  projectId: string,
  followUpId: string,
  input: ResolveDiscoveryFollowUpInput,
): Observable<DiscoveryFollowUp> {
  return this.http
    .post<DiscoveryFollowUp>(
      '/api/projects/' +
        encodeURIComponent(projectId) +
        '/discovery-follow-ups/' +
        encodeURIComponent(followUpId) +
        '/resolve',
      input,
    )
    .pipe(
      catchError((error: unknown) =>
        this.fail(error, 'resolve a discovery follow-up'),
      ),
    );
}
~~~

- [ ] **Step 4: Add isolated reactive form state and resolution handler.**

In `project-cockpit.page.ts` import
`ResolveDiscoveryFollowUpInput` and `resolvedDiscoveryFollowUpStatuses`. Add
these declarations next to existing discovery state:

~~~ts
readonly openedDiscoveryFollowUpResolutionId = signal<string | null>(null);
readonly savingDiscoveryFollowUpResolutionId = signal<string | null>(null);
readonly resolvedDiscoveryFollowUpStatusOptions =
  resolvedDiscoveryFollowUpStatuses.map((value) => ({ label: value, value }));

readonly discoveryFollowUpResolutionForm = new FormGroup({
  status: new FormControl<string | null>(null, {
    validators: [Validators.required],
  }),
  decisionOrAnswer: new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.pattern(/\S/),
      Validators.maxLength(10_000),
    ],
  }),
});
~~~

Add handlers with these exact responsibilities:

| Method | Required behavior |
| --- | --- |
| `openDiscoveryFollowUpResolution(followUpId: string)` | Finds project-owned row, rejects resolved/archived/concurrent cases, clears action errors, opens one form, resets its values. |
| `cancelDiscoveryFollowUpResolution()` | Does nothing during a save; otherwise closes and resets only the inline form. |
| `resolveDiscoveryFollowUp(followUpId: string)` | Marks form touched; checks row/status/form/guard; sends trimmed `ResolveDiscoveryFollowUpInput`; replaces only returned row; resets on success; preserves draft on error; refreshes audit. |
| `isDiscoveryFollowUpResolved(followUp: DiscoveryFollowUp)` | Checks `resolvedDiscoveryFollowUpStatuses.includes(followUp.status)`. |
| `isDiscoveryFollowUpResolutionOpen(followUpId: string)` | Compares the open ID. |
| `isDiscoveryFollowUpResolutionSaving(followUpId: string)` | Compares the saving ID. |
| `discoveryFollowUpMutationInProgress()` | Returns creation saving or non-null resolution saving ID. |
| `discoveryFollowUpResolutionControlsDisabled()` | Returns mutation, workspace, customer follow-up, email, lifecycle, deletion, or archive blocking state. |
| `resetDiscoveryFollowUpResolutionForm()` | Resets `status` to null and `decisionOrAnswer` to empty string. |

Replace cross-action checks of `discoveryFollowUpSaving()` with
`discoveryFollowUpMutationInProgress()` in workspace save, customer follow-up
controls, archive, restore, deletion request/execution, and discovery creation
guards. Keep `discoveryFollowUpSaving` only for creation. In `setView`, clear
the open ID and reset the resolution form so a reload or project lifecycle
change cannot retain stale state.

- [ ] **Step 5: Render only the approved inline controls.**

Within each `discovery-follow-up-item` in the Cockpit template:

- render `discovery-follow-up-decision-or-answer` only when
  `followUp.decisionOrAnswer` exists;
- render `resolve-discovery-follow-up-button` only when the follow-up is not
  resolved; keep it visible but disabled when the project is archived;
- when the row is open, render a reactive form with
  `discovery-follow-up-resolution-status-select`,
  `discovery-follow-up-decision-or-answer-input`,
  `save-discovery-follow-up-resolution-button`, and
  `cancel-discovery-follow-up-resolution-button`;
- bind the PrimeNG select options to
  `resolvedDiscoveryFollowUpStatusOptions`, set `optionLabel` and
  `optionValue`, and bind the button/form disabled states to the single
  resolution guard;
- render required and maximum-length errors from the reactive controls.

Add only these local styles:

~~~scss
.discovery-follow-up-resolution-form {
  border-top: 1px solid var(--p-content-border-color);
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1rem;
}

.discovery-follow-up-resolution-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}
~~~

Do not change the Cockpit grid, customer-email card, or discovery creation form.

- [ ] **Step 6: Add archive/restore browser coverage.**

Add a second browser test:

1. Create project and unresolved follow-up through real API fixture.
2. Archive project through the API fixture, navigate to Cockpit, assert the
   row remains and `resolve-discovery-follow-up-button` is disabled.
3. Restore through API fixture, reload, and assert the same button is enabled.
4. Do not resolve a terminal row in this test; the first browser test owns
   terminal rendering and reload proof.

- [ ] **Step 7: Run focused web checks.**

~~~powershell
& $runtimeNode $cachedPnpm --filter @project-maker/web typecheck
& $runtimeNode $cachedPnpm --filter @project-maker/web exec playwright test e2e/discovery-follow-ups.spec.ts
~~~

Expected: PASS with no mocked HTTP, stable test IDs, explicit `200` response
evidence, persistence after reload, and archive/restore behavior.

- [ ] **Step 8: Review Task 3.**

~~~powershell
git diff --check
git diff -- apps/web/src/app/projects/project-api.service.ts apps/web/src/app/projects/project-cockpit.page.ts apps/web/src/app/projects/project-cockpit.page.html apps/web/src/app/projects/project-cockpit.page.scss apps/web/e2e/discovery-follow-ups.spec.ts
~~~

Expected: status options remain contract-derived; only resolution UI is added;
customer-email behavior is untouched. Do not stage or commit.

- [ ] **Step 9: Clean up the Task 3 database.**

After Step 8, or immediately after any Task 3 failure, run:

~~~powershell
Stop-IsolatedProjectMakerPostgres -Container $task3Postgres.Container
if ($null -eq $task3PriorDatabaseUrl) {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
} else {
  $env:DATABASE_URL = $task3PriorDatabaseUrl
}
Remove-Variable task3Postgres, task3PriorDatabaseUrl -ErrorAction SilentlyContinue
~~~

Expected: the real web API process has exited with Playwright and only the
named disposable container is stopped.

### Task 4: Synchronize delivery documentation and run full verification

**Files:**

- Modify now: `docs/README.md`
- Modify after evidence: `docs/roadmap.md`
- Modify after evidence: `.planning/STATE.md`
- Modify after evidence: `docs/product-domain.md`
- Modify after evidence: `docs/operations-handoff.md`

**Interfaces:**

- Consumes: verified migration, API, and browser results.
- Produces: indexed planning evidence and factual delivery-state documents.
- Does not check `INTAKE-04` complete in `.planning/REQUIREMENTS.md`.

- [ ] **Step 1: Index the plan.**

Add immediately after the resolution design link in `docs/README.md`:

~~~markdown
- [Discovery follow-up resolution implementation plan](superpowers/plans/2026-08-08-intake-04-follow-up-resolution.md)
~~~

- [ ] **Step 2: Run narrow checks before delivery-state edits.**

Start Task 4's final disposable database in the same PowerShell session:

~~~powershell
$task4PriorDatabaseUrl = $env:DATABASE_URL
$task4Postgres = Start-IsolatedProjectMakerPostgres -Container 'project-maker-intake04-resolution-final-e2e' -Database 'project_maker_intake04_resolution_final_e2e' -Port 55435
$env:DATABASE_URL = $task4Postgres.DatabaseUrl
~~~

Once ready, run:

~~~powershell
& $runtimeNode $cachedPnpm --filter @project-maker/contracts test
& $runtimeNode $cachedPnpm --filter @project-maker/api migration:run
& $runtimeNode $cachedPnpm --filter @project-maker/api test
& $runtimeNode $cachedPnpm --filter @project-maker/api typecheck
& $runtimeNode $cachedPnpm --filter @project-maker/web typecheck
& $runtimeNode $cachedPnpm --filter @project-maker/web exec playwright test e2e/discovery-follow-ups.spec.ts
~~~

Expected: PASS. If a check fails, preserve output, stop only this named
container with Task 4 Step 5, restore the environment variable, and use
systematic debugging before source or current-state documentation changes.

- [ ] **Step 3: Update only verified delivery facts.**

1. In `docs/roadmap.md`, add a `DELIVERED` `INTAKE-04.2` entry describing the
   command route, canonical terminal statuses, required persisted answer,
   archive block, safe audit event, and API/browser evidence. Revise parent
   `INTAKE-04` to state creation and resolution are delivered while general
   edit and source linkage remain planned.
2. In `.planning/STATE.md`, record delivered resolution behavior and retain
   edit, source linkage, scoring/readiness integration, and later work as
   incomplete.
3. In `docs/product-domain.md`, distinguish delivered creation/review/
   resolution from future source linkage and editing, while preserving the
   separation from customer email schedules.
4. In `docs/operations-handoff.md`, add migration `0007`, resolve route,
   `200` behavior, archive/restore semantics, two-key audit payload, and the
   fact that migration down drops answer/rationale content.
5. Keep `docs/README.md` an index; do not claim `DOC-01` delivery.

- [ ] **Step 4: Run repository-wide verification.**

Keep the fresh final database assigned to the current session and run:

~~~powershell
& $runtimeNode $cachedPnpm verify
& $runtimeNode $cachedPnpm test:e2e
~~~

Expected: PASS. `verify` covers workspace typechecks, tests, and builds.
`test:e2e` uses the real browser stack and isolated database.

- [ ] **Step 5: Stop only the named final container and restore environment state.**

~~~powershell
Stop-IsolatedProjectMakerPostgres -Container $task4Postgres.Container
if ($null -eq $task4PriorDatabaseUrl) {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
} else {
  $env:DATABASE_URL = $task4PriorDatabaseUrl
}
Remove-Variable task4Postgres, task4PriorDatabaseUrl -ErrorAction SilentlyContinue
~~~

Expected: only the named `--rm` container is removed, and the caller's prior
environment value is restored.

- [ ] **Step 6: Complete scope and secrecy review.**

~~~powershell
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

Expected: no whitespace errors, generated artifacts, credentials, dependency
noise, legacy-desktop changes, or scope outside the file map. Review every
changed path against the approved design before asking for separate Git
publication approval.

## Acceptance-Criteria Traceability

| Criterion | Implementation and proof |
| --- | --- |
| Resolve as both canonical final states and persist after reload | Task 2 API tests; Task 3 browser flow |
| No second resolution vocabulary | Task 1 derived-export test; Task 2 runtime policy check; Task 3 contract select |
| Bounded, nonblank, redacted answer | Task 2 DTO/service/negative/audit tests; Task 3 form validation |
| Archive read-only and restore re-enables unresolved resolution | Task 2 lifecycle test; Task 3 browser test |
| Duplicate resolution gives one audit event | Task 2 row lock/conflict/count test |
| Existing behavior stays intact | Task 2 API regressions; Task 3 focused browser suite; Task 4 full gates |
| No edit, reopen, source link, or scoring | Global constraints, Task 3 control inventory, Task 4 scope review |

## Plan Self-Review

**Spec coverage:** Tasks cover the approved `200` command, nullable data,
canonical policy, lock order, archive block, duplicate conflict, safe audit,
Cockpit UI, reload behavior, browser proof, documentation, and full gates.

**Placeholder scan:** Every code-bearing task identifies files, exact
interfaces, test data or test case, expected failure, implementation shape,
passing command, and review boundary.

**Type consistency:** `ResolveDiscoveryFollowUpInput`,
`resolvedDiscoveryFollowUpStatuses`, `decisionOrAnswer`,
`resolveDiscoveryFollowUp`, `DISCOVERY_FOLLOW_UP_RESOLVED`, and
`DiscoveryFollowUpResolution0007DiscoveryFollowUpResolution1786435200000` use
the same names across contract, API, web, test, migration, and documentation.

**Git boundary:** The repository working standard requires separate user
approval for staging, committing, push, PR creation, and merge. This plan
intentionally ends each task at a review gate.

## Execution Handoff

Plan complete. Choose one execution approach:

1. **Subagent-Driven (recommended)** — dispatch a fresh worker per task and review between tasks.
2. **Inline Execution** — use `superpowers:executing-plans` in this task and execute the four tasks in small, verified batches.
