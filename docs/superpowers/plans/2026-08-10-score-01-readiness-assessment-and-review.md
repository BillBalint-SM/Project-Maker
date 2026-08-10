# SCORE-01.1 Readiness Assessment and Review Implementation Plan

> **Delivery status:** Delivered on `main` in `b922258` (`feat(score-01): deliver readiness assessment and review`). The unchecked task list below is preserved as the approved pre-execution plan; current delivery status is maintained in [`docs/roadmap.md`](../../roadmap.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox items such as - [ ] for tracking.

**Goal:** Deliver the first trustworthy SCORE-01 vertical slice: employees can
assess an INITIAL_INTAKE question as partial or not relevant, complete a round
honestly, review an explainable readiness result in the Cockpit, and navigate
straight to the work that needs attention.

**Architecture:** Preserve the Cockpit as a thin orchestration route. Persist
only the two assessment states that cannot be inferred from answers in a new
round-question override relation. Keep the readiness API as a deep Nest module
with a pure calculator, and the Cockpit view as a standalone deep Angular
module with its own API adapter, state, markup, styles, and navigation. The
route coordinates only its project ID and an explicit refresh counter.

**Tech Stack:** Angular 22.1 standalone signals, PrimeNG 22.0, RxJS 7.8,
NestJS 11.1, TypeORM 1.1, PostgreSQL 18, Playwright 1.62, TypeScript 6,
Node 26, and pnpm 11.20.

## Global Constraints

- Implement only the approved [SCORE-01.1 design](../specs/2026-08-10-score-01-readiness-assessment-design.md).
- The current worktree contains the approved, untracked design specification.
  This plan is also documentation-only work. Do not discard, stage, commit,
  push, merge, or rebase either planning document without a new explicit user
  instruction. Before code work, put the approved documentation on a known
  clean baseline through a separately approved documentation action, then
  create a fresh short-lived branch named dev-score-01-readiness.
- Refresh WORK_STATE before every branch, commit, push, pull-request, merge,
  rebase, or implementation-resumption decision. Stop if repository, branch,
  HEAD, worktree, upstream, or PR evidence differs from the intended state.
- Do not alter the Angular, PrimeNG, Nest, TypeScript, pnpm, Node, database,
  global style, Docker, authentication, authorization, customer-email,
  lifecycle, Markdown-output, Decision Score, source-linkage, or dependency
  boundaries in this slice.
- The immutable general v1 playbook remains the single source for status
  vocabulary, score values, weights, thresholds, resolved follow-up statuses,
  and the new input binding. Application code, migrations, and tests must not
  introduce competing score-policy constants.
- Store only Részben megvan and Nem releváns overrides. Nincs meg and Kész
  remain effective, derived states. Never backfill inferred status rows.
- A partial override requires a valid answer. A not-relevant override requires
  a trimmed, nonblank rationale of at most 10,000 characters. A reset removes
  only the override. A completed round remains immutable.
- The PostgreSQL boundary is authoritative: it must prevent cross-round
  references, invalid override status/rationale combinations, partial state
  without a valid answer, answer deletion that would orphan partial state, and
  every override mutation for completed rounds.
- The only scoring source is the latest open INITIAL_INTAKE round, otherwise
  the latest completed INITIAL_INTAKE round. Only the exact general-001 through
  general-030 snapshot-key set is scoreable. No source and unsupported source
  are explicit unavailable states, never a fabricated zero score.
- Audit payloads and readiness gaps must stay redacted. They may contain IDs,
  canonical status names, fixed Hungarian labels, and navigation metadata; they
  must not expose answers, rationales, follow-up question text, owner, date,
  decision, next step, or other entered business content.
- New employee-facing copy, accessible names, validation feedback, and retry
  feedback are Hungarian. Engineering documentation remains English.
- Keep new styles inside the relevant deep module. Do not add Cockpit SCSS for
  the readiness view; this is also the concrete control for the previous
  Cockpit SCSS-budget warning.
- Use stable data-testid selectors. Prefer real PostgreSQL and real browser
  workflows; existing focused component tests may extend their current local
  test harness only where they are the narrowest way to prove save-state races.
- Run migrations and browser/API integration tests only against a disposable
  loopback PostgreSQL database whose name contains score01, e2e, or test. Do
  not print a connection URL, password, token, or user-entered content.
- Context7 was used in design to validate the installed Angular standalone
  input/output pattern. No additional version-sensitive external API decision
  is needed for this plan; execution must still validate installed APIs against
  repository code before using them.

---

## File Map

| File | Change | Responsibility |
| --- | --- | --- |
| packages/contracts/playbooks/general.v1.json | Modify | Add canonical readiness input bindings without changing existing policy values. |
| packages/contracts/src/index.ts | Modify | Export the readiness read-model contract. |
| packages/contracts/src/interviews.ts | Modify | Expose effective assessment fields and the narrow override command input. |
| packages/contracts/src/readiness.ts | Create | Discriminated readiness result, factors, gaps, and navigation target contract. |
| packages/contracts/test/general.v1.test.mjs | Modify | Prove exact input binding and validation rejection. |
| packages/contracts/test/fixtures/general.v1.sha256 | Modify | Re-pin the intentionally changed immutable-playbook hash. |
| apps/api/src/migrations/0009-round-question-assessment-overrides.ts | Create | Override relation, constraints, triggers, completion-gate replacement, and non-destructive down migration. |
| apps/api/src/database/migration-data-source.ts | Modify | Register migration 0009 after 0008. |
| apps/api/src/interviews/round-question-assessment-override.entity.ts | Create | TypeORM mapping for durable override state. |
| apps/api/src/interviews/dto/set-round-question-assessment.dto.ts | Create | Exact PUT body validation. |
| apps/api/src/interviews/interviews.module.ts | Modify | Register the override entity. |
| apps/api/src/interviews/interviews.controller.ts | Modify | Add narrow PUT and DELETE assessment commands. |
| apps/api/src/interviews/interviews.service.ts | Modify | Effective status projection, transaction rules, completion gate, safe audit, and answer-clear interaction. |
| apps/api/src/readiness/readiness.module.ts | Create | Readiness deep-module boundary. |
| apps/api/src/readiness/readiness.controller.ts | Create | GET project readiness route. |
| apps/api/src/readiness/readiness.service.ts | Create | Source selection, TypeORM reads, canonical-schema guard, and calculator adaptation. |
| apps/api/src/readiness/readiness-calculator.ts | Create | Pure policy-driven factors, labels, gaps, and deterministic ordering. |
| apps/api/src/readiness/readiness.types.ts | Create | Internal normalized calculator input and source-order metadata. |
| apps/api/src/app.module.ts | Modify | Import ReadinessModule only. |
| apps/api/test/question-rounds.e2e-spec.ts | Modify | Real API assessment, reload, completion, unavailable, and canonical-readiness proofs. |
| apps/api/test/round-integrity.e2e-spec.ts | Modify | Direct PostgreSQL migration, trigger, immutability, and rollback proofs. |
| apps/api/test/readiness-calculator.spec.ts | Create | Pure calculator boundary, weight, threshold, and gap-order proof. |
| apps/web/src/app/interviews/interview-api.service.ts | Modify | Typed PUT and DELETE assessment adapters and safe error mapping. |
| apps/web/src/app/interviews/interview.page.ts | Modify | Local assessment state, retry, returned-snapshot replacement, and completion blocking. |
| apps/web/src/app/interviews/interview.page.html | Modify | Status controls, rationale workflow, stable anchors, and stable test IDs. |
| apps/web/src/app/interviews/interview.page.scss | Modify | Assessment controls local to the interview route. |
| apps/web/src/app/interviews/interview.page.spec.ts | Modify | Assessment UI/save-state and completion-blocking proof. |
| apps/web/src/app/projects/readiness-review/readiness-review-api.service.ts | Create | Typed readiness GET adapter local to the deep module. |
| apps/web/src/app/projects/readiness-review/readiness-review.component.ts | Create | Isolated refresh, loading, unavailable, error, retry, and gap-action state. |
| apps/web/src/app/projects/readiness-review/readiness-review.component.html | Create | Readiness summary, factors, ordered gaps, and Hungarian guidance. |
| apps/web/src/app/projects/readiness-review/readiness-review.component.scss | Create | Responsive readiness layout without Cockpit stylesheet growth. |
| apps/web/src/app/projects/project-cockpit.page.ts | Modify | Import the module, hold refresh counter, and relay workspace/discovery commits. |
| apps/web/src/app/projects/project-cockpit.page.html | Modify | Render the module and expose the workspace anchor. |
| apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html | Modify | Add the stable follow-up navigation anchor only. |
| apps/web/e2e/readiness-review.spec.ts | Create | Real browser assessment, Cockpit refresh, unavailable state, and gap-navigation flows. |
| docs/assets/user-guide/07-readiness-review.png | Create after verification | Sanitized, inspected employee-facing readiness screenshot. |
| docs/roadmap.md | Modify after verification | Mark only SCORE-01.1 as delivered and retain SCORE-01.2. |
| docs/product-domain.md | Modify after verification | Describe assessment semantics and supported-score boundary. |
| docs/user-guide.md | Modify after verification | Teach the daily readiness-review and remediation workflow. |
| docs/operations-handoff.md | Modify after verification | Record migration 0009, endpoints, redaction, and rollback facts. |
| .planning/STATE.md | Modify after verification | Synchronize verified delivery state without claiming Decision Score delivery. |

## Produced Interfaces

~~~ts
export interface SetRoundQuestionAssessmentInput {
  readonly status: string;
  readonly rationale: string | null;
}

export interface RoundQuestionSnapshot {
  // Existing immutable snapshot fields remain unchanged.
  readonly answer: AnswerValue | null;
  readonly answeredAt: string | null;
  readonly checklistStatus: string;
  readonly assessmentRationale: string | null;
}
~~~

~~~ts
export interface AvailableProjectReadiness {
  readonly available: true;
  readonly projectId: string;
  readonly sourceRoundId: string;
  readonly sourceRoundStatus: string;
  readonly completionPercentage: number;
  readonly completionLabel: string;
  readonly readinessPercentage: number;
  readonly readinessBand: string;
  readonly factors: readonly ReadinessFactor[];
  readonly gaps: readonly ReadinessGap[];
}

export interface UnavailableProjectReadiness {
  readonly available: false;
  readonly projectId: string;
  readonly reason: 'NO_INITIAL_INTAKE' | 'UNSUPPORTED_SCHEMA';
}

export type ProjectReadiness =
  | AvailableProjectReadiness
  | UnavailableProjectReadiness;

export type ReadinessGapTarget = 'overview' | 'checklist' | 'follow-ups';

export interface ReadinessGap {
  readonly id: string;
  readonly severity: string;
  readonly category: string;
  readonly message: string;
  readonly nextStep: string;
  readonly target: ReadinessGapTarget;
  readonly snapshotId: string | null;
  readonly followUpId: string | null;
}
~~~

~~~text
PUT    /projects/:projectId/rounds/:roundId/answers/:snapshotId/assessment
DELETE /projects/:projectId/rounds/:roundId/answers/:snapshotId/assessment
GET    /projects/:projectId/readiness
~~~

~~~ts
readonly projectId = input.required<string>();
readonly refreshKey = input.required<number>();
~~~

## Execution Bootstrap

Run this before implementation and again after every Git or external-state
transition. The currently dirty planning documents are expected only until the
user separately authorizes their documentation handoff.

~~~powershell
& C:\Users\littl\.agents\tools\work-state-preflight.ps1 -RepositoryPath (Get-Location).Path -OutputFormat Markdown
git status --short
git branch --show-current
git rev-parse HEAD
git worktree list --porcelain
git remote -v

$score01Node = 'C:\Program Files\nodejs\node.exe'
$score01Pnpm = 'C:\Users\littl\AppData\Local\npm-cache\_npx\90ee57dca4845993\node_modules\pnpm\bin\pnpm.cjs'
if (-not (Test-Path -LiteralPath $score01Node -PathType Leaf)) {
  throw "Compatible Node executable is missing: $score01Node"
}
if (-not (Test-Path -LiteralPath $score01Pnpm -PathType Leaf)) {
  throw "Compatible pnpm entrypoint is missing: $score01Pnpm"
}
& $score01Node --version
& $score01Node $score01Pnpm --version
~~~

Expected: repository identity is known; any planning-only dirty paths are
explained; Node and pnpm match the workspace requirements; no implementation
branch, stage, commit, or external write is created by this bootstrap.

After the user has explicitly approved the planning-document handoff and a
fresh preflight confirms clean main, create the bounded branch:

~~~powershell
git switch main
git switch -c dev-score-01-readiness
~~~

For each API/browser task, set DATABASE_URL only to a dedicated loopback
container/database. Validate its database name before a migration or test,
keep the generated password in process memory, and remove exactly that
container in the task cleanup. Do not use a shared or production database.

### Task 1: Extend the immutable shared contract before application code

**Files:**

- Modify: packages/contracts/playbooks/general.v1.json
- Modify: packages/contracts/src/index.ts
- Modify: packages/contracts/src/interviews.ts
- Create: packages/contracts/src/readiness.ts
- Modify: packages/contracts/test/general.v1.test.mjs
- Modify: packages/contracts/test/fixtures/general.v1.sha256

**Interfaces:**

- Consumes: the existing general v1 status and scoring policy.
- Produces: exact readiness input binding, extended snapshot shape, assessment
  command shape, and public discriminated readiness result.
- Preserves: every existing status, value, weight, threshold, and the
  immutable-playbook validation policy.

- [ ] **Step 1: Add failing contract-policy assertions.**

  Extend the general-v1 test to require the exact input binding:

  ~~~js
  assert.deepEqual(playbook.scoring.readiness.inputBindings, {
    baseInfoProjectFields: [
      'name',
      'customerContactName',
      'customerContactEmail'
    ],
    businessChecklistItemIds: [1, 2],
    ownershipProjectFields: ['ballOwner'],
    ownershipChecklistItemIds: [3]
  });
  ~~~

  Clone the built playbook, alter one binding item, and assert that
  validateGeneralPlaybook rejects it through the existing canonical-policy
  validation path.

- [ ] **Step 2: Run the narrow contracts test and capture the expected failure.**

  ~~~powershell
  & $score01Node $score01Pnpm --filter @project-maker/contracts test
  ~~~

  Expected: the test fails because general.v1.json and its typed validation do
  not yet contain readiness.inputBindings.

- [ ] **Step 3: Add the policy field and public TypeScript contracts.**

  Add the exact JSON binding after the existing readiness-policy fields. Extend
  GeneralPlaybookScoring and assertScoring so the binding is typed, structurally
  validated, and then compared with the canonical imported JSON using the
  existing assertCanonicalPolicy mechanism.

  Add the two assessment fields to RoundQuestionSnapshot and export
  SetRoundQuestionAssessmentInput. Keep status as a policy-vocabulary string:
  runtime validation belongs to the API's loaded immutable playbook rather than
  to a second hard-coded string list.

  Create readiness.ts with AvailableProjectReadiness,
  UnavailableProjectReadiness, ProjectReadiness, ReadinessFactor,
  ReadinessGap, and ReadinessGapTarget. Factors carry a stable factor ID,
  policy weight, rounded percentage, Hungarian label, and Hungarian help text.
  Export this file from index.ts.

- [ ] **Step 4: Re-pin the deliberate playbook integrity change.**

  Recalculate the fixture exactly as the test does: UTF-8 source with CRLF
  normalized to LF, then SHA-256. Replace only
  test/fixtures/general.v1.sha256 with the resulting lowercase hash. Do not
  weaken, remove, or bypass the integrity test.

- [ ] **Step 5: Prove contract behavior and type propagation.**

  ~~~powershell
  & $score01Node $score01Pnpm --filter @project-maker/contracts test
  & $score01Node $score01Pnpm --filter @project-maker/contracts build
  & $score01Node $score01Pnpm --filter @project-maker/api typecheck
  & $score01Node $score01Pnpm --filter @project-maker/web typecheck
  ~~~

  Expected: PASS. A binding typo is rejected, the hash protects the newly
  approved canonical content, and both applications can consume the expanded
  contracts.

- [ ] **Step 6: Review Task 1 before proceeding.**

  ~~~powershell
  git diff --check
  git diff -- packages/contracts
  ~~~

  Expected: only the approved policy binding and public contract surface
  changed. Do not stage or commit without contemporary user authorization.

### Task 2: Add durable assessment overrides and PostgreSQL invariants

**Files:**

- Create: apps/api/src/migrations/0009-round-question-assessment-overrides.ts
- Modify: apps/api/src/database/migration-data-source.ts
- Create: apps/api/src/interviews/round-question-assessment-override.entity.ts
- Modify: apps/api/src/interviews/interviews.module.ts
- Modify: apps/api/test/round-integrity.e2e-spec.ts

**Interfaces:**

- Consumes: round_question_snapshots, round_answers, interview_rounds, and
  their current integrity triggers.
- Produces: a single override per round/snapshot and an entity that can be
  loaded by Interview and Readiness modules.
- Preserves: prior round/answer immutability and all pre-0009 completion rules
  except the explicitly approved justified-not-relevant exemption.

- [ ] **Step 1: Write direct-database failing proofs first.**

  Extend round-integrity.e2e-spec.ts to load migration 0009 after the existing
  round migrations and prove, using direct SQL against a real disposable
  PostgreSQL database:

  1. the composite foreign key rejects an override using a snapshot from a
     different round;
  2. the unique pair rejects a second override for the same round/snapshot;
  3. the status/rationale check rejects any status other than the two canonical
     override states, blank not-relevant rationale, and a rationale on partial;
  4. partial state is rejected without a valid answer;
  5. direct deletion of an answer is rejected while partial state exists;
  6. direct insert, update, and delete of overrides are rejected after round
     completion;
  7. migration down refuses when override rows exist, leaves the row intact,
     and succeeds only after the row is explicitly removed.

  Assert error categories/messages, preserved rows, and migration table state;
  do not inspect or print a connection URL.

- [ ] **Step 2: Compile and run the focused integrity proof to confirm red.**

  ~~~powershell
  & $score01Node $score01Pnpm --filter @project-maker/api exec tsc --project ./test/tsconfig.json
  & $score01Node --test apps/api/dist-test/test/round-integrity.e2e-spec.js
  ~~~

  Expected: FAIL because migration 0009 and its relation/trigger behavior do
  not exist.

- [ ] **Step 3: Implement migration 0009 with reversible structure and guarded rollback.**

  Create class
  RoundQuestionAssessmentOverrides0009RoundQuestionAssessmentOverrides1786608000000
  and register it after migration 0008.

  Its up path must:

  - create round_question_assessment_overrides with UUID id, round_id,
    snapshot_id, varchar status, nullable rationale, created_at, and updated_at;
  - constrain status to the two canonical persisted override values and enforce
    a trimmed nonblank rationale only for Nem releváns;
  - add unique round_id/snapshot_id and composite foreign key to
    round_question_snapshots(round_id, id);
  - add the timestamp trigger and an override-protection trigger that preserves
    identity, rejects completed-round mutation, and validates the partial-answer
    precondition with the existing is_valid_round_answer function;
  - replace the round-answer protection trigger function so an answer delete
    cannot leave a partial override without evidence;
  - replace the round-completion trigger function so each required snapshot
    needs either a valid answer with no Részben megvan override or a justified
    persisted Nem releváns override; a valid-but-partial answer must still
    fail completion.

  The down path must first raise a specific actionable exception if any override
  row remains. Only then drop the new trigger/function/table and restore the
  prior 0002 trigger-function behavior verbatim. It must never delete override
  decisions as rollback cleanup.

- [ ] **Step 4: Map the table through a focused entity.**

  Add RoundQuestionAssessmentOverrideEntity with explicit primary ID, roundId,
  snapshotId, status, rationale, create timestamp, and update timestamp column
  mappings. Register it in InterviewsModule. Do not add a broad relation graph
  or cascade behavior.

- [ ] **Step 5: Run migration and integrity proof through up/down/up.**

  On the isolated database, run current migrations, exercise the direct test,
  then verify the migration can revert/reapply only when the test-created
  override rows have been intentionally removed. Run:

  ~~~powershell
  & $score01Node $score01Pnpm --filter @project-maker/api migration:show
  & $score01Node --test apps/api/dist-test/test/round-integrity.e2e-spec.js
  & $score01Node $score01Pnpm --filter @project-maker/api typecheck
  ~~~

  Expected: PASS. The migration is registered exactly once and direct SQL
  cannot bypass the assessment rules.

- [ ] **Step 6: Review Task 2 and remove only its isolated database container.**

  ~~~powershell
  git diff --check
  git diff -- apps/api/src/migrations apps/api/src/database/migration-data-source.ts apps/api/src/interviews apps/api/test/round-integrity.e2e-spec.ts
  ~~~

  Expected: no unrelated trigger changes, no data deletion path, and no Git
  mutation.

### Task 3: Expose assessment commands and effective snapshot status

**Files:**

- Create: apps/api/src/interviews/dto/set-round-question-assessment.dto.ts
- Modify: apps/api/src/interviews/interviews.controller.ts
- Modify: apps/api/src/interviews/interviews.service.ts
- Modify: apps/api/test/question-rounds.e2e-spec.ts

**Interfaces:**

- Consumes: the override entity, transaction/locking helpers, current answer
  validation, general v1 playbook runtime, and global whitelist ValidationPipe.
- Produces: narrow PUT/DELETE commands and a RoundQuestionSnapshot whose status
  is deterministic on every create, active-round load, command response, and
  completed-round response.
- Preserves: answer autosave route behavior, existing answer validation, and
  completed-round immutability.

- [ ] **Step 1: Add failing API behavior tests.**

  Update question-rounds.e2e-spec.ts to migrate 0009 and cover these real HTTP
  cases:

  - a missing answer returns Nincs meg and null rationale; a valid saved answer
    returns Kész without a stored override;
  - PUT partial fails without a valid answer, succeeds with one, returns
    Részben megvan/null rationale, survives active-round reload, and repeated
    identical PUT preserves updatedAt and produces no duplicate audit event;
  - PUT not relevant rejects blank/overlength rationale, trims a valid rationale,
    preserves any answer, survives reload, and reset returns the inferred state;
  - DELETE of an absent override is a no-op with no audit event; DELETE of a
    present override returns the reset snapshot and adds one redacted audit;
  - clearing an answer with partial state removes the override and answer inside
    the same transaction; clearing an answer with not-relevant state preserves
    the rationale override;
  - a required partial snapshot prevents completion; a required justified
    not-relevant snapshot permits it;
  - completed rounds reject PUT and DELETE with 409 and leave assessment/audit
    rows unchanged;
  - unknown body properties are rejected by the global whitelist;
  - all assessment audit payloads contain only roundId, snapshotId, and, for a
    saved override, canonical status. Assert that response/audit JSON contains
    neither the answer nor the rationale text.

- [ ] **Step 2: Run the API proof and record the intended failure.**

  ~~~powershell
  & $score01Node $score01Pnpm --filter @project-maker/api exec tsc --project ./test/tsconfig.json
  & $score01Node --test apps/api/dist-test/test/question-rounds.e2e-spec.js
  ~~~

  Expected: FAIL because the routes, DTO, projection fields, and transaction
  behavior are not yet present.

- [ ] **Step 3: Add the exact DTO and controller commands.**

  The PUT body exposes only status and rationale. Use class-validator for
  string/null/maximum-length shape and enforce allowed values and state
  preconditions against the loaded canonical playbook inside the transaction.
  Add only these controller methods:

  ~~~ts
  @Put(':roundId/answers/:snapshotId/assessment')
  @HttpCode(HttpStatus.OK)
  setAssessment(/* UUID params and exact DTO */): Promise<RoundQuestionSnapshot>

  @Delete(':roundId/answers/:snapshotId/assessment')
  @HttpCode(HttpStatus.OK)
  resetAssessment(/* UUID params */): Promise<RoundQuestionSnapshot>
  ~~~

  Do not add a generic status PATCH endpoint or a client-controlled
  inferred-state command.

- [ ] **Step 4: Implement the single transactional domain path.**

  In InterviewsService, lock the round, reject completed state, load the
  snapshot and existing answer/override, then:

  - validate partial against the same answer-validity rule used for completion;
  - normalize only the not-relevant rationale and reject blank/too-long values;
  - create/update an override only when its persisted value actually differs;
  - make equal PUT and absent DELETE true no-ops with no timestamp/audit change;
  - remove a partial override before deleting its answer in the existing
    updateAnswer null-value transaction;
  - update the service completion gate to load overrides and require either a
    valid answer with no partial override or a justified not-relevant override;
    a partial required snapshot must fail even though it has valid evidence;
  - load overrides whenever an InterviewRound is projected;
  - derive the effective status in one shared mapper: persisted override first,
    otherwise valid answer is Kész, otherwise Nincs meg.

  Add redacted audit helpers with event types
  ROUND_QUESTION_ASSESSMENT_SAVED and ROUND_QUESTION_ASSESSMENT_RESET. Keep
  payload shape explicit and do not reuse a broad audit serializer.

- [ ] **Step 5: Run the focused API suite and inspect the returned contract.**

  ~~~powershell
  & $score01Node --test apps/api/dist-test/test/question-rounds.e2e-spec.js
  & $score01Node $score01Pnpm --filter @project-maker/api typecheck
  ~~~

  Expected: PASS. Each response path returns consistent inferred/persisted
  status; API and database both enforce completion and immutability rules.

- [ ] **Step 6: Review the command seam.**

  ~~~powershell
  git diff --check
  git diff -- apps/api/src/interviews apps/api/test/question-rounds.e2e-spec.ts
  ~~~

  Expected: no answer payload rewrite, no leaked rationale/answer in an audit
  payload, and no lifecycle/customer-email scope expansion.

### Task 4: Build the Readiness deep API module and pure calculator

**Files:**

- Create: apps/api/src/readiness/readiness.module.ts
- Create: apps/api/src/readiness/readiness.controller.ts
- Create: apps/api/src/readiness/readiness.service.ts
- Create: apps/api/src/readiness/readiness-calculator.ts
- Create: apps/api/src/readiness/readiness.types.ts
- Modify: apps/api/src/app.module.ts
- Create: apps/api/test/readiness-calculator.spec.ts
- Modify: apps/api/test/question-rounds.e2e-spec.ts

**Interfaces:**

- Consumes: project basics, selected round snapshots/answers/overrides,
  discovery follow-ups, and the immutable general v1 policy.
- Produces: GET /projects/:projectId/readiness and an entirely derived
  ProjectReadiness response.
- Preserves: existing Cockpit aggregate, interview routes, discovery APIs, and
  absence of persisted derived score state.

- [ ] **Step 1: Write pure calculator tests first.**

  Create readiness-calculator.spec.ts with normalized source fixtures and
  policy-derived expectations. Prove:

  - effective checklist values include 0, 0.5, and 1 and exclude not relevant;
  - empty relevant denominator yields zero completion, not 100;
  - baseInfo, business, ownership, checklist, and follow-up factors use the
    input binding and policy weights rather than duplicated numeric constants;
  - zero follow-ups give full resolution; unresolved canonical statuses lower
    it; resolved statuses restore it;
  - readiness labels change exactly at the policy threshold boundaries;
  - completion labels are zero, in-progress, and complete as designed;
  - gaps use the required severity/target rule, never emit fixture answer or
    rationale content, and sort by severity then checklist/follow-up source
    order then stable ID.

- [ ] **Step 2: Add failing HTTP readiness tests.**

  In question-rounds.e2e-spec.ts, create real project/round fixtures to prove:

  - a project with no INITIAL_INTAKE returns available false with
    NO_INITIAL_INTAKE;
  - a subset/custom-key source returns available false with
    UNSUPPORTED_SCHEMA;
  - a full exact canonical general-001 through general-030 source returns
    available true with source metadata, policy-weighted factors, completion,
    readiness band, and redacted deterministic gaps;
  - latest open INITIAL_INTAKE wins over a later/older completed candidate
    according to the approved source-selection rule;
  - a missing ball owner, partial/missing required snapshot, not-relevant
    snapshot, unresolved/blocked discovery follow-up, and resolved follow-up
    each affect only the approved factor/gap behavior;
  - a missing project returns the existing clear 404 behavior.

- [ ] **Step 3: Run both tests to demonstrate they are red.**

  ~~~powershell
  & $score01Node $score01Pnpm --filter @project-maker/api exec tsc --project ./test/tsconfig.json
  & $score01Node --test apps/api/dist-test/test/readiness-calculator.spec.js
  & $score01Node --test apps/api/dist-test/test/question-rounds.e2e-spec.js
  ~~~

  Expected: FAIL because the module, pure calculator, and GET route do not yet
  exist.

- [ ] **Step 4: Implement the deep module without expanding ProjectsModule.**

  Create ReadinessModule with only the entities it reads and a controller:

  ~~~ts
  @Controller('projects')
  export class ReadinessController {
    @Get(':projectId/readiness')
    getProjectReadiness(
      @Param('projectId', new ParseUUIDPipe()) projectId: string,
    ): Promise<ProjectReadiness> {
      return this.readinessService.getProjectReadiness(projectId);
    }
  }
  ~~~

  ReadinessService must:

  1. verify the project exists;
  2. select the newest open INITIAL_INTAKE, otherwise newest completed one,
     with createdAt/id ordering explicit;
  3. return NO_INITIAL_INTAKE if none exists;
  4. load snapshots, answers, overrides, and project discovery follow-ups;
  5. reject a source unless its stable-key set is exactly the 30 canonical
     general keys;
  6. load general v1 through the existing runtime loader, normalize only data
     needed by the calculator, and return its result.

  Keep TypeORM retrieval and the pure function boundary inside this module.
  ProjectCockpitPage, ProjectsService, and the browser must never coordinate
  score inputs.

- [ ] **Step 5: Implement a pure, policy-driven calculator.**

  Export one single-purpose function:

  ~~~ts
  export function calculateProjectReadiness(
    input: ReadinessCalculatorInput,
  ): AvailableProjectReadiness
  ~~~

  It derives current effective status from normalized persisted state, derives
  every percentage on read, reads values/weights/thresholds/resolved statuses
  from the loaded policy, and emits only fixed text plus IDs/navigation data.
  Keep gap ordering comparator local and deterministic. Do not persist score,
  completion, factor, or gap results.

- [ ] **Step 6: Prove calculator and real API behavior.**

  ~~~powershell
  & $score01Node --test apps/api/dist-test/test/readiness-calculator.spec.js
  & $score01Node --test apps/api/dist-test/test/question-rounds.e2e-spec.js
  & $score01Node $score01Pnpm --filter @project-maker/api typecheck
  & $score01Node $score01Pnpm --filter @project-maker/api build
  ~~~

  Expected: PASS. The result is explainable, policy-derived, unavailable when
  unsupported, and contains no entered business text.

- [ ] **Step 7: Review the deep-module boundary.**

  ~~~powershell
  git diff --check
  git diff -- apps/api/src/readiness apps/api/src/app.module.ts apps/api/test/readiness-calculator.spec.ts apps/api/test/question-rounds.e2e-spec.ts
  ~~~

  Expected: all readiness-specific state, calculations, and query coordination
  reside under src/readiness; no controller/service accretion in ProjectsModule.

### Task 5: Add assessment controls to the existing interview workflow

**Files:**

- Modify: apps/web/src/app/interviews/interview-api.service.ts
- Modify: apps/web/src/app/interviews/interview.page.ts
- Modify: apps/web/src/app/interviews/interview.page.html
- Modify: apps/web/src/app/interviews/interview.page.scss
- Modify: apps/web/src/app/interviews/interview.page.spec.ts

**Interfaces:**

- Consumes: the extended RoundQuestionSnapshot and the narrow assessment API.
- Produces: a local per-question assessment draft/save/retry state adjacent to
  the existing answer state and a stable question fragment anchor.
- Preserves: answer autosave timing, answer retry behavior, schema publishing,
  and existing completion checks.

- [ ] **Step 1: Extend fixtures and write failing UI-state tests.**

  Add checklistStatus and assessmentRationale to every existing test snapshot
  fixture, then add tests that prove:

  - inferred Nincs meg and Kész render as status tags without an override;
  - partial cannot be saved without a persisted valid answer;
  - not-relevant reveals a labelled rationale field and retains the typed
    rationale after a failed save so retry is possible;
  - a returned snapshot replaces both answer and assessment view state;
  - reset uses DELETE and returns to automatic inferred state;
  - a pending assessment request blocks round completion with clear Hungarian
    guidance, as do failed assessment requests until retry succeeds;
  - completed rounds disable every assessment control.

- [ ] **Step 2: Run the focused Angular test and confirm it fails.**

  ~~~powershell
  & $score01Node $score01Pnpm --filter @project-maker/web exec ng test --watch=false --include src/app/interviews/interview.page.spec.ts
  ~~~

  Expected: FAIL because current page state and the API test double do not
  recognize assessment commands or projection fields.

- [ ] **Step 3: Add only the two typed browser API adapters.**

  Add setAssessment(projectId, roundId, snapshotId, input) using PUT and
  resetAssessment(projectId, roundId, snapshotId) using DELETE. Reuse the
  existing safe API-error mapping and typed Observable convention. Do not add a
  generic HTTP helper or client-side policy copy.

- [ ] **Step 4: Add local assessment state alongside answer state.**

  In InterviewPage, keep a per-snapshot assessment draft/baseline/pending/error
  structure separate from answer autosave timers. Its state machine has only:
  automatic/reset, partial, and not relevant. The effective status remains
  server-projected; the client never infers completion from a local draft.

  Add a dedicated pending/error check to the existing completion gate. Ensure a
  server result from answer clear that removed partial state replaces the local
  assessment draft instead of leaving a stale selected option.

- [ ] **Step 5: Render accessible Hungarian controls and fragment targets.**

  Inside each round-question article:

  - set a stable id based on its snapshot ID for readiness navigation;
  - render the effective status tag;
  - render the three actions Automatikus állapot, Részben megvan, and Nem
    releváns through stable test IDs;
  - show rationale only for not relevant, with a dedicated accessible label;
  - expose saved/pending/error/retry state without changing the existing answer
    state labels;
  - disable controls for completed rounds and only the relevant control while
    its command is pending.

  Use local SCSS for the compact assessment block. Keep native/current PrimeNG
  control conventions and responsive behavior consistent with the surrounding
  answer block.

- [ ] **Step 6: Prove the focused UI suite and typecheck.**

  ~~~powershell
  & $score01Node $score01Pnpm --filter @project-maker/web exec ng test --watch=false --include src/app/interviews/interview.page.spec.ts
  & $score01Node $score01Pnpm --filter @project-maker/web typecheck
  ~~~

  Expected: PASS. Existing answer behavior remains intact, and assessment
  operations cannot race an attempt to close the round.

- [ ] **Step 7: Review interview scope.**

  ~~~powershell
  git diff --check
  git diff -- apps/web/src/app/interviews
  ~~~

  Expected: interview owns only assessment interaction state; no Cockpit
  calculation or readiness presentation is added here.

### Task 6: Add the Cockpit readiness-review deep module and thin orchestration

**Files:**

- Create: apps/web/src/app/projects/readiness-review/readiness-review-api.service.ts
- Create: apps/web/src/app/projects/readiness-review/readiness-review.component.ts
- Create: apps/web/src/app/projects/readiness-review/readiness-review.component.html
- Create: apps/web/src/app/projects/readiness-review/readiness-review.component.scss
- Modify: apps/web/src/app/projects/project-cockpit.page.ts
- Modify: apps/web/src/app/projects/project-cockpit.page.html
- Modify: apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html

**Interfaces:**

- Consumes: ProjectReadiness and only the projectId/refreshKey component inputs.
- Produces: isolated readiness loading/error/retry/unavailable/available UI and
  direct navigation to overview, checklist, or follow-up remediation.
- Preserves: current Cockpit workspace, lifecycle, email, audit, and discovery
  ownership; the Cockpit stylesheet remains unchanged.

- [ ] **Step 1: Add a failing real-browser skeleton test.**

  Create readiness-review.spec.ts with a disposable real project and assert
  that the Cockpit can render a dedicated readiness loading state, retry a
  failed readiness GET, and display the explicit no-initial-intake guidance
  while the Workspace and Discovery modules stay usable.

- [ ] **Step 2: Implement the module-local GET adapter.**

  Create an injectable API service under readiness-review that calls only
  GET /projects/:projectId/readiness, returns Observable<ProjectReadiness>, and
  maps a failed request to a safe Hungarian error. It must not be added to
  ProjectApiService.

- [ ] **Step 3: Implement the standalone component state boundary.**

  Use input.required for projectId and refreshKey. An effect observes both,
  starts a new request, and uses a request token to ignore a delayed older
  response. The component owns:

  - independent loading, error, retry, available, and unavailable signals;
  - completion/readiness summary, factor list, and ordered gap list;
  - fixed Hungarian explanations for NO_INITIAL_INTAKE and
    UNSUPPORTED_SCHEMA;
  - a stable test ID for every state and gap action.

  It must not receive the Cockpit aggregate or form controls.

- [ ] **Step 4: Implement navigation without hidden coupling.**

  Add id workspace to the existing Cockpit Workspace card and id
  discovery-follow-ups to the existing Discovery root. In the new deep module:

  - an overview gap scrolls to workspace using Angular ViewportScroller;
  - a checklist gap navigates to the interview route with that snapshot's
    stable fragment;
  - a follow-up gap scrolls to discovery-follow-ups.

  Do not use visible text, private DOM knowledge beyond these explicit public
  anchors, or a new route.

- [ ] **Step 5: Keep ProjectCockpitPage an orchestrator.**

  Import and render ReadinessReviewComponent. Add one numeric
  readinessRefreshKey signal and one handler for Discovery committedChange that
  increments it and refreshes audit history. Increment it after a successful
  workspace save. Do not calculate, load, render, or style readiness in the
  Cockpit route. Do not add Cockpit SCSS.

- [ ] **Step 6: Run focused type/build proof.**

  ~~~powershell
  & $score01Node $score01Pnpm --filter @project-maker/web typecheck
  & $score01Node $score01Pnpm --filter @project-maker/web build
  ~~~

  Expected: PASS. The Cockpit imports only the deep component and remains
  within its current SCSS budget; readiness styles compile in their own bundle.

- [ ] **Step 7: Review the module boundary.**

  ~~~powershell
  git diff --check
  git diff -- apps/web/src/app/projects/readiness-review apps/web/src/app/projects/project-cockpit.page.ts apps/web/src/app/projects/project-cockpit.page.html apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html
  ~~~

  Expected: no readiness API or business state lives in project-cockpit.page.ts,
  and no new Cockpit stylesheet is present.

### Task 7: Prove the complete employee workflow in a real browser

**Files:**

- Create: apps/web/e2e/readiness-review.spec.ts
- Modify only when selectors require it: relevant files from Tasks 5 and 6

**Interfaces:**

- Consumes: actual API, PostgreSQL migrations, the web app, and stable test IDs.
- Produces: browser evidence for assessment persistence, safe completion,
  readiness refresh, unavailable states, and every remediation navigation seam.
- Preserves: existing five browser workflows as regression coverage.

- [ ] **Step 1: Build an isolated canonical fixture through real API commands.**

  In a serial Playwright describe block, create a disposable project, publish
  exactly the current 30 canonical question keys, create an INITIAL_INTAKE
  round, and submit valid values according to each returned snapshot type.
  Build valid values from returned type/options rather than assuming text
  inputs. Keep fixture content synthetic and do not log its values.

- [ ] **Step 2: Prove assessment persistence and completion behavior.**

  Use the interview UI to set partial after a valid answer, reload, and verify
  the status remains partial. Verify completion is blocked. Reset or change to
  not relevant with rationale, complete only when all other required questions
  are valid, and prove completed controls reject further change. Use network
  assertions for PUT/DELETE rather than timing sleeps.

- [ ] **Step 3: Prove Cockpit readiness refresh and remediation actions.**

  On the canonical fixture:

  - verify factor/readiness/gap rendering through data-testid selectors;
  - save Ball owner in the Workspace and wait for the readiness GET caused by
    the refresh key; prove the owner factor/gap changes without a page reload;
  - create an open discovery follow-up through its existing Cockpit module,
    wait for the readiness GET, and prove a follow-up gap appears;
  - activate a checklist gap and verify the interview URL fragment and matching
    question element;
  - activate a follow-up gap and verify the explicit discovery anchor exists
    and is the navigation target.

- [ ] **Step 4: Prove unavailable and retry isolation.**

  For a project with no intake, verify the readiness component shows Hungarian
  no-source guidance without a score and Workspace remains usable. Abort only
  the first real readiness GET, verify the deep-module error/retry control,
  then let retry reach the real API and verify it recovers without a Cockpit
  page error.

- [ ] **Step 5: Run the new browser test first, then the existing browser suite.**

  ~~~powershell
  & $score01Node $score01Pnpm --filter @project-maker/web test:e2e -- readiness-review.spec.ts
  & $score01Node $score01Pnpm test:e2e
  ~~~

  Expected: PASS. The new vertical slice has direct workflow evidence and the
  existing guided-intake/discovery browser suite remains green.

- [ ] **Step 6: Review browser evidence.**

  Inspect failures, traces, screenshots, and selectors only for the bounded
  score workflow. Do not hide races with fallback clicks, visible-text
  selectors, arbitrary waits, or mocked HTTP success.

### Task 8: Synchronize employee and operational documentation after evidence

**Files:**

- Create: docs/assets/user-guide/07-readiness-review.png
- Modify: docs/roadmap.md
- Modify: docs/product-domain.md
- Modify: docs/user-guide.md
- Modify: docs/operations-handoff.md
- Modify: .planning/STATE.md

**Interfaces:**

- Consumes: verified behavior from Tasks 1 through 7.
- Produces: current-state documentation for employees, product owners, and
  operators.
- Preserves: SCORE-01.2, OUTPUT-01 through OUTPUT-03, and INTAKE-04.3b as
  explicitly incomplete scope.

- [ ] **Step 1: Capture and inspect one sanitized readiness screenshot.**

  Use the successful Playwright fixture only. Capture the available readiness
  review at original resolution, store it as 07-readiness-review.png, and
  visually inspect it before linking. Do not include a real customer, contact,
  answer, rationale, or token in the image.

- [ ] **Step 2: Update product/roadmap truth.**

  In roadmap.md, split SCORE-01 into delivered SCORE-01.1 readiness assessment
  and remaining SCORE-01.2 Decision Score/recommendation. In product-domain.md,
  describe effective statuses, not-relevant exclusion, source eligibility,
  availability states, and redacted gaps as current behavior.

- [ ] **Step 3: Extend the employee guide as a workflow, not an API reference.**

  Add a readiness-review chapter to user-guide.md: when to mark partial versus
  not relevant, why a rationale is required, how status affects completion,
  how to read completion/factors/gaps, how to follow a remediation action, and
  what unavailable means. Include the inspected screenshot and clear recovery
  actions for failed saving/loading. State plainly that Decision Score,
  recommendation, and generated outputs are not yet available.

- [ ] **Step 4: Update operational handoff and state.**

  Record migration 0009, guarded rollback, GET/PUT/DELETE routes, source
  eligibility, audit redaction, verification commands, and disposal-only test
  database policy. Update STATE.md only with behavior that has passed the
  declared gates.

- [ ] **Step 5: Run documentation hygiene checks.**

  ~~~powershell
  rg -n "T[B]D|T[O]DO|PLACEHOLD(?:ER)|<[^>]+>" docs .planning
  rg -n "Decision Score.*delivered|recommended action.*available|automatic.*export" docs .planning
  git diff --check
  ~~~

  Expected: no unresolved marker, false-delivery claim, broken current-state
  assertion, or markup whitespace problem. Review every changed link and image
  target locally.

### Task 9: Perform final verification, task-by-task review, and handoff

**Files:** All files in the File Map, read-only review only.

**Interfaces:**

- Consumes: completed narrow proofs and final working tree.
- Produces: evidence-backed handoff ready for an explicitly authorized
  stage/commit/PR/merge path.
- Preserves: user control over every GitHub mutation.

- [ ] **Step 1: Run the full local quality gate from the clean task state.**

  ~~~powershell
  & $score01Node $score01Pnpm typecheck
  & $score01Node $score01Pnpm test
  & $score01Node $score01Pnpm build
  & $score01Node $score01Pnpm test:e2e
  & $score01Node $score01Pnpm verify
  ~~~

  Expected: PASS. If one command is redundant through verify, retain its
  independent result only when it adds useful evidence; do not suppress a
  failing narrow test to obtain an aggregate pass.

- [ ] **Step 2: Validate migration and runtime readback on an isolated stack.**

  Run migration:show/run against the named disposable database and start the
  relevant Compose stack only if its environment is likewise isolated. Verify
  health, GET readiness unavailable/available response shape, assessment
  command persistence, and migration status without printing credentials.

- [ ] **Step 3: Request task-by-task code review.**

  Use subagent-driven development or an independent review pass for each
  completed task. Review contract drift, migration rollback/data safety,
  completed-round concurrency, audit redaction, calculator policy coupling,
  deep-module locality, browser selectors, documentation accuracy, and scope
  creep. Address only confirmed issues and rerun the narrow test for every
  fix before the full gate.

- [ ] **Step 4: Perform final diff and secret review.**

  ~~~powershell
  git status --short
  git diff --check
  git diff --stat
  git diff -- packages/contracts apps/api apps/web docs .planning
  ~~~

  Confirm that no new secret, connection string, fixture business content,
  generated bundle, lockfile churn, unrelated formatting, or Cockpit SCSS
  change slipped into the delivery.

- [ ] **Step 5: Handoff without changing Git state.**

  Report the exact verification results, changed files, current WORK_STATE,
  remaining SCORE-01.2/OUTPUT/INTAKE-04.3b boundaries, and any non-blocking
  risks. Ask for a separate explicit approval before stage, commit, push, PR,
  or merge.

## Acceptance Checklist

- [ ] A missing/valid answer projects Nincs meg/Kész without inferred-row
  persistence or backfill.
- [ ] Partial and not-relevant overrides obey all API, database, reload,
  no-op, answer-clear, audit, and completed-round rules.
- [ ] A justified not-relevant required snapshot can complete; partial cannot.
- [ ] The new readiness endpoint returns explicit unavailable states and exact
  canonical general-v1 availability behavior.
- [ ] Completion, readiness, factor breakdown, labels, follow-up handling, and
  ordered redacted gaps are policy-derived and behaviorally tested.
- [ ] Cockpit stays a thin orchestrator; the deep module reloads after
  Workspace and Discovery commits and supports all three navigation targets.
- [ ] Employee and operational documentation accurately distinguish SCORE-01.1
  from remaining Decision Score, output, and source-linkage work.
- [ ] Focused checks, full repository verification, real browser E2E,
  migration proof, review, and final diff inspection pass before any Git
  publication is requested.
