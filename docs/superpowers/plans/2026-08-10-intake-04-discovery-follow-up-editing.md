# INTAKE-04.3a Discovery Follow-up Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an employee edit the five working fields of one open discovery
follow-up with a version-checked, redacted, auditable `PATCH` workflow that
cannot silently overwrite another edit or a resolution.

**Architecture:** Add a persisted positive `version` to the existing
Discovery-follow-up representation, then require it as `expectedVersion` on a
narrow API update route. The existing transactional project-then-follow-up row
lock serializes the version check, normalized diff, entity save, and audit
write. The Discovery deep module owns the inline edit form and preserves a
conflicting draft while the Cockpit shell continues only to provide lifecycle
state and refresh audit history after a committed change.

**Tech Stack:** Angular 22.1 standalone signals and reactive forms, PrimeNG
22, RxJS 7.8, NestJS 11.1, TypeORM 1.1, PostgreSQL 18, Playwright 1.62,
TypeScript 6, Node 26.7, and pnpm 11.20.

## Global Constraints

- Implement only the approved [editing design](../specs/2026-08-10-intake-04-discovery-follow-up-editing-design.md).
- Start implementation from fresh, clean `main` and create the short-lived
  `dev-discovery-follow-up-editing` branch. The currently approved planning
  documents must first be committed to `main` through a separately approved
  documentation-only change; never discard them to obtain a clean tree.
- Keep the Cockpit route thin. All edit API calls, forms, draft/conflict state,
  markup, SCSS, stable selectors, loading, feedback, and retry behaviour stay
  inside `apps/web/src/app/projects/discovery-follow-ups/`.
- Do not change Customer email follow-up behaviour, project lifecycle,
  readiness/scoring, source linkage, deletion retention, the general v1
  playbook, global styles, dependencies, Angular/PrimeNG versions, or
  `pnpm-lock.yaml`.
- Only the canonical initial follow-up status is editable. The server derives
  it through `initialDiscoveryFollowUpStatus()`; the browser must not add a
  copied local status list or literal.
- The complete edit input is exactly `category`, `question`, `owner`,
  `dueDate`, `nextStep`, and `expectedVersion`. `status`,
  `decisionOrAnswer`, `projectId`, source linkage, timestamps, and a version
  value from the client are rejected.
- Use `@VersionColumn` plus migration `0008`; compare `expectedVersion` inside
  the existing locked transaction. Do not use `updatedAt`, last-write-wins,
  ETags, polling, a generic collaboration layer, or an additional table.
- An equivalent normalized request returns the existing row without save,
  version increment, or `DISCOVERY_FOLLOW_UP_UPDATED` audit event.
- Every real edit writes one audit payload with exactly `followUpId` and
  comma-separated changed field names in this fixed order: `category`,
  `question`, `owner`, `dueDate`, `nextStep`. Never write field values,
  answers, versions, or user data into this payload or an error response.
- One inline Edit or Resolve form may be open at a time. A `409` preserves the
  typed edit draft and reloads the real list; only explicit Reload or Cancel
  changes that draft. An archive lifecycle change clears the edit form, like
  the existing resolution form.
- Use stable `data-testid` selectors and real API/database/browser flows; do
  not mock HTTP responses or fall back to visible-text clicks.
- Context7 evidence: Angular `HttpClient.patch<T>` returns a typed observable;
  the existing Nest global `ValidationPipe` applies DTO decorators and rejects
  unknown fields; the installed TypeORM `@VersionColumn` increments on entity
  save. Validate these facts against the repository versions during execution.
- Run every migration and browser test only against a disposable loopback
  PostgreSQL database whose name contains `e2e` or `test`; never print its
  password or connection URL.
- Do not stage, commit, push, open a PR, or merge without separate user
  approval after the final diff and verification evidence are available.

---

## File Map

| File | Change | Responsibility |
| --- | --- | --- |
| `packages/contracts/src/discovery-follow-ups.ts` | Modify | Versioned edit input and complete follow-up response type. |
| `apps/api/src/migrations/0008-discovery-follow-up-edit-version.ts` | Create | Positive persisted version and reversible constraint/column migration. |
| `apps/api/src/database/migration-data-source.ts` | Modify | Registers migration `0008` after `0007`. |
| `apps/api/src/discovery-follow-ups/discovery-follow-up.entity.ts` | Modify | Maps the TypeORM version column. |
| `apps/api/src/discovery-follow-ups/dto/update-discovery-follow-up.dto.ts` | Create | DTO validation for the exact update request. |
| `apps/api/src/discovery-follow-ups/discovery-follow-ups.controller.ts` | Modify | UUID-guarded `PATCH` returning `200`. |
| `apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts` | Modify | Locked edit rule, normalized diff, no-op path, version conflict, and safe audit. |
| `apps/api/test/projects.e2e-spec.ts` | Modify | Real PostgreSQL migration, version, API, audit, lifecycle, and race proof. |
| `apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts` | Modify | Typed update adapter and structured HTTP conflict information. |
| `apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts` | Modify | Local edit form, baseline, conflict draft, actions, and returned-row replacement. |
| `apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html` | Modify | Inline Edit form, exclusive controls, conflict/reload UI, and test IDs. |
| `apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.scss` | Modify | Edit-form/action styles local to the deep module. |
| `apps/web/e2e/discovery-follow-ups.spec.ts` | Modify | Real-browser edit persistence, exclusivity, conflict preservation, and archive flow. |
| `docs/roadmap.md` | Modify after verification | Record `.3a` as delivered while retaining parent/source-link scope. |
| `docs/product-domain.md` | Modify after verification | Describe delivered editing versus remaining source linkage. |
| `docs/user-guide.md` | Modify after verification | Teach daily edit, conflict, archive, and terminal-state workflows. |
| `docs/operations-handoff.md` | Modify after verification | Document migration `0008`, route, version, and audit operational facts. |
| `.planning/STATE.md` | Modify after verification | Synchronize verified delivery state without checking parent `INTAKE-04` complete. |

