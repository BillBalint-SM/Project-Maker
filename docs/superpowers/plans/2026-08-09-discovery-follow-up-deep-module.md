# Discovery Follow-up Deep Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Move the complete Discovery follow-up workflow behind one cohesive deep Angular module so its data access, state, rules, markup, styles, loading, failures, retry, and feedback are local while the Cockpit route only orchestrates lifecycle and audit refresh.

**Architecture:** A standalone DiscoveryFollowUpsComponent and a module-local DiscoveryFollowUpsApiService own the Discovery read/write implementation. The Cockpit shell supplies projectId and canonical ProjectStatus, while the component inherits the cockpit-local operation policy and emits one committedChange event after successful server mutations. Cockpit core loading no longer waits for the Discovery list.

**Tech Stack:** Angular 22.1 signal inputs/outputs/effects and standalone components, RxJS 7.8.2, PrimeNG 22, Playwright 1.62, SCSS with Angular production budgets, pnpm 11.20.0.

## Global Constraints

- The operation-policy prerequisite is satisfied by merge commit `f0b4564dc3413da2dbd299afe0d56bf25b96aa12`. Begin from a fresh, clean `main` that descends from that commit, then create `dev-discovery-follow-up-module`; do not reuse `dev-cockpit-operation-policy`.
- Keep Discovery follow-ups and Customer email follow-up as separate domains. Do not create a generic Follow-up module, shared form model, or shared adapter.
- The Discovery module owns its list, create and resolution forms, validation, adapter, loading, errors, retry, success feedback, markup, and SCSS.
- The Cockpit shell owns route identity, canonical project lifecycle state, navigation, lifecycle commands, global mutation policy, and audit orchestration.
- The server remains authoritative. Keep all endpoint routes, payloads, response contracts, archive conflicts, audit writes, persistence, and error redaction unchanged.
- Load Cockpit core and Discovery independently. A Discovery GET failure must leave workspace, Customer follow-up, lifecycle, deletion, and audit surfaces usable.
- Initial and retry Discovery reads do not acquire a mutation lease. Create and resolve use discovery-create and discovery-resolve respectively.
- Update the local list only from successful server-returned entities. Do not add optimistic state or refetch the full list after create/resolve.
- Emit committedChange only after a successful create or resolve response. The shell uses it only to call refreshAuditEvents().
- Pass canonical ProjectStatus from the shell. ARCHIVED keeps the list readable, disables Discovery mutations, and clears an open resolution draft. Preserve the creation draft across archive/restore; do not silently discard typed creation work.
- Keep one cohesive public module. Create/list/resolve may use private functions, but do not introduce public submodules for visual sections.
- Move every Discovery-specific style into the Discovery module. Do not move styles to src/styles.scss and do not change the 4 kB warning or 8 kB error budgets.
- The verified production-build baseline is `project-cockpit.page.scss` at 4.17 kB, 175 B over the unchanged 4 kB warning threshold. Measure acceptance from Angular's compiled build output, not the source-file byte count; the completed slice must emit no `anyComponentStyle` warning.
- Preserve every existing Discovery data-testid except the accepted local feedback change: replace Cockpit-level success assertions with discovery-follow-up-action-success and add discovery-follow-up-action-error, discovery-follow-ups-loading, discovery-follow-ups-error, and retry-discovery-follow-ups-button.
- Add no dependency, make no backend/contract/database change, and do not modify pnpm-lock.yaml.
- Use input.required and output for the shell seam. Read required inputs only in a reactive context or ngOnInit. Use an explicit DestroyRef with takeUntilDestroyed in method-started subscriptions.
- Context7 evidence: Angular required signal inputs are valid in templates, computed, effects, and ngOnInit; component providers are inherited by descendants; takeUntilDestroyed with explicit DestroyRef is the supported method-call pattern.
- The current Windows browser launcher resolves bare `pnpm` through PATH inside `apps/web/e2e/start-api-for-e2e.mjs`. Until that separate DX defect is repaired, every task agent that runs Playwright creates and removes its own external, temporary `pnpm.cmd` shim with the per-task harness below. The shim is verification infrastructure only: never add it to the repository, rely on another agent's PATH, or change the launcher in this slice.
- Merge only after the existing five Discovery workflows, four deletion workflows, the new failure-isolation workflow, web unit tests, typecheck, repository verify, and full browser E2E are green.

---

## File Map

| File | Change | Responsibility |
| --- | --- | --- |
| apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts | Create | Domain-local GET/create/resolve adapter and safe actionable error mapping. |
| apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts | Create | Complete Discovery state, forms, rules, operations, lifecycle reaction, and shell event. |
| apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html | Create | Local loading/error/retry, forms, list, resolution, and feedback markup. |
| apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.scss | Create | All Discovery-local layout and state styles. |
| apps/web/src/app/projects/project-api.models.ts | Modify | Remove Discovery data from CockpitView. |
| apps/web/src/app/projects/project-api.service.ts | Modify | Stop loading and mutating Discovery; retain only Cockpit core and other project domains. |
| apps/web/src/app/projects/project-cockpit.page.ts | Modify | Remove Discovery implementation, import the deep module, and retain lifecycle/audit orchestration only. |
| apps/web/src/app/projects/project-cockpit.page.html | Modify | Replace the inline Discovery block with the narrow module seam. |
| apps/web/src/app/projects/project-cockpit.page.scss | Modify | Remove Discovery selectors and leave only Cockpit-owned styles. |
| apps/web/e2e/discovery-follow-ups.spec.ts | Modify | Preserve five workflows, move feedback assertions local, and prove isolated failure plus real Retry. |

## Produced Interfaces

