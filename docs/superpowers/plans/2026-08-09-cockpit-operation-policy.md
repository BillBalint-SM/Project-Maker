# Cockpit Operation Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Replace duplicated Cockpit mutation flags with one cockpit-local, typed, globally single-flight operation policy without changing delivered business behavior.

**Architecture:** A component-scoped provider owns one active typed operation lease for the Project Cockpit route and all descendant domain modules. The server remains authoritative for business and lifecycle validity; the browser policy only coordinates mutation concurrency. Every leased RxJS request releases through finalize on completion, error, or unsubscription.

**Tech Stack:** Angular 22.1 standalone components and signals, RxJS 7.8.2, Vitest 4.1, PrimeNG 22, Playwright 1.62, pnpm 11.20.0.

## Global Constraints

- Execute only after a fresh WORK_STATE preflight proves a clean main baseline, then create the short-lived branch dev-cockpit-operation-policy. Do not reuse a merged branch.
- Keep the policy cockpit-local. Do not publish it through a global shared module and do not introduce a generic application operation manager.
- The server remains the final authority for lifecycle and business validity. Keep every existing server request and conflict response unchanged.
- Allow at most one Cockpit mutation at a time. Audit loading, audit retry, audit pagination, and initial Cockpit loading are reads and must not acquire a lease.
- Use exactly these operation identities: workspace-save, customer-follow-up-save, customer-follow-up-ping, customer-review-email, discovery-create, discovery-resolve, project-archive, project-restore, project-delete.
- Preserve all current forms, copy, data-testid values, navigation, lifecycle behavior, customer-email behavior, Discovery behavior, and error redaction.
- Preserve the existing rule that an open Discovery resolution form is not itself a mutation: archive remains available and clears that draft after the lifecycle transition.
- Do not change apps/web/angular.json. The current 4 kB style warning may remain in this first slice; the second delivery slice removes it through style locality.
- Add no dependency and do not modify pnpm-lock.yaml.
- Use takeUntilDestroyed with an explicit DestroyRef for leased requests initiated from methods.
- Context7 evidence: Angular component providers are scoped to the component and descendants; RxJS 7.8 finalize runs on complete, error, and explicit unsubscription.
- Each task ends in a reviewable commit. Push, PR creation, and merge happen only after every gate passes and the finishing-development-branch workflow revalidates Git state.

---

## File Map

| File | Change | Responsibility |
| --- | --- | --- |
| apps/web/src/app/projects/cockpit-operation-policy.ts | Create | Typed operation identities, lease lifecycle, local injection token/provider, and RxJS finalization operator. |
| apps/web/src/app/projects/cockpit-operation-policy.spec.ts | Create | Prove single-flight acquisition, typed active state, complete/error/unsubscribe release, and double-release failure. |
| apps/web/src/app/projects/project-cockpit.page.ts | Modify | Consume the policy for every mutating request and derive existing loading indicators from the active operation. |
| apps/web/src/app/projects/project-cockpit.page.html | Modify | Replace repeated cross-mutation boolean expressions with the single policy state while preserving lifecycle and dirty-form guards. |

## Produced Interfaces

~~~ts
export const cockpitOperationIds = [
  'workspace-save',
  'customer-follow-up-save',
  'customer-follow-up-ping',
  'customer-review-email',
  'discovery-create',
  'discovery-resolve',
  'project-archive',
  'project-restore',
  'project-delete',
] as const;

export type CockpitOperationId = (typeof cockpitOperationIds)[number];

export interface CockpitOperationLease {
  readonly operation: CockpitOperationId;
  release(): void;
}

export interface CockpitOperationPolicy {
  readonly activeOperation: Signal<CockpitOperationId | null>;
  readonly busy: Signal<boolean>;
  tryAcquire(operation: CockpitOperationId): CockpitOperationLease | null;
}

export const COCKPIT_OPERATION_POLICY:
  InjectionToken<CockpitOperationPolicy>;

export function createCockpitOperationPolicy(): CockpitOperationPolicy;
export function provideCockpitOperationPolicy(): Provider;

export function releaseCockpitOperationOnFinalize<T>(
  lease: CockpitOperationLease,
): MonoTypeOperatorFunction<T>;
~~~

## Execution Bootstrap

Run from the repository root:

~~~powershell
& C:\Users\littl\.agents\tools\work-state-preflight.ps1 -RepositoryPath (Get-Location).Path -OutputFormat Markdown
git status --short
git branch --show-current
git rev-parse HEAD
git worktree list --porcelain
git remote -v
git switch -c dev-cockpit-operation-policy