## Produced Interfaces

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
  readonly version: number;
}
```

```ts
@Patch(':followUpId')
@HttpCode(HttpStatus.OK)
update(
  @Param('projectId', new ParseUUIDPipe()) projectId: string,
  @Param('followUpId', new ParseUUIDPipe()) followUpId: string,
  @Body() input: UpdateDiscoveryFollowUpDto,
): Promise<DiscoveryFollowUp>
```

```ts
update(
  projectId: string,
  followUpId: string,
  input: UpdateDiscoveryFollowUpInput,
): Observable<DiscoveryFollowUp>
```

## Execution Bootstrap

Run this once, after the approved documentation has a clean `main` baseline
and before any implementation edit. It verifies repository identity and gives
every task a compatible Node/pnpm runtime plus safe disposable-database helpers.

```powershell
& C:\Users\littl\.agents\tools\work-state-preflight.ps1 -RepositoryPath (Get-Location).Path -OutputFormat Markdown
git status --short
git branch --show-current
git rev-parse HEAD
git worktree list --porcelain
git remote -v

$runtimeNode = 'C:\Program Files\nodejs\node.exe'
$cachedPnpm = 'C:\Users\littl\AppData\Local\npm-cache\_npx\90ee57dca4845993\node_modules\pnpm\bin\pnpm.cjs'
$cachedPnpmBin = 'C:\Users\littl\AppData\Local\npm-cache\_npx\90ee57dca4845993\node_modules\.bin'
if (-not (Test-Path -LiteralPath $runtimeNode -PathType Leaf)) {
  throw "Compatible Node executable is missing: $runtimeNode"
}
if (-not (Test-Path -LiteralPath $cachedPnpm -PathType Leaf)) {
  throw "Compatible pnpm entrypoint is missing: $cachedPnpm"
}
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
  $password = [Guid]::NewGuid().ToString('N')
  $started = $false
  try {
    $existing = docker ps -a --filter ('name=^/' + $Container + '$') --format '{{.Names}}'
    if ($existing) { throw "Container $Container already exists; inspect it first." }
    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
      throw "Port $Port is already listening; choose an unused port."
    }
    docker run --detach --rm --name $Container --publish ('127.0.0.1:' + $Port + ':5432') --env ('POSTGRES_DB=' + $Database) --env ('POSTGRES_USER=' + $user) --env ('POSTGRES_PASSWORD=' + $password) postgres:18.4-alpine3.24 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Failed to start the isolated PostgreSQL container.' }
    $started = $true
    for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
      docker exec $Container pg_isready -U $user -d $Database | Out-Null
      if ($LASTEXITCODE -eq 0) {
        return [pscustomobject]@{
          Container = $Container
          DatabaseUrl = 'postgresql://' + $user + ':' + $password + '@127.0.0.1:' + $Port + '/' + $Database
        }
      }
      Start-Sleep -Seconds 1
    }
    throw 'Isolated PostgreSQL did not become ready.'
  } catch {
    if ($started) { docker stop $Container | Out-Null }
    throw
  }
}