~~~ts
@Injectable()
export class DiscoveryFollowUpsApiService {
  list(projectId: string): Observable<readonly DiscoveryFollowUp[]>;
  create(
    projectId: string,
    input: CreateDiscoveryFollowUpInput,
  ): Observable<DiscoveryFollowUp>;
  resolve(
    projectId: string,
    followUpId: string,
    input: ResolveDiscoveryFollowUpInput,
  ): Observable<DiscoveryFollowUp>;
}

@Component({
  selector: 'app-discovery-follow-ups',
  standalone: true,
})
export class DiscoveryFollowUpsComponent implements OnInit {
  readonly projectId = input.required<string>();
  readonly projectStatus = input.required<ProjectStatus>();
  readonly committedChange = output<void>();
}
~~~

The shell seam is exactly:

~~~html
<app-discovery-follow-ups
  [projectId]="projectId"
  [projectStatus]="current.cockpit.status"
  (committedChange)="refreshAuditEvents()"
/>
~~~

## Execution Bootstrap

Run only after the first PR is merged:

~~~powershell
& C:\Users\littl\.agents\tools\work-state-preflight.ps1 -RepositoryPath (Get-Location).Path -OutputFormat Markdown
git status --short
git branch --show-current
git rev-parse HEAD
git worktree list --porcelain
git remote -v
git switch -c dev-discovery-follow-up-module

$runtimeNode = 'C:\Program Files\nodejs\node.exe'
$cachedPnpm = 'C:\Users\littl\AppData\Local\npm-cache\_npx\90ee57dca4845993\node_modules\pnpm\bin\pnpm.cjs'
& $runtimeNode --version
& $runtimeNode $cachedPnpm --version
~~~

Expected: clean main descends from the merged operation-policy module; Node satisfies the repository range; pnpm reports 11.20.0; the new branch has no upstream or PR. Stop before editing on any mismatch.

## Per-task browser runtime harness

Every fresh task agent that starts a Playwright command must run this setup in
the same PowerShell process before starting its named disposable database.
Keep that process alive through its database cleanup, then run the matching
cleanup block. Do not carry the shim or `$env:Path` across tasks.

~~~powershell
$priorPath = $env:Path
$pnpmShimDirectory = Join-Path ([System.IO.Path]::GetTempPath()) (
  'project-maker-pnpm-shim-' + [Guid]::NewGuid().ToString('N')
)
$pnpmShimPath = Join-Path $pnpmShimDirectory 'pnpm.cmd'
New-Item -ItemType Directory -Path $pnpmShimDirectory | Out-Null
$pnpmShimContents =
  '@echo off' + [Environment]::NewLine +
  '"' + $runtimeNode + '" "' + $cachedPnpm + '" %*' + [Environment]::NewLine
[System.IO.File]::WriteAllText(
  $pnpmShimPath,
  $pnpmShimContents,
  [System.Text.Encoding]::ASCII,
)
$env:Path = $pnpmShimDirectory + [System.IO.Path]::PathSeparator + $priorPath
$shimVersion = (cmd.exe /d /c pnpm --version).Trim()
if ($shimVersion -ne '11.20.0') {
  throw "The temporary Playwright pnpm shim resolved $shimVersion instead of 11.20.0."
}
~~~

Expected: `cmd.exe` resolves the external shim to pnpm 11.20.0. The shim is
outside the repository and lives only for the current task's browser run.

After that task stops its identity-checked database and restores
`DATABASE_URL`, run:

~~~powershell
$env:Path = $priorPath
if (-not (Test-Path -LiteralPath $pnpmShimPath -PathType Leaf)) {
  throw "Expected temporary pnpm shim file is missing: $pnpmShimPath"
}
Remove-Item -LiteralPath $pnpmShimPath
if (-not (Test-Path -LiteralPath $pnpmShimDirectory -PathType Container)) {
  throw "Expected temporary pnpm shim directory is missing: $pnpmShimDirectory"
}
Remove-Item -LiteralPath $pnpmShimDirectory
Remove-Variable priorPath, pnpmShimDirectory, pnpmShimPath, pnpmShimContents
~~~

Expected: PATH is restored exactly; the exact shim file and its now-empty
directory are removed. If a task terminates before cleanup, preserve the
directory as evidence and resolve it explicitly before starting another task.

### Task 1: Specify local failure isolation and feedback in the browser

**Files:**

- Modify: apps/web/e2e/discovery-follow-ups.spec.ts

**Interfaces:**

- Consumes: existing createProject, createDiscoveryFollowUp, nativeButton, real API server, and browser proxy.
- Produces: one deterministic network-failure workflow without fake response data.
- Preserves: the five existing business workflows and all existing stable selectors except the accepted success-message location.

**Runtime:** Run the Per-task browser runtime harness before Step 3 and its
cleanup after Step 5, in the same PowerShell process as this task's database
and Playwright command.

- [ ] **Step 1: Move the two success assertions to the accepted local selector.**

In the resolution persistence and creation tests, replace:

~~~ts
await expect(page.getByTestId('cockpit-action-success')).toBeVisible();
~~~

with:

~~~ts
await expect(
  page.getByTestId('discovery-follow-up-action-success'),
).toBeVisible();
~~~

- [ ] **Step 2: Add the failing failure-isolation and real-Retry workflow.**

Append this test:

~~~ts
test('keeps the cockpit usable when Discovery loading fails and retries the real request', async ({
  page,
  request,
}) => {
  const project = await createProject(
    request,
    'Discovery follow-up isolated load failure',
  );
  await createDiscoveryFollowUp(request, project.id);
  let abortNextDiscoveryRead = true;

  await page.route(
    '**/api/projects/' + project.id + '/discovery-follow-ups',
    async (route) => {
      if (
        abortNextDiscoveryRead &&
        route.request().method() === 'GET'
      ) {
        abortNextDiscoveryRead = false;
        await route.abort('failed');
        return;
      }
      await route.continue();
    },
  );

  await page.goto('/projects/' + project.id);

  await expect(page.getByTestId('workspace-form')).toBeVisible();
  await expect(page.getByTestId('cockpit-error')).toHaveCount(0);
  await expect(page.getByTestId('discovery-follow-ups-error')).toBeVisible();

  const retryResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response
        .url()
        .endsWith(
          '/api/projects/' + project.id + '/discovery-follow-ups',
        ),
  );
  await nativeButton(page, 'retry-discovery-follow-ups-button').click();

  expect((await retryResponse).status()).toBe(200);
  await expect(page.getByTestId('discovery-follow-ups-error')).toHaveCount(0);
  await expect(page.getByTestId('discovery-follow-up-item')).toHaveCount(1);
  await expect(page.getByTestId('workspace-form')).toBeVisible();
});
~~~

This intercept aborts only the first browser GET; Retry continues to the real API and does not fulfill a mocked payload.

- [ ] **Step 3: Start the characterization-test database.**

~~~powershell
$characterizationContainer = 'project-maker-discovery-characterization-e2e'
$characterizationDatabase = 'project_maker_discovery_characterization_e2e'
$characterizationPort = 55439
$priorDatabaseUrl = $env:DATABASE_URL
$dockerArguments = @(
  'run', '--rm', '--detach',
  '--name', $characterizationContainer,
  '--publish', ('127.0.0.1:' + $characterizationPort + ':5432'),
  '--env', 'POSTGRES_USER=project_maker',
  '--env', 'POSTGRES_PASSWORD=project_maker',
  '--env', ('POSTGRES_DB=' + $characterizationDatabase),
  'postgres:17-alpine'
)
docker @dockerArguments
$env:DATABASE_URL =
  'postgresql://project_maker:project_maker@127.0.0.1:' +
  $characterizationPort +
  '/' +
  $characterizationDatabase
& $runtimeNode $cachedPnpm --filter @project-maker/api migration:run
~~~

Expected: only the explicitly named loopback-only disposable database starts.

- [ ] **Step 4: Run the focused spec and prove the current aggregate loader fails the new contract.**

~~~powershell
& $runtimeNode $cachedPnpm --filter @project-maker/web exec playwright test e2e/discovery-follow-ups.spec.ts
~~~

Expected: FAIL because the current aggregate load renders the Cockpit-level error and the new local selectors do not exist. Preserve the Playwright trace.

- [ ] **Step 5: Stop the characterization database and restore the environment.**

~~~powershell
$resolvedContainer = docker inspect --format '{{.Name}}' $characterizationContainer
if ($resolvedContainer -ne '/' + $characterizationContainer) {
  throw "Unexpected database container: $resolvedContainer"
}
docker stop $characterizationContainer
if ($null -eq $priorDatabaseUrl) {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
} else {
  $env:DATABASE_URL = $priorDatabaseUrl
}
Remove-Variable characterizationContainer, characterizationDatabase, characterizationPort, priorDatabaseUrl
$env:Path = $priorPath
if (-not (Test-Path -LiteralPath $pnpmShimPath -PathType Leaf)) {
  throw "Expected temporary pnpm shim file is missing: $pnpmShimPath"
}
Remove-Item -LiteralPath $pnpmShimPath
if (-not (Test-Path -LiteralPath $pnpmShimDirectory -PathType Container)) {
  throw "Expected temporary pnpm shim directory is missing: $pnpmShimDirectory"
}
Remove-Item -LiteralPath $pnpmShimDirectory
Remove-Variable priorPath, pnpmShimDirectory, pnpmShimPath, pnpmShimContents
~~~

Expected: only project-maker-discovery-characterization-e2e is removed; DATABASE_URL and PATH are restored exactly; the exact temporary shim file and its now-empty directory are removed.

### Task 2: Create the Discovery-owned HTTP adapter

**Files:**

- Create: apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts

**Interfaces:**

- Consumes: HttpClient, HttpErrorResponse, RxJS Observable/throwError/catchError, and the existing contract types.
- Produces: the exact DiscoveryFollowUpsApiService interface in Produced Interfaces.
- Does not expose response bodies, submitted text, stack details, SQL, table names, or credentials in errors or logs.

- [ ] **Step 1: Implement the adapter with typed operation failure semantics.**

Create discovery-follow-ups-api.service.ts:

~~~ts
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  catchError,
  type Observable,
  throwError,
} from 'rxjs';
import type {
  CreateDiscoveryFollowUpInput,
  DiscoveryFollowUp,
  ResolveDiscoveryFollowUpInput,
} from '@project-maker/contracts';

type DiscoveryOperation = 'load' | 'create' | 'resolve';

const discoveryActions: Readonly<Record<DiscoveryOperation, string>> = {
  load: 'load discovery follow-ups',
  create: 'create a discovery follow-up',
  resolve: 'resolve a discovery follow-up',
};

@Injectable()
export class DiscoveryFollowUpsApiService {
  private readonly http = inject(HttpClient);

  list(projectId: string): Observable<readonly DiscoveryFollowUp[]> {
    return this.http
      .get<readonly DiscoveryFollowUp[]>(
        '/api/projects/' +
          encodeURIComponent(projectId) +
          '/discovery-follow-ups',
      )
      .pipe(
        catchError((error: unknown) => this.fail(error, 'load')),
      );
  }