$runtimeNode = 'C:\Program Files\nodejs\node.exe'
$cachedPnpm = 'C:\Users\littl\AppData\Local\npm-cache\_npx\90ee57dca4845993\node_modules\pnpm\bin\pnpm.cjs'
& $runtimeNode --version
& $runtimeNode $cachedPnpm --version
~~~

Expected: the preflight reports the intended clean main baseline; Node satisfies ^22.22.3 or ^24.15.0 or >=26.0.0; pnpm reports exactly 11.20.0; the new branch has no upstream or PR. Stop before editing on any mismatch.

### Task 1: Build the typed single-flight lease module

**Files:**

- Create: apps/web/src/app/projects/cockpit-operation-policy.spec.ts
- Create: apps/web/src/app/projects/cockpit-operation-policy.ts

**Interfaces:**

- Consumes: Angular Signal, InjectionToken, Provider and RxJS finalize.
- Produces: the exact interfaces in Produced Interfaces.
- Does not know HTTP, forms, project lifecycle, domain entities, error copy, or navigation.

- [ ] **Step 1: Write the failing policy tests.**

Create apps/web/src/app/projects/cockpit-operation-policy.spec.ts:

~~~ts
import { NEVER, of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';

import {
  createCockpitOperationPolicy,
  releaseCockpitOperationOnFinalize,
} from './cockpit-operation-policy';

describe('cockpit operation policy', () => {
  it('acquires one typed operation and rejects a concurrent mutation', () => {
    const policy = createCockpitOperationPolicy();

    expect(policy.activeOperation()).toBeNull();
    expect(policy.busy()).toBe(false);

    const lease = policy.tryAcquire('workspace-save');

    expect(lease?.operation).toBe('workspace-save');
    expect(policy.activeOperation()).toBe('workspace-save');
    expect(policy.busy()).toBe(true);
    expect(policy.tryAcquire('project-archive')).toBeNull();

    lease?.release();

    expect(policy.activeOperation()).toBeNull();
    expect(policy.busy()).toBe(false);
  });

  it('fails fast when the same lease is released twice', () => {
    const policy = createCockpitOperationPolicy();
    const lease = policy.tryAcquire('project-delete');

    expect(lease).not.toBeNull();
    lease?.release();

    expect(() => lease?.release()).toThrowError(
      'Cockpit operation lease project-delete was already released.',
    );
  });

  it('releases on Observable completion, error, and explicit unsubscribe', () => {
    const completedPolicy = createCockpitOperationPolicy();
    const completedLease =
      completedPolicy.tryAcquire('customer-follow-up-save');
    expect(completedLease).not.toBeNull();
    of('saved')
      .pipe(releaseCockpitOperationOnFinalize(completedLease!))
      .subscribe();
    expect(completedPolicy.busy()).toBe(false);

    const failedPolicy = createCockpitOperationPolicy();
    const failedLease = failedPolicy.tryAcquire('discovery-create');
    expect(failedLease).not.toBeNull();
    throwError(() => new Error('expected failure'))
      .pipe(releaseCockpitOperationOnFinalize(failedLease!))
      .subscribe({ error: () => undefined });
    expect(failedPolicy.busy()).toBe(false);

    const cancelledPolicy = createCockpitOperationPolicy();
    const cancelledLease =
      cancelledPolicy.tryAcquire('customer-review-email');
    expect(cancelledLease).not.toBeNull();
    const subscription = NEVER.pipe(
      releaseCockpitOperationOnFinalize(cancelledLease!),
    ).subscribe();
    subscription.unsubscribe();
    expect(cancelledPolicy.busy()).toBe(false);
  });
});
~~~

- [ ] **Step 2: Run the web unit suite and prove the module is absent.**

~~~powershell
& $runtimeNode $cachedPnpm --filter @project-maker/web test
~~~

Expected: FAIL because ./cockpit-operation-policy cannot be resolved. Existing tests remain the regression baseline.

- [ ] **Step 3: Implement the minimum deep policy module.**

Create apps/web/src/app/projects/cockpit-operation-policy.ts:

~~~ts
import {
  computed,
  InjectionToken,
  signal,
  type Provider,
  type Signal,
} from '@angular/core';
import { finalize, type MonoTypeOperatorFunction } from 'rxjs';

export const cockpitOperationIds = [
  'workspace-save',
  'customer-follow-up-save',
  'customer-follow-up-ping',
  'customer-review-email',
  'discovery-create',
  'discovery-resolve',
  'project-archive',
  'project-restore',
  'project-delete',
] as const;

export type CockpitOperationId = (typeof cockpitOperationIds)[number];

export interface CockpitOperationLease {
  readonly operation: CockpitOperationId;
  release(): void;
}

export interface CockpitOperationPolicy {
  readonly activeOperation: Signal<CockpitOperationId | null>;
  readonly busy: Signal<boolean>;
  tryAcquire(operation: CockpitOperationId): CockpitOperationLease | null;
}

export const COCKPIT_OPERATION_POLICY =
  new InjectionToken<CockpitOperationPolicy>('COCKPIT_OPERATION_POLICY');

export function createCockpitOperationPolicy(): CockpitOperationPolicy {
  const activeOperationState = signal<CockpitOperationId | null>(null);
  const activeOperation = activeOperationState.asReadonly();
  const busy = computed(() => activeOperation() !== null);
  let activeLeaseToken: symbol | null = null;

  function tryAcquire(
    operation: CockpitOperationId,
  ): CockpitOperationLease | null {
    if (activeLeaseToken !== null) {
      return null;
    }

    const leaseToken = Symbol(operation);
    let released = false;
    activeLeaseToken = leaseToken;
    activeOperationState.set(operation);

    return {
      operation,
      release(): void {
        if (released) {
          throw new Error(
            'Cockpit operation lease ' + operation + ' was already released.',
          );
        }
        if (
          activeLeaseToken !== leaseToken ||
          activeOperationState() !== operation
        ) {
          throw new Error(
            'Cockpit operation lease ' + operation + ' is not active.',
          );
        }

        released = true;
        activeLeaseToken = null;
        activeOperationState.set(null);
      },
    };
  }

  return { activeOperation, busy, tryAcquire };
}

export function provideCockpitOperationPolicy(): Provider {
  return {
    provide: COCKPIT_OPERATION_POLICY,
    useFactory: createCockpitOperationPolicy,
  };
}

export function releaseCockpitOperationOnFinalize<T>(
  lease: CockpitOperationLease,
): MonoTypeOperatorFunction<T> {
  return finalize(() => lease.release());
}
~~~

- [ ] **Step 4: Run unit tests and typecheck.**

~~~powershell
& $runtimeNode $cachedPnpm --filter @project-maker/web test
& $runtimeNode $cachedPnpm --filter @project-maker/web typecheck
~~~

Expected: PASS. The policy is idle after completion, error, and unsubscribe; a second lease is rejected; double release throws the exact actionable error.

- [ ] **Step 5: Review and commit the policy module.**

~~~powershell
git diff --check
git diff -- apps/web/src/app/projects/cockpit-operation-policy.ts apps/web/src/app/projects/cockpit-operation-policy.spec.ts
git add apps/web/src/app/projects/cockpit-operation-policy.ts apps/web/src/app/projects/cockpit-operation-policy.spec.ts
git commit -m "refactor(web): add cockpit operation policy"
~~~

Expected: one pure deep module and its focused tests; no page, dependency, lockfile, backend, or documentation changes.

### Task 2: Route every Cockpit mutation through the lease

**Files:**

- Modify: apps/web/src/app/projects/project-cockpit.page.ts
- Modify: apps/web/src/app/projects/project-cockpit.page.html

**Interfaces:**

- Consumes: COCKPIT_OPERATION_POLICY, provideCockpitOperationPolicy, releaseCockpitOperationOnFinalize and CockpitOperationId.
- Produces: the same public loading call sites already used by the template: saving(), transitioning(), followUpSaving(), discoveryFollowUpSaving(), pinging(), reviewSending(), deleting(), and discoveryFollowUpMutationInProgress().
- Preserves the current ProjectApiService interface and every current request payload/response.

- [ ] **Step 1: Establish the pre-refactor behavior baseline.**

~~~powershell
& $runtimeNode $cachedPnpm --filter @project-maker/web test
& $runtimeNode $cachedPnpm --filter @project-maker/web typecheck
~~~

Expected: PASS at the Task 1 commit.

- [ ] **Step 2: Scope one policy instance to the Cockpit and derive loading state.**

In project-cockpit.page.ts:

1. Add computed and DestroyRef to the @angular/core import.
2. Add takeUntilDestroyed from @angular/core/rxjs-interop.
3. Add finalize from rxjs.
4. Import the four policy exports named in Interfaces.
5. Add provideCockpitOperationPolicy() beside ConfirmationService in the component providers.
6. Inject the policy and DestroyRef.
7. Delete the seven boolean mutation signals: saving, transitioning, followUpSaving, discoveryFollowUpSaving, pinging, reviewSending, deleting.
8. Keep savingDiscoveryFollowUpResolutionId because it identifies the row whose button renders a loading state.

Add these exact derived signals:

~~~ts
readonly operationPolicy = inject(COCKPIT_OPERATION_POLICY);
private readonly destroyRef = inject(DestroyRef);

readonly saving = computed(
  () => this.operationPolicy.activeOperation() === 'workspace-save',
);
readonly transitioning = computed(() => {
  const operation = this.operationPolicy.activeOperation();
  return operation === 'project-archive' || operation === 'project-restore';
});
readonly followUpSaving = computed(
  () => this.operationPolicy.activeOperation() === 'customer-follow-up-save',
);
readonly discoveryFollowUpSaving = computed(
  () => this.operationPolicy.activeOperation() === 'discovery-create',
);
readonly pinging = computed(
  () => this.operationPolicy.activeOperation() === 'customer-follow-up-ping',
);
readonly reviewSending = computed(
  () => this.operationPolicy.activeOperation() === 'customer-review-email',
);
readonly deleting = computed(
  () => this.operationPolicy.activeOperation() === 'project-delete',
);
readonly discoveryFollowUpMutationInProgress = computed(() => {
  const operation = this.operationPolicy.activeOperation();
  return operation === 'discovery-create' || operation === 'discovery-resolve';
});
readonly cockpitMutationInProgress = this.operationPolicy.busy;
~~~

Delete the old discoveryFollowUpMutationInProgress() method after replacing it with the computed signal.

- [ ] **Step 3: Acquire and deterministically release every mutation.**

For each method in this table, keep all existing form and lifecycle validation before acquisition, acquire the exact identity after the input is built, return if acquisition yields null, remove every manual true/false mutation flag write, and add the two operators in this order:

~~~ts
.pipe(
  releaseCockpitOperationOnFinalize(lease),
  takeUntilDestroyed(this.destroyRef),
)
~~~

| Method | Operation identity | Extra finalization |
| --- | --- | --- |
| saveWorkspace | workspace-save | None |
| saveFollowUp | customer-follow-up-save | None |
| createDiscoveryFollowUp | discovery-create | None |
| resolveDiscoveryFollowUp | discovery-resolve | Set savingDiscoveryFollowUpResolutionId to null in finalize |
| sendFollowUpPing | customer-follow-up-ping | None |
| sendCustomerReviewEmail | customer-review-email | None |
| archiveProject | project-archive | None |
| restoreProject | project-restore | None |
| deleteProject | project-delete | None |

Use this acquisition shape in every listed method, substituting only the typed identity:

~~~ts
const lease = this.operationPolicy.tryAcquire('workspace-save');
if (!lease) {
  return;
}
~~~

The resolution request must use:

~~~ts
this.savingDiscoveryFollowUpResolutionId.set(followUpId);
this.api
  .resolveDiscoveryFollowUp(this.projectId, followUpId, input)
  .pipe(
    finalize(() => this.savingDiscoveryFollowUpResolutionId.set(null)),
    releaseCockpitOperationOnFinalize(lease),
    takeUntilDestroyed(this.destroyRef),
  )
  .subscribe({
    next: (resolved) => {
      this.view.update((current) =>
        current
          ? {
              ...current,
              discoveryFollowUps: sortDiscoveryFollowUps(
                current.discoveryFollowUps.map((candidate) =>
                  candidate.id === resolved.id ? resolved : candidate,
                ),
              ),
            }
          : current,
      );
      this.openedDiscoveryFollowUpResolutionId.set(null);
      this.resetDiscoveryFollowUpResolutionForm();
      this.feedback.set('Discovery follow-up resolved.');
      this.refreshAuditEvents();
    },
    error: (error: Error) => {
      this.actionError.set(error.message);
    },
  });
~~~

Do not acquire a lease in loadCockpit, loadAuditEvents, retryAuditEvents, previousAuditPage, nextAuditPage, requestProjectDeletion, openDiscoveryFollowUpResolution, or cancelDiscoveryFollowUpResolution.

- [ ] **Step 4: Collapse cross-mutation guards to one source.**

Make these exact behavior-preserving changes:

~~~ts
followUpControlsDisabled(): boolean {
  return this.cockpitMutationInProgress() || this.isArchived();
}

emailActionsDisabled(): boolean {
  return this.followUpControlsDisabled() || this.followUpForm.dirty;
}

discoveryFollowUpControlsDisabled(): boolean {
  return this.cockpitMutationInProgress() || this.isArchived();
}

discoveryFollowUpResolutionControlsDisabled(): boolean {
  return this.cockpitMutationInProgress() || this.isArchived();
}

discoveryFollowUpResolveControlDisabled(): boolean {
  return (
    this.cockpitMutationInProgress() ||
    this.openedDiscoveryFollowUpResolutionId() !== null ||
    this.isArchived()
  );
}
~~~

Update isDiscoveryFollowUpResolutionSaving so it requires both the row ID and the typed operation:

~~~ts
isDiscoveryFollowUpResolutionSaving(followUpId: string): boolean {
  return (
    this.operationPolicy.activeOperation() === 'discovery-resolve' &&
    this.savingDiscoveryFollowUpResolutionId() === followUpId
  );
}
~~~

In saveWorkspace, archiveProject, restoreProject, requestProjectDeletion, and deleteProject replace the repeated mutation-flag conditions with cockpitMutationInProgress(). Keep all form-validity, DRAFT, ARCHIVED, and dirty-form rules unchanged.

- [ ] **Step 5: Simplify only the repeated template guards.**

In project-cockpit.page.html make these exact replacements:

~~~html
<fieldset
  class="workspace-fields"
  [disabled]="cockpitMutationInProgress() || isArchived()"
>
~~~

Use cockpitMutationInProgress() || isArchived() for the workspace submit button. Use cockpitMutationInProgress() for restore. Use cockpitMutationInProgress() || isArchived() for archive. Use cockpitMutationInProgress() for delete. Keep the existing form helper methods for Customer follow-up and Discovery follow-up controls.

Do not rename or remove any data-testid value and do not alter markup structure or copy.

- [ ] **Step 6: Run the narrow page gates.**

~~~powershell
& $runtimeNode $cachedPnpm --filter @project-maker/web test
& $runtimeNode $cachedPnpm --filter @project-maker/web typecheck
& $runtimeNode $cachedPnpm --filter @project-maker/web build
~~~

Expected: PASS. The production build may still report the existing Cockpit style warning of approximately 175 bytes; angular.json remains byte-for-byte unchanged.

- [ ] **Step 7: Review and commit the Cockpit integration.**

~~~powershell
git diff --check
git diff -- apps/web/src/app/projects/project-cockpit.page.ts apps/web/src/app/projects/project-cockpit.page.html
git add apps/web/src/app/projects/project-cockpit.page.ts apps/web/src/app/projects/project-cockpit.page.html
git commit -m "refactor(web): coordinate cockpit mutations"
~~~

Expected: all nine mutations use typed leases and finalize; read operations do not; no business rule, request, markup structure, style, backend, contract, or dependency change.

### Task 3: Prove browser compatibility and prepare the first PR

**Files:**

- Verify only; source changes are allowed only if a gate exposes a real defect in Tasks 1 or 2.

**Interfaces:**

- Consumes: the complete operation-policy slice.
- Produces: browser, build, scope, and Git evidence suitable for a focused PR.

- [ ] **Step 1: Start one disposable PostgreSQL database for browser tests.**

~~~powershell
$policyDatabaseContainer = 'project-maker-cockpit-policy-e2e'
$policyDatabaseName = 'project_maker_cockpit_policy_e2e'
$policyDatabasePort = 55437
$priorDatabaseUrl = $env:DATABASE_URL

$dockerArguments = @(
  'run',
  '--rm',
  '--detach',
  '--name', $policyDatabaseContainer,
  '--publish', ('127.0.0.1:' + $policyDatabasePort + ':5432'),
  '--env', 'POSTGRES_USER=project_maker',
  '--env', 'POSTGRES_PASSWORD=project_maker',
  '--env', ('POSTGRES_DB=' + $policyDatabaseName),
  'postgres:17-alpine'
)
docker @dockerArguments

$env:DATABASE_URL =
  'postgresql://project_maker:project_maker@127.0.0.1:' +
  $policyDatabasePort +
  '/' +
  $policyDatabaseName
& $runtimeNode $cachedPnpm --filter @project-maker/api migration:run
~~~

Expected: only the explicitly named loopback-only disposable database starts, and its name contains e2e.

- [ ] **Step 2: Run focused and repository gates.**

~~~powershell
& $runtimeNode $cachedPnpm --filter @project-maker/web exec playwright test e2e/discovery-follow-ups.spec.ts e2e/project-delete.spec.ts
& $runtimeNode $cachedPnpm verify
~~~

Expected: PASS. The five Discovery and four deletion workflows prove lifecycle, cancellation, conflict, reload, and resolution behavior. Build warning behavior is unchanged from main.

- [ ] **Step 3: Stop only the named disposable database and restore the caller environment.**

~~~powershell
$resolvedContainer = docker inspect --format '{{.Name}}' $policyDatabaseContainer
if ($resolvedContainer -ne '/' + $policyDatabaseContainer) {
  throw "Unexpected database container: $resolvedContainer"
}
docker stop $policyDatabaseContainer

if ($null -eq $priorDatabaseUrl) {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
} else {
  $env:DATABASE_URL = $priorDatabaseUrl
}
Remove-Variable policyDatabaseContainer, policyDatabaseName, policyDatabasePort, priorDatabaseUrl
~~~

Expected: only project-maker-cockpit-policy-e2e is stopped and auto-removed; DATABASE_URL is restored exactly.

- [ ] **Step 4: Run final scope and secrecy review.**

~~~powershell
git diff main...HEAD --check
git diff main...HEAD --stat
git diff main...HEAD -- apps/web/src/app/projects
git status --short

$changedPaths = @(git diff --name-only main...HEAD)
$expectedPaths = @(
  'apps/web/src/app/projects/cockpit-operation-policy.spec.ts',
  'apps/web/src/app/projects/cockpit-operation-policy.ts',
  'apps/web/src/app/projects/project-cockpit.page.html',
  'apps/web/src/app/projects/project-cockpit.page.ts'
)
Compare-Object $expectedPaths $changedPaths

rg -n --hidden --glob '!node_modules/**' --glob '!dist/**' --glob '!dist-test/**' '(postgresql://[^[:space:]]+:[^[:space:]]+@|POSTGRES_PASSWORD=|BEGIN [A-Za-z0-9_-]{20,})' apps/web/src
& C:\Users\littl\.agents\tools\work-state-preflight.ps1 -RepositoryPath (Get-Location).Path -OutputFormat Markdown
~~~

Expected: Compare-Object prints nothing; no secret match; worktree is clean after the two commits; branch is dev-cockpit-operation-policy at its reviewed HEAD.

- [ ] **Step 5: Publish through the approved finishing workflow.**

Use superpowers:requesting-code-review and superpowers:finishing-a-development-branch. Re-run WORK_STATE before push, PR creation, and merge. Create a focused PR to main, merge only with green checks, run WORK_STATE after merge, and do not reuse this branch for the Discovery slice.

## Acceptance-Criteria Traceability

| Criterion | Implementation and proof |
| --- | --- |
| One active mutation globally | Task 1 acquisition test; Task 2 all nine mutations |
| Typed operation identity is visible | Task 1 activeOperation assertions; Task 2 loading derivations |
| Complete, error, and unsubscribe release | Task 1 RxJS tests; Task 2 finalize plus takeUntilDestroyed |
| Double release fails explicitly | Task 1 exact error assertion |
| Server remains business authority | No backend/contract change; Task 3 stale-delete 409 workflow |
| Reads remain independent | Task 2 exclusion list and unchanged audit loading |
| Existing workflows remain intact | Task 3 five Discovery plus four deletion browser tests |
| No budget gaming | angular.json absent from diff; style warning unchanged in this slice |

## Plan Self-Review

**Spec coverage:** The plan covers client-only authority, cockpit-local scope, typed lease identity, global single-flight behavior, read exclusions, deterministic cleanup, current UX compatibility, two-level automated evidence, and the first independent PR.

**Placeholder scan:** Every task contains exact files, signatures, commands,
expected failures, passing outcomes, and review gates; no deferred marker or
generic implementation instruction remains.

**Type consistency:** All nine CockpitOperationId values match the Task 2 method mapping. COCKPIT_OPERATION_POLICY, provideCockpitOperationPolicy, createCockpitOperationPolicy, and releaseCockpitOperationOnFinalize use the same names in tests, provider wiring, and request pipelines.

**Scope boundary:** This slice deliberately leaves Discovery state, markup, SCSS, and its current ProjectApiService methods in place. The second plan owns that extraction after this PR reaches main.

## Execution Handoff

Plan complete. Choose one execution approach:

1. **Subagent-Driven (recommended)** — use superpowers:subagent-driven-development with a fresh worker and two-stage review per task.
2. **Inline Execution** — use superpowers:executing-plans and execute the tasks in verified batches.