function Stop-IsolatedProjectMakerPostgres {
  param([Parameter(Mandatory = $true)][string]$Container)
  docker stop $Container | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to stop isolated container $Container." }
}
```

Expected: `main` is clean, no implementation branch/PR is open, Node reports
`v26.7.0` or a compatible later 26.x version, pnpm reports `11.20.0`, and no
database has been started yet. Only then create the branch:

```powershell
git switch -c dev-discovery-follow-up-editing
```

Do not continue if preflight identifies a different branch, HEAD, worktree,
upstream, or unexpected changed path. Do not print an object containing the
temporary database URL/password.

### Task 1: Add the versioned persistence and public representation

**Files:**

- Modify: `packages/contracts/src/discovery-follow-ups.ts`
- Create: `apps/api/src/migrations/0008-discovery-follow-up-edit-version.ts`
- Modify: `apps/api/src/database/migration-data-source.ts`
- Modify: `apps/api/src/discovery-follow-ups/discovery-follow-up.entity.ts`
- Modify: `apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts`
- Modify: `apps/api/test/projects.e2e-spec.ts`

**Interfaces:**

- Consumes: current `DiscoveryFollowUp`, migrations `0006`/`0007`, and the
  entity-to-contract mapper.
- Produces: positive `version` on every returned follow-up and
  `UpdateDiscoveryFollowUpInput` for the next task.
- Preserves: all existing create/list/resolve data and their response fields.

- [ ] **Step 0: Start a dedicated contract/migration database.**

```powershell
$task1PriorDatabaseUrl = $env:DATABASE_URL
$task1Postgres = Start-IsolatedProjectMakerPostgres -Container 'project-maker-intake04-edit-contract-e2e' -Database 'project_maker_intake04_edit_contract_e2e' -Port 55450
$env:DATABASE_URL = $task1Postgres.DatabaseUrl
& $runtimeNode $cachedPnpm --filter @project-maker/api migration:run
```

Expected: migrations `0001` through `0007` apply against only the named,
loopback-only disposable database.

- [ ] **Step 1: Write the failing response-version assertions.**

In the existing create/list test in `projects.e2e-spec.ts`, assert that both
created rows return version `1` and that a reloaded row retains it. In the
existing resolution test, assert that resolving a version-`1` record returns
version `2`.

```ts
assert.equal(later.body.version, 1);
assert.equal(earlier.body.version, 1);
assert.equal(reloadedLater.version, 1);
assert.equal(resolutionResponse.body.version, 2);
```

Extend the local narrowed response cast only where needed:

```ts
as { decisionOrAnswer: string | null; version: number } | undefined;
```

- [ ] **Step 2: Run the API suite and verify the assertions fail.**

```powershell
& $runtimeNode $cachedPnpm --filter @project-maker/api test
```

Expected: FAIL because the current mapper does not emit `version`. Preserve the
failure evidence; do not weaken the assertions.

- [ ] **Step 3: Add the contract, migration, entity mapping, and mapper field.**

Append the exact public input to `packages/contracts/src/discovery-follow-ups.ts`
and add `version` at the end of `DiscoveryFollowUp`:

```ts
export interface UpdateDiscoveryFollowUpInput {
  readonly category: DiscoveryFollowUpCategory;
  readonly question: string;
  readonly owner: string;
  readonly dueDate: string;
  readonly nextStep: string;
  readonly expectedVersion: number;
}
```

Create `apps/api/src/migrations/0008-discovery-follow-up-edit-version.ts`:

```ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DiscoveryFollowUpEditVersion0008DiscoveryFollowUpEditVersion1786521600000
  implements MigrationInterface
{
  name = 'DiscoveryFollowUpEditVersion0008DiscoveryFollowUpEditVersion1786521600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "discovery_follow_ups"
      ADD COLUMN "version" integer NOT NULL DEFAULT 1,
      ADD CONSTRAINT "chk_discovery_follow_ups_version_positive"
      CHECK ("version" > 0)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "discovery_follow_ups"
      DROP CONSTRAINT "chk_discovery_follow_ups_version_positive",
      DROP COLUMN "version"
    `);
  }
}
```

Register that class after migration `0007`. Import `VersionColumn` in
`discovery-follow-up.entity.ts` and place this mapping after `updatedAt`:

```ts
@VersionColumn({ type: 'integer' })
version!: number;
```

Finally, add `version: value.version` to `toDiscoveryFollowUp`. Do not assign a
version manually on create or resolve: TypeORM owns its initialization and
increment when the entity is saved.

- [ ] **Step 4: Prove migration `0008` up/down/up on an isolated database.**

```powershell
& $runtimeNode $cachedPnpm --filter @project-maker/api migration:run
& $runtimeNode $cachedPnpm --filter @project-maker/api migration:revert
& $runtimeNode $cachedPnpm --filter @project-maker/api migration:run
```

Expected: only migration `0008` reverses, then it reapplies. The database has
the positive `version` column again; no production or shared database is used.

- [ ] **Step 5: Run focused contract/API proof.**

```powershell
& $runtimeNode $cachedPnpm --filter @project-maker/contracts test
& $runtimeNode $cachedPnpm --filter @project-maker/api test
& $runtimeNode $cachedPnpm --filter @project-maker/api typecheck
```

Expected: PASS. Existing create returns `1`, resolution returns `2`, and no
existing contract response loses a field.

- [ ] **Step 6: Review Task 1 and clean up its database.**

```powershell
git diff --check
git diff -- packages/contracts/src/discovery-follow-ups.ts apps/api/src/migrations/0008-discovery-follow-up-edit-version.ts apps/api/src/database/migration-data-source.ts apps/api/src/discovery-follow-ups/discovery-follow-up.entity.ts apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts apps/api/test/projects.e2e-spec.ts

Stop-IsolatedProjectMakerPostgres -Container $task1Postgres.Container
if ($null -eq $task1PriorDatabaseUrl) {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
} else {
  $env:DATABASE_URL = $task1PriorDatabaseUrl
}
Remove-Variable task1Postgres, task1PriorDatabaseUrl -ErrorAction SilentlyContinue
```

Expected: the diff is limited to the version representation and its proof; the
exact named disposable container is removed; no stage or commit occurs.

### Task 2: Specify and implement the locked edit API

**Files:**

- Create: `apps/api/src/discovery-follow-ups/dto/update-discovery-follow-up.dto.ts`
- Modify: `apps/api/src/discovery-follow-ups/discovery-follow-ups.controller.ts`
- Modify: `apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts`
- Modify: `apps/api/test/projects.e2e-spec.ts`

**Interfaces:**

- Consumes: `UpdateDiscoveryFollowUpInput`, versioned entity, existing lock
  helpers, `initialDiscoveryFollowUpStatus`, and strict global validation.
- Produces: `PATCH /projects/:projectId/discovery-follow-ups/:followUpId`,
  normalized `200` responses, safe no-op responses, and redacted conflicts.
- Preserves: the existing explicit resolution `POST` command and its status
  policy.

- [ ] **Step 0: Start a dedicated API E2E database.**

```powershell
$task2PriorDatabaseUrl = $env:DATABASE_URL
$task2Postgres = Start-IsolatedProjectMakerPostgres -Container 'project-maker-intake04-edit-api-e2e' -Database 'project_maker_intake04_edit_api_e2e' -Port 55451
$env:DATABASE_URL = $task2Postgres.DatabaseUrl
& $runtimeNode $cachedPnpm --filter @project-maker/api migration:run
```

Expected: migrations `0001` through `0008` are applied before API tests start.

- [ ] **Step 1: Add failing happy-path, no-op, and audit tests.**

After the existing create test, add an edit workflow that creates a follow-up,
then sends the real `PATCH` route with whitespace around all free-text fields:

```ts
const edited = await request(app.getHttpServer())
  .patch(`/projects/${projectId}/discovery-follow-ups/${created.body.id}`)
  .send({
    category: 'TECHNICAL',
    question: '  Which API version is supported now?  ',
    owner: '  Platform team  ',
    dueDate: '2026-09-15',
    nextStep: '  Confirm the supported version.  ',
    expectedVersion: created.body.version,
  })
  .expect(200);

assert.equal(edited.body.question, 'Which API version is supported now?');
assert.equal(edited.body.owner, 'Platform team');
assert.equal(edited.body.nextStep, 'Confirm the supported version.');
assert.equal(edited.body.status, 'Nyitott');
assert.equal(edited.body.decisionOrAnswer, null);
assert.equal(edited.body.version, created.body.version + 1);
```

Reload the list and assert the same values. Query `audit_events` and assert
exactly this one payload for the edit:

```ts
{
  event_type: 'DISCOVERY_FOLLOW_UP_UPDATED',
  payload: {
    followUpId: created.body.id,
    changedFields: 'category,question,owner,dueDate,nextStep',
  },
}
```

Assert serialized audit rows do not contain the old/new question, either owner,
next step, answer, or either version. Then send an equivalent normalized body
using `edited.body.version`; assert `200`, unchanged version, and update-audit
count still `1`.

- [ ] **Step 2: Run the test before the route exists.**

```powershell
& $runtimeNode $cachedPnpm --filter @project-maker/api test
```

Expected: FAIL with a missing `PATCH` route or unexpected response. Keep the
test intact.

- [ ] **Step 3: Add failing invalid, lifecycle, and stale-write coverage.**

Add one invalid-body table. Each case starts from a newly created row, sends a
real `PATCH`, expects `400`, and calls `assertNoSubmittedValues` for every
sentinel. Cover all of the following exact cases:

| Request defect | Sentinel assertion |
| --- | --- |
| Missing `expectedVersion` | Missing-field payload is not echoed |
| `expectedVersion: 0` and `expectedVersion: 1.5` | Numeric value is not echoed |
| Extra `status`, `decisionOrAnswer`, `projectId`, or `sourceChecklistItemId` | Every supplied name/value is rejected by whitelist validation |
| Unknown category, whitespace question/owner/next step, overlength field, impossible date | Existing creation limits also govern edits |

Add these independent real-resource assertions:

1. malformed follow-up UUID returns `400`; missing project, missing row, and a
   row belonging to another project return `404`;
2. archive rejects edit with `409`; restore permits a matching-version edit;
3. resolving a row rejects later edit with `409` and creates no update audit;
4. two updates based on version `1`: first succeeds, second returns `409`, the
   reloaded row is the first change, and update audit count is one; and
5. resolve a version-`1` row, then PATCH with expected version `1`: it returns
   `409`, retains the terminal answer/status, and writes no update audit.

- [ ] **Step 4: Implement the DTO, controller, and transactional service.**

Create the DTO by reusing the exact creation-field decorators and adding a
strict numeric precondition:

```ts
import { IsInt, Min } from 'class-validator';
import type { UpdateDiscoveryFollowUpInput } from '@project-maker/contracts';

import { CreateDiscoveryFollowUpDto } from './create-discovery-follow-up.dto';

export class UpdateDiscoveryFollowUpDto
  extends CreateDiscoveryFollowUpDto
  implements UpdateDiscoveryFollowUpInput
{
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
```

Import `Patch` and the DTO in the controller, then implement exactly the
produced route interface above. Do not add `PUT`, a generic route, a source
route, or an endpoint that accepts status/answer data.

In `DiscoveryFollowUpsService`, import `UpdateDiscoveryFollowUpInput` and add
an `update(projectId, followUpId, input)` method. Keep the current project
lock before `findLockedDiscoveryFollowUp`. The method must:

```ts
const openStatus = await initialDiscoveryFollowUpStatus();
if (entity.status !== openStatus) {
  throw new ConflictException('Discovery follow-up is not open.');
}
if (entity.version !== input.expectedVersion) {
  throw new ConflictException('Discovery follow-up has changed.');
}

const normalized = {
  category: input.category,
  question: normalizeRequiredText(input.question, 'question must not be blank.'),
  owner: normalizeRequiredText(input.owner, 'owner must not be blank.'),
  dueDate: parseDueDate(input.dueDate),
  nextStep: normalizeRequiredText(input.nextStep, 'nextStep must not be blank.'),
};
const changedFields = editableDiscoveryFollowUpFields.filter(
  (field) => entity[field] !== normalized[field],
);
if (changedFields.length === 0) {
  return toDiscoveryFollowUp(entity);
}
```

Define `editableDiscoveryFollowUpFields` once in the required audit order as a
readonly tuple. Assign only its five fields to the locked entity, save it, map
the returned entity, and write one helper-owned audit event:

```ts
const payload: AuditPayload = {
  followUpId: followUp.id,
  changedFields: changedFields.join(','),
};
```

Use a separate `rejectArchivedProjectForEditing` helper so create, resolve, and
edit retain action-specific messages. Keep all errors generic and value-free.

- [ ] **Step 5: Verify the API contract and regression surface.**

```powershell
& $runtimeNode $cachedPnpm --filter @project-maker/contracts test
& $runtimeNode $cachedPnpm --filter @project-maker/api test
& $runtimeNode $cachedPnpm --filter @project-maker/api typecheck
```

Expected: PASS. The real PostgreSQL suite proves normalization, ordering,
version progression, no-op behavior, all `400/404/409` paths, one safe audit
event, no stale overwrite, and all prior creation/resolution tests.

- [ ] **Step 6: Review Task 2 and clean up its database.**

```powershell
git diff --check
git diff -- apps/api/src/discovery-follow-ups/dto/update-discovery-follow-up.dto.ts apps/api/src/discovery-follow-ups/discovery-follow-ups.controller.ts apps/api/src/discovery-follow-ups/discovery-follow-ups.service.ts apps/api/test/projects.e2e-spec.ts

Stop-IsolatedProjectMakerPostgres -Container $task2Postgres.Container
if ($null -eq $task2PriorDatabaseUrl) {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
} else {
  $env:DATABASE_URL = $task2PriorDatabaseUrl
}
Remove-Variable task2Postgres, task2PriorDatabaseUrl -ErrorAction SilentlyContinue
```

Expected: only the narrow `PATCH` edit behaviour is present; resolution remains
its separate command and no stage/commit occurs.

### Task 3: Implement the deep-module edit workflow and browser proof

**Files:**

- Modify: `apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts`
- Modify: `apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts`
- Modify: `apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html`
- Modify: `apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.scss`
- Modify: `apps/web/e2e/discovery-follow-ups.spec.ts`

**Interfaces:**

- Consumes: `UpdateDiscoveryFollowUpInput`, versioned `DiscoveryFollowUp`,
  `PATCH` route, existing Cockpit operation policy, and component-local list.
- Produces: one mutually exclusive inline Edit form, local conflict draft,
  explicit reload action, and stable browser selectors.
- Preserves: component ownership, list loading isolation, creation, resolution,
  audit-refresh emission, archive behaviour, and local date conversion.

- [ ] **Step 0: Start a disposable browser database and temporary pnpm shim.**

```powershell
$task3PriorDatabaseUrl = $env:DATABASE_URL
$task3Postgres = Start-IsolatedProjectMakerPostgres -Container 'project-maker-intake04-edit-web-e2e' -Database 'project_maker_intake04_edit_web_e2e' -Port 55452
$env:DATABASE_URL = $task3Postgres.DatabaseUrl
& $runtimeNode $cachedPnpm --filter @project-maker/api migration:run

$task3PriorPath = $env:Path
$task3PnpmShimDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ('project-maker-edit-pnpm-' + [Guid]::NewGuid().ToString('N'))
$task3PnpmShimPath = Join-Path $task3PnpmShimDirectory 'pnpm.cmd'
New-Item -ItemType Directory -Path $task3PnpmShimDirectory | Out-Null
[System.IO.File]::WriteAllText(
  $task3PnpmShimPath,
  ('@echo off' + [Environment]::NewLine + '"' + $runtimeNode + '" "' + $cachedPnpm + '" %*' + [Environment]::NewLine),
  [System.Text.Encoding]::ASCII
)
$env:Path = $task3PnpmShimDirectory + [System.IO.Path]::PathSeparator + $task3PriorPath
if ((cmd.exe /d /c pnpm --version).Trim() -ne '11.20.0') {
  throw 'The temporary Playwright pnpm shim did not resolve pnpm 11.20.0.'
}
```

Expected: the web E2E database is isolated and the launcher resolves only the
temporary shim; neither path is added to the repository.

- [ ] **Step 1: Add failing real-browser edit and exclusivity workflows.**

Extend the local browser `DiscoveryFollowUp` interface with `version`. Add a
test that creates two open rows through the real API request fixture, opens the
first `edit-discovery-follow-up-button`, and proves:

1. `discovery-follow-up-edit-form` is visible and prefilled from that row;
2. every Edit and Resolve button is disabled while it is open;
3. changing all five controls and clicking
   `save-discovery-follow-up-edit-button` produces a real `PATCH` response
   ending in that row's ID with `200`;
4. the edited values render locally, the earlier due date moves the row to the
   first list position, and reload preserves the values; and
5. a terminal-row `Edit` button count is zero after resolving a row through the
   real API fixture.

Use only the selectors prescribed by the design. For the date field, use the
input nested under `discovery-follow-up-edit-due-date-input` and type a local
`YYYY-MM-DD` date, matching the existing creation test.

- [ ] **Step 2: Add the failing browser conflict-preservation workflow.**

Create one follow-up, open Edit in the browser, change its question to
`Browser draft that must remain.`, and then use the API request fixture to
PATCH the same record with its original version and a distinct server question.
After that external response is `200`, save the browser form and assert:

```ts
expect((await staleBrowserResponse).status()).toBe(409);
await expect(page.getByTestId('discovery-follow-up-edit-conflict')).toBeVisible();
await expect(
  page.getByTestId('discovery-follow-up-edit-question-input'),
).toHaveValue('Browser draft that must remain.');
```

Then wait for the real list refresh, click
`reload-discovery-follow-up-edit-button`, assert the server question and fresh
version are loaded, make one new change, save it with `200`, and reload the
page to prove persistence. No mocked HTTP response is permitted.

Add a third test that opens Edit, types a draft, archives the project through
the existing Cockpit action, then asserts zero edit forms and disabled Edit
buttons; after restore/reload, the open-row Edit button is enabled and its form
is not prefilled with the discarded archive draft.

- [ ] **Step 3: Run the focused browser spec before client implementation.**

```powershell
& $runtimeNode $cachedPnpm --filter @project-maker/web exec playwright test e2e/discovery-follow-ups.spec.ts
```

Expected: FAIL because Edit selectors and the client update route do not exist.
Keep the real API request setup and expected assertions unchanged.

- [ ] **Step 4: Add the typed API adapter and structured update conflict.**

Extend the service imports and `DiscoveryOperation` with `update`, then add:

```ts
update(
  projectId: string,
  followUpId: string,
  input: UpdateDiscoveryFollowUpInput,
): Observable<DiscoveryFollowUp> {
  return this.http
    .patch<DiscoveryFollowUp>(
      '/api/projects/' +
        encodeURIComponent(projectId) +
        '/discovery-follow-ups/' +
        encodeURIComponent(followUpId),
      input,
    )
    .pipe(catchError((error: unknown) => this.fail(error, 'update')));
}
```

Replace the adapter's anonymous `Error` creation with an exported local error
class carrying `operation` and `status`; retain the existing value-free message
and console metadata. The component must recognize only `operation ===
'update' && status === 409` as an edit conflict. Its user-facing message must
state that the draft is kept and a reload is required; all other update errors
retain the typed form value and use the existing action-error surface.

- [ ] **Step 5: Add local edit state and handlers to the deep component.**

Add one five-control `editForm` with the same validators as `creationForm` and
these local signals:

```ts
readonly openedEditId = signal<string | null>(null);
readonly savingEditId = signal<string | null>(null);
readonly editBaseline = signal<DiscoveryFollowUp | null>(null);
readonly editConflictId = signal<string | null>(null);
readonly refreshingEditConflict = signal(false);
```

Implement these single-purpose methods in the component:

| Method | Exact responsibility |
| --- | --- |
| `openEdit(followUpId)` | Finds one canonical-open row; rejects archive/busy/other-row-action cases; resets and prefills `editForm`; captures the complete returned row as baseline. |
| `cancelEdit()` | Does nothing while saving; otherwise clears only edit ID, baseline, conflict state, and form values. |
| `saveEdit(followUpId)` | Marks controls touched, builds a trimmed/date-only input, rejects invalid/no-change/stale UI state, acquires `discovery-update`, calls adapter, replaces only returned row, sorts, closes form, reports success, emits `committedChange`. |
| `refreshAfterEditConflict()` | Calls the real list adapter without entering global loading state; updates list while retaining the form/baseline and clears its refresh spinner only on completion. |
| `reloadEditFromCurrent()` | Uses the refreshed row only if project is active and its status is still canonical-open; explicitly replaces draft/baseline/version and clears conflict. |
| `isEditOpen`, `isEditSaving`, `hasEditChanges`, `editControlDisabled`, `editActionDisabled` | Provide read-only template guards; `hasEditChanges` compares normalized five-field values to the baseline, not `FormGroup.dirty`. |

Use `generalPlaybookV1.statuses.followUp[0]` for the browser-side canonical-open
check rather than a `Nyitott` literal. Update `openResolution` and
`resolveControlDisabled` so one open Edit disables all Resolve actions, and one
open Resolve disables all Edit actions. Expand the existing archive `effect` to
clear the edit form/baseline/conflict as well as the resolution form. Do not
touch the Cockpit shell.

- [ ] **Step 6: Render the exact inline workflow and local styles.**

For an open row, render `Edit` before `Resolve`, bind it to `openEdit`, and
hide both actions for a non-open row. When `isEditOpen(followUp.id)`, render a
reactive form with all required selectors, validation messages that match the
creation form, `Save changes`, `Cancel`, and the conflict-only `Reload current
version` control. Save is disabled for invalid, unchanged, busy, archive, or
conflict state; Cancel remains available after a conflict. Keep the typed draft
visible but disabled while a refreshed row is terminal.

Add only local selectors equivalent to the existing resolution form:

```scss
.discovery-follow-up-edit-form {
  border-top: 1px solid var(--p-content-border-color);
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1rem;
}

.discovery-follow-up-edit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}
```

Reuse `.discovery-follow-up-fields`; do not add global CSS or alter the
existing 4 kB warning / 8 kB error budgets.

- [ ] **Step 7: Run focused web proof and inspect the production style output.**

```powershell
& $runtimeNode $cachedPnpm --filter @project-maker/web typecheck
& $runtimeNode $cachedPnpm --filter @project-maker/web exec playwright test e2e/discovery-follow-ups.spec.ts
& $runtimeNode $cachedPnpm --filter @project-maker/web build
```

Expected: PASS. The browser tests prove a real `PATCH`, exclusive inline forms,
draft preservation/reload after a real `409`, archive clearing, terminal-row
controls, and persistence after reload. The production build emits no
`anyComponentStyle` warning or error.

- [ ] **Step 8: Review Task 3 and clean up only its temporary resources.**

```powershell
git diff --check
git diff -- apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.scss apps/web/e2e/discovery-follow-ups.spec.ts

Stop-IsolatedProjectMakerPostgres -Container $task3Postgres.Container
if ($null -eq $task3PriorDatabaseUrl) {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
} else {
  $env:DATABASE_URL = $task3PriorDatabaseUrl
}
$env:Path = $task3PriorPath
if (-not (Test-Path -LiteralPath $task3PnpmShimPath -PathType Leaf)) {
  throw "Expected pnpm shim is missing: $task3PnpmShimPath"
}
Remove-Item -LiteralPath $task3PnpmShimPath
if (-not (Test-Path -LiteralPath $task3PnpmShimDirectory -PathType Container)) {
  throw "Expected pnpm shim directory is missing: $task3PnpmShimDirectory"
}
Remove-Item -LiteralPath $task3PnpmShimDirectory
Remove-Variable task3Postgres, task3PriorDatabaseUrl, task3PriorPath, task3PnpmShimDirectory, task3PnpmShimPath -ErrorAction SilentlyContinue
```

Expected: no global PATH change or disposable container remains, and all web
changes stay in the discovery deep module.

### Task 4: Synchronize verified delivery documentation and run final gates

**Files:**

- Modify: `docs/roadmap.md`
- Modify: `docs/product-domain.md`
- Modify: `docs/user-guide.md`
- Modify: `docs/operations-handoff.md`
- Modify: `.planning/STATE.md`
- Review: `docs/README.md`, approved design, implementation plan, and `CONTEXT.md`

**Interfaces:**

- Consumes: passing migration/API/browser/full-repository evidence.
- Produces: current-state documentation that calls `.3a` delivered but keeps
  `INTAKE-04` and source linkage planned.
- Does not change: `.planning/REQUIREMENTS.md` parent completion state,
  historical plan claims, or user guide statements without evidence.

- [ ] **Step 0: Start the final isolated verification database.**

```powershell
$task4PriorDatabaseUrl = $env:DATABASE_URL
$task4Postgres = Start-IsolatedProjectMakerPostgres -Container 'project-maker-intake04-edit-final-e2e' -Database 'project_maker_intake04_edit_final_e2e' -Port 55453
$env:DATABASE_URL = $task4Postgres.DatabaseUrl
& $runtimeNode $cachedPnpm --filter @project-maker/api migration:run
```

Expected: all migrations through `0008` apply in a disposable database before
the factual documentation changes are written.

- [ ] **Step 1: Re-run narrow evidence before changing delivery claims.**

```powershell
& $runtimeNode $cachedPnpm --filter @project-maker/contracts test
& $runtimeNode $cachedPnpm --filter @project-maker/api test
& $runtimeNode $cachedPnpm --filter @project-maker/api typecheck
& $runtimeNode $cachedPnpm --filter @project-maker/web typecheck
& $runtimeNode $cachedPnpm --filter @project-maker/web exec playwright test e2e/discovery-follow-ups.spec.ts
```

Expected: PASS. If any check fails, preserve its output, clean up only the
named database, and use systematic debugging before editing delivery-state docs.

- [ ] **Step 2: Update only verified user-facing and operational facts.**

Make the following exact documentation changes after Step 1 passes:

1. In `docs/roadmap.md`, add a `DELIVERED` `INTAKE-04.3a` row for open-item
   editing, version conflict protection, safe update audit, archive boundary,
   and API/browser evidence. Retain parent `INTAKE-04` as `PLANNED`, change its
   remaining scope to optional source linkage only, and leave scoring/readiness
   separate.
2. In `docs/product-domain.md`, state that creation, resolution, and general
   editing are delivered; source checklist-item linkage remains future work.
3. In `docs/user-guide.md`, replace the claim that a follow-up cannot be edited
   with a Hungarian daily workflow for open-item Edit, the five editable
   fields, Cancel, no-op save, conflict-draft preservation/reload, and terminal
   immutability. Retain no-reopen/no-delete/no-source-link limitations and add
   `DISCOVERY_FOLLOW_UP_UPDATED` to audit meaning where relevant.
4. In `docs/operations-handoff.md`, add migration `0008`, the `PATCH` route,
   positive version check, no-op/audit rule, safe two-key payload, and the
   migration down effect. Do not paste test database credentials.
5. In `.planning/STATE.md`, record verified `.3a` capabilities and retain
   source linkage, scoring/readiness, and wider multi-user work as incomplete.

- [ ] **Step 3: Run complete quality gates on the fresh final database.**

```powershell
& $runtimeNode $cachedPnpm verify
& $runtimeNode $cachedPnpm test:e2e
```

Expected: PASS. `verify` includes workspace typecheck, tests, and production
build; `test:e2e` runs the complete browser suite against the safe database.
Record the actual counts/output in the handoff rather than estimating them.

- [ ] **Step 4: Perform scope, documentation, and secrecy review.**

```powershell
git diff --check
git status --short
git diff --name-only

$untrackedPaths = @(git ls-files --others --exclude-standard)
foreach ($untrackedPath in $untrackedPaths) {
  git diff --no-index --check -- NUL $untrackedPath
  if ($LASTEXITCODE -gt 1) {
    throw "Whitespace validation failed for $untrackedPath."
  }
}

rg -n --hidden --glob '!node_modules/**' --glob '!dist/**' --glob '!dist-test/**' '(postgresql://[^[:space:]]+:[^[:space:]]+@|POSTGRES_PASSWORD=|BEGIN [A-Za-z0-9_-]{20,})' .
```

Expected: no whitespace error, secret, generated artifact, dependency noise,
legacy-desktop path, unexpected global style change, or changed file outside
the approved map. Inspect every changed file before requesting Git approval.

- [ ] **Step 5: Clean up final verification state and re-check work state.**

```powershell
Stop-IsolatedProjectMakerPostgres -Container $task4Postgres.Container
if ($null -eq $task4PriorDatabaseUrl) {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
} else {
  $env:DATABASE_URL = $task4PriorDatabaseUrl
}
Remove-Variable task4Postgres, task4PriorDatabaseUrl -ErrorAction SilentlyContinue

& C:\Users\littl\.agents\tools\work-state-preflight.ps1 -RepositoryPath (Get-Location).Path -OutputFormat Markdown
```

Expected: only intentional feature/documentation changes remain. Stop here for
user review and explicit stage/commit/PR/merge authorization.

## Acceptance-Criteria Traceability

| Approved criterion | Plan proof |
| --- | --- |
| Open record can edit all five fields and retain order after reload | Task 2 success/reload API test; Task 3 real-browser persistence/order flow. |
| Server owns non-editable fields and rejects future source data | Task 2 DTO whitelist/negative cases and controller route scope. |
| Positive version advances only for real writes | Task 1 response tests; Task 2 success/no-op/resolve assertions. |
| Stale edit never overwrites data | Task 2 same-version and resolve-versus-edit `409` tests; Task 3 draft-preservation flow. |
| Audit is safe and complete enough | Task 2 exact two-key payload, order, count, and redaction assertions. |
| Edit/Resolve are mutually exclusive, archive read-only | Task 3 real-browser exclusivity and archive tests. |
| Existing workflows and style budget remain sound | Tasks 2–3 focused regressions and Task 4 full `verify`/browser gates. |
| Roadmap and user documentation state only verified delivery | Task 4 evidence-before-docs sequence and current-state review. |

## Plan Self-Review

**Spec coverage:** The four tasks cover the approved contract, version
migration, row-lock conflict rule, normalized no-op rule, audit redaction,
deep-module UI, archive/conflict drafts, browser proof, current documentation,
and full verification.

**Placeholder scan:** No task delegates validation, error handling, migration,
selector, test case, cleanup, or documentation scope to an unspecified future
step. Each code-bearing task names its files, interfaces, exact behavior, and
verification command.

**Type consistency:** `UpdateDiscoveryFollowUpInput`, `expectedVersion`,
`version`, `DISCOVERY_FOLLOW_UP_UPDATED`,
`DiscoveryFollowUpEditVersion0008DiscoveryFollowUpEditVersion1786521600000`,
`discovery-update`, and the stable selectors use the same names throughout.

**Git boundary:** This plan ends at verified review. Staging, committing,
pushing, PR creation, and merge remain separate user-authorized operations.

## Execution Handoff

Plan complete and saved to
`docs/superpowers/plans/2026-08-10-intake-04-discovery-follow-up-editing.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — execute one fresh, reviewed worker task
   at a time using `superpowers:subagent-driven-development`.
2. **Inline Execution** — execute the four tasks in this task using
   `superpowers:executing-plans`, with the review gates above.

The current approved documentation must first be committed to `main` through a
separately approved documentation-only change so the implementation branch can
start from a clean baseline.