  create(
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
        catchError((error: unknown) => this.fail(error, 'create')),
      );
  }

  resolve(
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
        catchError((error: unknown) => this.fail(error, 'resolve')),
      );
  }

  private fail(
    error: unknown,
    operation: DiscoveryOperation,
  ): Observable<never> {
    const action = discoveryActions[operation];
    if (!(error instanceof HttpErrorResponse)) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not ' + action + '. Refresh the page and try again.';
      return throwError(() => new Error(message));
    }

    console.error('Discovery follow-up request failed.', {
      operation,
      status: error.status,
      statusText: error.statusText,
    });

    if (error.status === 0) {
      return throwError(
        () =>
          new Error(
            'Could not ' +
              action +
              ' because the API is unreachable. Check that the server is running, then try again.',
          ),
      );
    }

    return throwError(
      () =>
        new Error(
          'Could not ' +
            action +
            ' (HTTP ' +
            error.status +
            '). ' +
            discoveryNextStep(error.status, operation),
        ),
    );
  }
}

function discoveryNextStep(
  status: number,
  operation: DiscoveryOperation,
): string {
  if (status === 404) {
    return 'Return to the project list and confirm that the project still exists.';
  }
  if (status === 409 && operation === 'create') {
    return 'The project may be archived or changed. Refresh the cockpit and try again.';
  }
  if (status === 409) {
    return 'Refresh the project to see its latest lifecycle state.';
  }
  if (status === 400 && operation === 'create') {
    return 'Choose a category, enter the required text, and use a real due date, then try again.';
  }
  if (status === 400 && operation === 'resolve') {
    return 'Review the entered values and try again.';
  }
  return 'Refresh the Discovery follow-ups and try again.';
}
~~~

- [ ] **Step 2: Run typecheck before wiring the adapter.**

~~~powershell
& $runtimeNode $cachedPnpm --filter @project-maker/web typecheck
~~~

Expected: PASS. The new adapter compiles, contains no root provider, and remains unused until Task 3.

### Task 3: Build one cohesive Discovery deep module

**Files:**

- Create: apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts
- Create: apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html
- Create: apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.scss

**Interfaces:**

- Consumes: DiscoveryFollowUpsApiService; COCKPIT_OPERATION_POLICY; releaseCockpitOperationOnFinalize; contract category, status, entity, input, and ProjectStatus types; PrimeNG controls already used by the Cockpit.
- Produces: required projectId and projectStatus signal inputs plus committedChange output.
- Does not know CockpitView, ProjectApiService, audit requests, Customer follow-up state, lifecycle commands, router, or confirmation dialogs.

- [ ] **Step 1: Create the standalone module shell and local state.**

The component decorator must:

- use selector app-discovery-follow-ups;
- import ButtonModule, CardModule, DatePickerModule, InputTextModule, MessageModule, ProgressSpinnerModule, ReactiveFormsModule, SelectModule, TagModule, and TextareaModule;
- provide DiscoveryFollowUpsApiService locally;
- reference the new HTML and SCSS files.

Use this exact metadata shape after adding the named PrimeNG and Angular
imports:

~~~ts
@Component({
  selector: 'app-discovery-follow-ups',
  standalone: true,
  imports: [
    ButtonModule,
    CardModule,
    DatePickerModule,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    ReactiveFormsModule,
    SelectModule,
    TagModule,
    TextareaModule,
  ],
  providers: [DiscoveryFollowUpsApiService],
  templateUrl: './discovery-follow-ups.component.html',
  styleUrl: './discovery-follow-ups.component.scss',
})
export class DiscoveryFollowUpsComponent implements OnInit {
}
~~~

Use these exact public seams and state declarations:

~~~ts
readonly projectId = input.required<string>();
readonly projectStatus = input.required<ProjectStatus>();
readonly committedChange = output<void>();

private readonly api = inject(DiscoveryFollowUpsApiService);
private readonly operationPolicy = inject(COCKPIT_OPERATION_POLICY);
private readonly destroyRef = inject(DestroyRef);

readonly followUps = signal<readonly DiscoveryFollowUp[]>([]);
readonly loading = signal(true);
readonly loadError = signal<string | null>(null);
readonly actionError = signal<string | null>(null);
readonly feedback = signal<string | null>(null);
readonly openedResolutionId = signal<string | null>(null);
readonly savingResolutionId = signal<string | null>(null);

readonly categoryOptions = discoveryFollowUpCategories.map(
  (value) => ({ label: value, value }),
);
readonly resolvedStatusOptions = resolvedDiscoveryFollowUpStatuses.map(
  (value) => ({ label: value, value }),
);
readonly mutationDisabled = computed(
  () =>
    this.projectStatus() === 'ARCHIVED' ||
    this.operationPolicy.busy(),
);
readonly creating = computed(
  () => this.operationPolicy.activeOperation() === 'discovery-create',
);
~~~

Add these exact forms and reset helpers:

~~~ts
readonly creationForm = new FormGroup({
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

readonly resolutionForm = new FormGroup({
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

private resetCreationForm(): void {
  this.creationForm.reset({
    category: null,
    question: '',
    owner: '',
    dueDate: null,
    nextStep: '',
  });
}

private resetResolutionForm(): void {
  this.resolutionForm.reset({
    status: null,
    decisionOrAnswer: '',
  });
}
~~~

Keep dateFormat yy-mm-dd in the template. Add the current pure helpers at the
bottom of this file with their existing behavior:

~~~ts
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

Implement OnInit:

~~~ts
ngOnInit(): void {
  this.loadFollowUps();
}
~~~

In the constructor, react to the canonical lifecycle input:

~~~ts
constructor() {
  effect(() => {
    if (this.projectStatus() === 'ARCHIVED') {
      this.openedResolutionId.set(null);
      this.resetResolutionForm();
    }
  });
}
~~~

The effect clears only the open resolution draft. It must not reset the creation form.

- [ ] **Step 2: Implement independent list loading and Retry.**

~~~ts
loadFollowUps(): void {
  this.loading.set(true);
  this.loadError.set(null);

  this.api
    .list(this.projectId())
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (followUps) => {
        this.followUps.set(sortDiscoveryFollowUps(followUps));
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
}
~~~

Retry calls loadFollowUps directly. It does not clear a previously loaded list before the request and does not acquire an operation lease.

- [ ] **Step 3: Move create behavior behind the domain adapter.**

Keep the current validation, trimming, date-only conversion, reset, sorting, and copy. Replace global view and feedback writes with local signals:

~~~ts
createFollowUp(): void {
  this.creationForm.markAllAsTouched();
  const value = this.creationForm.getRawValue();
  if (
    this.mutationDisabled() ||
    !value.category ||
    !value.dueDate ||
    this.creationForm.invalid
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
  const lease = this.operationPolicy.tryAcquire('discovery-create');
  if (!lease) {
    return;
  }

  this.actionError.set(null);
  this.feedback.set(null);
  this.api
    .create(this.projectId(), input)
    .pipe(
      releaseCockpitOperationOnFinalize(lease),
      takeUntilDestroyed(this.destroyRef),
    )
    .subscribe({
      next: (created) => {
        this.followUps.update((current) =>
          sortDiscoveryFollowUps([...current, created]),
        );
        this.resetCreationForm();
        this.feedback.set('Discovery follow-up created.');
        this.committedChange.emit();
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
      },
    });
}
~~~

- [ ] **Step 4: Move resolution behavior and exclusivity into the module.**

Rename the current page methods to the local names below and preserve their behavior:

| Local method | Exact behavior |
| --- | --- |
| openResolution(followUpId) | Find the local row; reject resolved, archived, busy, or already-open cases; clear local actionError; open one form and reset it. |
| cancelResolution() | Do nothing while a resolution request is saving; otherwise close and reset the form. |
| resolveFollowUp(followUpId) | Validate local row and form; acquire discovery-resolve; replace only the returned row; close/reset on success; preserve draft on error; emit committedChange only on success. |
| isResolved(followUp) | Use resolvedDiscoveryFollowUpStatuses.includes(followUp.status). |
| isResolutionOpen(followUpId) | Compare openedResolutionId. |
| isResolutionSaving(followUpId) | Require active operation discovery-resolve and matching savingResolutionId. |
| resolutionControlsDisabled() | Return mutationDisabled(). |
| resolveControlDisabled() | Return mutationDisabled() or a non-null openedResolutionId. |

The request body and pipeline must be:

~~~ts
const input: ResolveDiscoveryFollowUpInput = {
  status: value.status,
  decisionOrAnswer: value.decisionOrAnswer.trim(),
};
const lease = this.operationPolicy.tryAcquire('discovery-resolve');
if (!lease) {
  return;
}

this.savingResolutionId.set(followUpId);
this.actionError.set(null);
this.feedback.set(null);
this.api
  .resolve(this.projectId(), followUpId, input)
  .pipe(
    finalize(() => this.savingResolutionId.set(null)),
    releaseCockpitOperationOnFinalize(lease),
    takeUntilDestroyed(this.destroyRef),
  )
  .subscribe({
    next: (resolved) => {
      this.followUps.update((current) =>
        sortDiscoveryFollowUps(
          current.map((candidate) =>
            candidate.id === resolved.id ? resolved : candidate,
          ),
        ),
      );
      this.openedResolutionId.set(null);
      this.resetResolutionForm();
      this.feedback.set('Discovery follow-up resolved.');
      this.committedChange.emit();
    },
    error: (error: Error) => {
      this.actionError.set(error.message);
    },
  });
~~~

- [ ] **Step 5: Move the complete markup and add local state surfaces.**

Move the existing p-card block from project-cockpit.page.html lines 454-691 into discovery-follow-ups.component.html. Keep the business copy and existing test IDs. Make these exact structural changes:

1. Render discovery-follow-ups-loading with ProgressSpinner while loading() is true.
2. Render discovery-follow-ups-error, its actionable message, and retry-discovery-follow-ups-button when loadError() is non-null.
3. Only render creation/list/resolution content after loading succeeds.
4. Render discovery-follow-up-action-error from actionError() and discovery-follow-up-action-success from feedback() immediately above the form.
5. Replace current.discoveryFollowUps with followUps().
6. Bind the form and method names from Steps 3-4.
7. Use only class discovery-follow-up-list on the ordered list; do not depend on the parent audit-events class.

Use this local state shell inside the p-card:

~~~html
@if (loading()) {
  <div
    class="discovery-follow-up-state"
    data-testid="discovery-follow-ups-loading"
    aria-live="polite"
  >
    <p-progress-spinner ariaLabel="Loading discovery follow-ups" />
    <p>Loading Discovery follow-ups…</p>
  </div>
} @else if (loadError(); as error) {
  <div
    class="discovery-follow-up-state"
    data-testid="discovery-follow-ups-error"
    role="alert"
  >
    <p>{{ error }}</p>
    <p-button
      label="Retry"
      data-testid="retry-discovery-follow-ups-button"
      (onClick)="loadFollowUps()"
    />
  </div>
}
~~~

After the load-error branch, add a final @else branch. Its first children are
the two exact local messages below; immediately after them move the existing
creation form and list/resolution subtree from project-cockpit.page.html lines
460-690, applying the seven binding changes listed above.

~~~html
@if (actionError(); as error) {
  <p-message
    severity="error"
    data-testid="discovery-follow-up-action-error"
  >
    {{ error }}
  </p-message>
}
@if (feedback(); as message) {
  <p-message
    severity="success"
    data-testid="discovery-follow-up-action-success"
  >
    {{ message }}
  </p-message>
}
~~~

- [ ] **Step 6: Move all Discovery styles into the module.**

Create discovery-follow-ups.component.scss with this complete initial style ownership:

~~~scss
:host {
  display: block;
}

.discovery-follow-up-form,
.discovery-follow-up-fields {
  display: grid;
  gap: 1.25rem;
}

.discovery-follow-up-fields {
  border: 0;
  margin: 0;
  min-inline-size: 0;
  padding: 0;
}

.discovery-follow-up-state {
  align-items: center;
  color: var(--p-text-muted-color);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  justify-content: center;
  line-height: 1.5;
  min-height: 8rem;
  text-align: center;
}

.discovery-follow-up-list {
  display: grid;
  gap: 1rem;
  list-style: none;
  margin: 1.5rem 0 0;
  padding: 0;
}

.discovery-follow-up-item {
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.75rem;
  padding: 1rem;
}

.discovery-follow-up-meta {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

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

p-message {
  display: block;
  margin-bottom: 0.75rem;
}
~~~

Do not copy Cockpit grid, audit, customer, workspace, lifecycle, or global utility styles into this file.

- [ ] **Step 7: Run component compilation gates.**

~~~powershell
& $runtimeNode $cachedPnpm --filter @project-maker/web test
& $runtimeNode $cachedPnpm --filter @project-maker/web typecheck
~~~

Expected: PASS. The new component compiles with required inputs, local provider, inherited operation policy, and no parent dependency.

### Task 4: Replace the inline implementation with the narrow shell seam

**Files:**

- Modify: apps/web/src/app/projects/project-api.models.ts
- Modify: apps/web/src/app/projects/project-api.service.ts
- Modify: apps/web/src/app/projects/project-cockpit.page.ts
- Modify: apps/web/src/app/projects/project-cockpit.page.html
- Modify: apps/web/src/app/projects/project-cockpit.page.scss
- Modify: apps/web/e2e/discovery-follow-ups.spec.ts

**Interfaces:**

- Consumes: DiscoveryFollowUpsComponent and the merged operation policy.
- Produces: the exact shell seam in Produced Interfaces.
- Removes: every Discovery form, signal, method, helper, HTTP method, aggregate property, inline markup block, and parent style selector.

**Runtime:** Run the Per-task browser runtime harness before Step 5 and its
cleanup after Step 7, in the same PowerShell process as this task's database
and Playwright command.

- [ ] **Step 1: Remove Discovery from the Cockpit aggregate adapter.**

In project-api.models.ts remove the DiscoveryFollowUp import and this property:

~~~ts
readonly discoveryFollowUps: readonly DiscoveryFollowUp[];
~~~

In ProjectApiService:

- remove CreateDiscoveryFollowUpInput, DiscoveryFollowUp, and ResolveDiscoveryFollowUpInput imports;
- remove discoveryFollowUps from loadCockpit forkJoin;
- return only cockpit, project, and followUp from the map;
- delete createDiscoveryFollowUp and resolveDiscoveryFollowUp;
- delete only the Discovery-specific action-string branches from followUpErrorNextStep.

The resulting aggregate map is:

~~~ts
map(({ cockpit, projects, followUp }) => {
  const project = projects.find((candidate) => candidate.id === projectId);
  if (!project) {
    throw new Error(
      'The cockpit loaded, but its project is missing from the project list. Refresh the page; if the problem continues, check the API data.',
    );
  }
  return { cockpit, project, followUp };
})
~~~

- [ ] **Step 2: Reduce ProjectCockpitPage to orchestration ownership.**

Import DiscoveryFollowUpsComponent and add it to component imports. Remove from project-cockpit.page.ts:

- all Discovery contract imports;
- category/status option arrays;
- creation and resolution FormGroups;
- opened/saving resolution IDs;
- create, open, cancel, resolve, status, disabled, and reset methods;
- toLocalDateOnly and sortDiscoveryFollowUps;
- every Discovery property update in setView and applyWorkspaceResponse.

Keep operationPolicy public because the shell still uses it for other domains. Keep refreshAuditEvents public for the output binding.

applyWorkspaceResponse must preserve only:

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
});
this.resetForm(project);
~~~

- [ ] **Step 3: Replace the inline card with the narrow seam.**

Delete the old lines 454-691 Discovery p-card block and insert:

~~~html
<app-discovery-follow-ups
  [projectId]="projectId"
  [projectStatus]="current.cockpit.status"
  (committedChange)="refreshAuditEvents()"
/>
~~~

Keep the module in the same full-width position after cockpit-grid and before the delete confirmation dialog.

- [ ] **Step 4: Remove parent-owned Discovery styles.**

In project-cockpit.page.scss:

- change the combined workspace-form/discovery-follow-up-form selector to workspace-form only;
- change the combined workspace-fields/discovery-follow-up-fields selector to workspace-fields only;
- remove discovery-follow-up-list, discovery-follow-up-item, discovery-follow-up-meta, discovery-follow-up-resolution-form, and discovery-follow-up-resolution-actions;
- leave audit-events and every non-Discovery selector unchanged.

- [ ] **Step 5: Start the focused verification database.**

~~~powershell
$focusedContainer = 'project-maker-discovery-focused-e2e'
$focusedDatabase = 'project_maker_discovery_focused_e2e'
$focusedPort = 55440
$priorDatabaseUrl = $env:DATABASE_URL
$dockerArguments = @(
  'run', '--rm', '--detach',
  '--name', $focusedContainer,
  '--publish', ('127.0.0.1:' + $focusedPort + ':5432'),
  '--env', 'POSTGRES_USER=project_maker',
  '--env', 'POSTGRES_PASSWORD=project_maker',
  '--env', ('POSTGRES_DB=' + $focusedDatabase),
  'postgres:17-alpine'
)
docker @dockerArguments
$env:DATABASE_URL =
  'postgresql://project_maker:project_maker@127.0.0.1:' +
  $focusedPort +
  '/' +
  $focusedDatabase
& $runtimeNode $cachedPnpm --filter @project-maker/api migration:run
~~~

Expected: only project-maker-discovery-focused-e2e starts on loopback.

- [ ] **Step 6: Run focused browser and build gates.**

~~~powershell
& $runtimeNode $cachedPnpm --filter @project-maker/web test
& $runtimeNode $cachedPnpm --filter @project-maker/web typecheck
& $runtimeNode $cachedPnpm --filter @project-maker/web exec playwright test e2e/discovery-follow-ups.spec.ts e2e/project-delete.spec.ts
& $runtimeNode $cachedPnpm --filter @project-maker/web build
~~~

Expected:

- all six Discovery tests pass: the original five plus failure isolation/Retry;
- all four deletion tests pass;
- the production build exits 0;
- neither project-cockpit.page.scss nor discovery-follow-ups.component.scss exceeds the unchanged 4 kB warning threshold;
- build output contains no anyComponentStyle warning;
- angular.json is absent from the diff.

- [ ] **Step 7: Stop the focused database and restore the environment.**

~~~powershell
$resolvedContainer = docker inspect --format '{{.Name}}' $focusedContainer
if ($resolvedContainer -ne '/' + $focusedContainer) {
  throw "Unexpected database container: $resolvedContainer"
}
docker stop $focusedContainer
if ($null -eq $priorDatabaseUrl) {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
} else {
  $env:DATABASE_URL = $priorDatabaseUrl
}
Remove-Variable focusedContainer, focusedDatabase, focusedPort, priorDatabaseUrl
$env:Path = $priorPath
if (-not (Test-Path -LiteralPath $pnpmShimPath -PathType Leaf)) {
  throw "Expected temporary pnpm shim file is missing: $pnpmShimPath"
}
Remove-Item -LiteralPath $pnpmShimPath
if (-not (Test-Path -LiteralPath $pnpmShimDirectory -PathType Container)) {
  throw "Expected temporary pnpm shim directory is missing: $pnpmShimDirectory"
}
Remove-Item -LiteralPath $pnpmShimDirectory
Remove-Variable priorPath, pnpmShimDirectory, pnpmShimPath, pnpmShimContents
~~~

Expected: only project-maker-discovery-focused-e2e is removed; DATABASE_URL and PATH are restored exactly; the exact temporary shim file and its now-empty directory are removed.

- [ ] **Step 8: Review and commit the complete extraction.**

~~~powershell
git diff --check
git diff --stat
git diff -- apps/web/src/app/projects apps/web/e2e/discovery-follow-ups.spec.ts
git add apps/web/src/app/projects apps/web/e2e/discovery-follow-ups.spec.ts
git commit -m "refactor(web): deepen discovery follow-ups"
~~~

Expected: one cohesive Discovery directory, one narrow shell seam, no Discovery implementation left in ProjectCockpitPage or ProjectApiService, and no file outside the approved map.

### Task 5: Run final gates and prepare the second PR

**Files:**

- Verify only; source changes are allowed only when a gate exposes a real defect in Tasks 1-4.

**Interfaces:**

- Consumes: the complete Discovery deep-module slice.
- Produces: repository, browser, budget, scope, secrecy, and Git evidence.

**Runtime:** Run the Per-task browser runtime harness before Step 1 and keep
it in this task's PowerShell process through Step 3.

- [ ] **Step 1: Start the named disposable browser database.**

~~~powershell
$discoveryDatabaseContainer = 'project-maker-discovery-module-e2e'
$discoveryDatabaseName = 'project_maker_discovery_module_e2e'
$discoveryDatabasePort = 55438
$priorDatabaseUrl = $env:DATABASE_URL

$dockerArguments = @(
  'run',
  '--rm',
  '--detach',
  '--name', $discoveryDatabaseContainer,
  '--publish', ('127.0.0.1:' + $discoveryDatabasePort + ':5432'),
  '--env', 'POSTGRES_USER=project_maker',
  '--env', 'POSTGRES_PASSWORD=project_maker',
  '--env', ('POSTGRES_DB=' + $discoveryDatabaseName),
  'postgres:17-alpine'
)
docker @dockerArguments

$env:DATABASE_URL =
  'postgresql://project_maker:project_maker@127.0.0.1:' +
  $discoveryDatabasePort +
  '/' +
  $discoveryDatabaseName
& $runtimeNode $cachedPnpm --filter @project-maker/api migration:run
~~~

Expected: the exact loopback-only disposable database starts and its name contains e2e.

- [ ] **Step 2: Run full repository and browser verification.**

~~~powershell
& $runtimeNode $cachedPnpm verify
& $runtimeNode $cachedPnpm test:e2e
~~~

Expected: PASS. The full suite uses the real API/database/browser stack and the production build contains no Cockpit component-style warning.

- [ ] **Step 3: Stop only the named database and restore runtime environment state.**

~~~powershell
$resolvedContainer = docker inspect --format '{{.Name}}' $discoveryDatabaseContainer
if ($resolvedContainer -ne '/' + $discoveryDatabaseContainer) {
  throw "Unexpected database container: $resolvedContainer"
}
docker stop $discoveryDatabaseContainer

if ($null -eq $priorDatabaseUrl) {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
} else {
  $env:DATABASE_URL = $priorDatabaseUrl
}
Remove-Variable discoveryDatabaseContainer, discoveryDatabaseName, discoveryDatabasePort, priorDatabaseUrl
$env:Path = $priorPath
if (-not (Test-Path -LiteralPath $pnpmShimPath -PathType Leaf)) {
  throw "Expected temporary pnpm shim file is missing: $pnpmShimPath"
}
Remove-Item -LiteralPath $pnpmShimPath
if (-not (Test-Path -LiteralPath $pnpmShimDirectory -PathType Container)) {
  throw "Expected temporary pnpm shim directory is missing: $pnpmShimDirectory"
}
Remove-Item -LiteralPath $pnpmShimDirectory
Remove-Variable priorPath, pnpmShimDirectory, pnpmShimPath, pnpmShimContents
~~~

Expected: only project-maker-discovery-module-e2e is stopped and auto-removed; DATABASE_URL and PATH are restored exactly; the exact temporary shim file and its now-empty directory are removed.

- [ ] **Step 4: Run final scope, deletion-test, and secrecy review.**

~~~powershell
git diff main...HEAD --check
git diff main...HEAD --stat
git status --short

$changedPaths = @(git diff --name-only main...HEAD)
$expectedPaths = @(
  'apps/web/e2e/discovery-follow-ups.spec.ts',
  'apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts',
  'apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html',
  'apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.scss',
  'apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts',
  'apps/web/src/app/projects/project-api.models.ts',
  'apps/web/src/app/projects/project-api.service.ts',
  'apps/web/src/app/projects/project-cockpit.page.html',
  'apps/web/src/app/projects/project-cockpit.page.scss',
  'apps/web/src/app/projects/project-cockpit.page.ts'
)
Compare-Object $expectedPaths $changedPaths

rg -n 'CreateDiscoveryFollowUpInput|ResolveDiscoveryFollowUpInput|discoveryFollowUp(Form|Saving|Resolution|Controls|Mutation)|/discovery-follow-ups' apps/web/src/app/projects/project-cockpit.page.ts apps/web/src/app/projects/project-api.service.ts apps/web/src/app/projects/project-api.models.ts
rg -n 'app-discovery-follow-ups' apps/web/src/app/projects/project-cockpit.page.html
rg -n 'discovery-follow-up' apps/web/src/app/projects/project-cockpit.page.scss
rg -n 'anyComponentStyle|maximumWarning|maximumError' apps/web/angular.json
rg -n --hidden --glob '!node_modules/**' --glob '!dist/**' --glob '!dist-test/**' '(postgresql://[^[:space:]]+:[^[:space:]]+@|POSTGRES_PASSWORD=|BEGIN [A-Za-z0-9_-]{20,})' apps/web/src
& C:\Users\littl\.agents\tools\work-state-preflight.ps1 -RepositoryPath (Get-Location).Path -OutputFormat Markdown
~~~

Expected:

- Compare-Object prints nothing;
- the implementation-leak search returns no match;
- the shell-template search returns exactly the one intended module seam;
- the parent-SCSS search returns no match;
- angular.json still reports 4 kB warning and 8 kB error;
- the source secrecy scan returns no match;
- worktree is clean after the extraction commit.

- [ ] **Step 5: Publish through the approved finishing workflow.**

Use superpowers:requesting-code-review and superpowers:finishing-a-development-branch. Re-run WORK_STATE before push, PR creation, and merge. Create the second focused PR to main, merge only with green checks, then run WORK_STATE again and do not reuse the merged branch.

## Acceptance-Criteria Traceability

| Criterion | Implementation and proof |
| --- | --- |
| Cockpit is a thin orchestration module | Task 4 removes all Discovery state/rules/data/style and mounts one narrow seam |
| Discovery owns full vertical implementation | Tasks 2-3 adapter, state, forms, validation, markup, style, loading, feedback |
| Customer email domain remains separate | Global constraints; no Customer adapter/form movement |
| Server remains authority | Existing routes/contracts unchanged; real 400/404/409 behavior retained |
| Global single-flight remains | Task 3 uses merged discovery-create/discovery-resolve leases |
| Canonical lifecycle input | Task 3 required ProjectStatus input and archive effect |
| Archived list readable and mutation disabled | Existing archive browser workflow |
| Open resolution draft clears; creation draft remains | Task 3 lifecycle effect; existing archive/restore resolution workflow |
| Local server-response reconciliation | Task 3 create insert and resolve replacement; no optimistic update or refetch |
| Audit refresh stays shell-owned | committedChange output and Task 4 binding |
| Discovery failure does not block Cockpit core | Task 1 network fault plus real Retry browser workflow |
| SCSS budget resolves through locality | Task 3 style ownership; Task 4 unchanged budget build gate |
| Existing behavior remains | Five existing Discovery and four deletion workflows plus full E2E |

## Plan Self-Review

**Spec coverage:** Tasks cover the approved vertical ownership, local adapter, independent loading, local errors/feedback, Retry, lifecycle seam, operation-policy inheritance, server-response reconciliation, audit notification, cohesive module granularity, style locality, unchanged budget, and separate second PR.

**Placeholder scan:** Production steps contain exact paths, interfaces,
selectors, method responsibilities, request pipelines, failure injection,
expected outcomes, and review commands; no deferred production fragment remains.

**Type consistency:** projectId, projectStatus, committedChange, DiscoveryFollowUpsApiService, DiscoveryFollowUpsComponent, discovery-create, discovery-resolve, and all local state names are consistent across the file map, code, shell binding, and acceptance table.

**Deletion test:** Removing the new module would force list loading, forms, mutation rules, server-response reconciliation, local failures, markup, and SCSS back into ProjectCockpitPage. The module therefore earns its interface and is not a visual-only split.

**Documentation boundary:** ADR 0001 records the durable choice. No roadmap, product-domain, operations, or user-guide claim changes because this slice changes architecture and failure isolation, not business capability.

## Execution Handoff

Plan complete. Choose one execution approach:

1. **Subagent-Driven (recommended)** — use superpowers:subagent-driven-development with a fresh worker and two-stage review per task.
2. **Inline Execution** — use superpowers:executing-plans and execute the tasks in verified batches.
