# Guided Intake Persistence and Hungarian Coaching Implementation Plan

> **Delivery status:** Delivered on `main` through the guided-intake commit series ending at `8ae4e4e`. The unchecked task list below is preserved as the approved pre-execution plan; current delivery status is maintained in [`docs/roadmap.md`](../../roadmap.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first usable vertical slice of Project Maker: a published project question schema can be used for one `INITIAL_INTAKE` round, answers are persisted and recovered through the server, and the user receives deterministic Hungarian guidance throughout the flow.

**Architecture:** Keep the current domain contracts and TypeORM persistence model as the source of truth. Add one server-side active-round read path and a database invariant for at most one open initial round per project. The web page loads the active round on entry, keeps the current draft in memory, and persists each answer with per-question autosave state. Completion remains server-authoritative.

**Tech Stack:** Angular 22, PrimeNG 22, NestJS, TypeORM, PostgreSQL, Docker Compose, pnpm, Vitest, Playwright, and the existing shared contracts package.

## Global Constraints

- Work must start from a fresh `dev-guided-intake` worktree/branch during execution; do not edit the current `main` checkout in the implementation session.
- Do not commit, merge, or push as part of implementation until the user explicitly approves the reviewed result.
- The first slice is limited to `INITIAL_INTAKE`. Do not expand the round lifecycle to `STAKEHOLDER` or `CLARIFICATION`.
- The existing published project question schema is a prerequisite. Schema administration is not expanded by this slice.
- The API and PostgreSQL remain internal services; only the web gateway is exposed by the local deployment boundary.
- Core operation must not depend on a live AI/LLM call, keyword matching, or browser-only persistence.
- Authentication, authorization, multi-client conflict resolution, offline queues, PWA behavior, scoring, output generation, follow-up mail, and new project-schema management remain outside this slice.
- Every end-user string, status, error, retry action, label, and accessible name introduced or changed by this slice must be Hungarian. Engineering documentation remains English.
- Preserve the existing stable question identifiers and round snapshot semantics. Do not invent a second question-text field: the seeded canonical `exampleQuestion` is currently persisted and exposed through the existing snapshot `text` field.
- Follow the repository rule that function parameters are explicit and do not introduce default parameter values.
- Use existing `data-testid` and accessibility identifiers for browser tests; do not make tests depend on translated visible text.

## Product Scope

### In scope

- Starting an `INITIAL_INTAKE` round for a project with a published schema.
- Returning the currently open initial round, including persisted answers, after page load.
- Deterministically rejecting a second open initial round with a conflict response.
- Text autosave after a 750 ms quiet period.
- Immediate autosave for discrete values and explicit clears.
- Per-question saving, saved, and error/retry states.
- Recovery after browser reload, tab reopen, API restart, and Compose restart for values successfully written to PostgreSQL.
- Server-side required/type validation at completion.
- Contract-driven Hungarian coaching from question text, hint, required, blocking, control point, option, and type metadata.
- Completed-round immutability and the ability to start a new initial round only after the prior one is completed.

### Out of scope

- Adding or redesigning schema administration.
- Additional round types or round-to-round orchestration.
- Scoring, cockpit calculations, Markdown generation, exports, follow-up questions, SMTP, authentication, or authorization.
- Offline queueing, conflict resolution between clients, and background synchronization.
- AI-generated coaching or semantic answer evaluation.

## Acceptance Criteria

The implementation is ready for the first verification gate only when all criteria below are evidenced by automated checks or an explicitly recorded manual check.

1. A project with a published schema can start exactly one open `INITIAL_INTAKE` round.
2. Starting the same round twice while the first is open returns a deterministic HTTP 409 response and leaves exactly one open round.
3. `GET /projects/:projectId/rounds/active` returns `null` before a round starts, returns the active round with its persisted answers while it is open, and returns `null` after completion.
4. Reloading the interview page or reopening its tab resumes the same open round and repopulates answers that were successfully persisted before the reload.
5. Text and long-text answers are persisted after 750 ms without further input; select, boolean, number, date, multi-select, and explicit clear actions are persisted immediately.
6. A save failure keeps the current draft visible, shows a Hungarian failure state, and exposes a deterministic retry action. No unsignaled offline queue or silent data loss is introduced.
7. A value already in flight cannot overwrite a newer draft. The newest draft remains visible and is persisted after the earlier request settles.
8. Completion is rejected when any required answer is missing or type-invalid, with a Hungarian explanation and no status transition.
9. `blocking` metadata is visible as critical guidance but does not independently prevent completion when the answer satisfies required/type validation.
10. A completed round and its answers are read-only. A new initial round is allowed only after the previous round is completed.
11. A project without a published schema cannot start the round and receives a clear Hungarian blocked state.
12. The coaching rendered for every question is deterministic and comes only from persisted contract metadata; no keyword heuristic or model call is used.
13. API integration tests cover lifecycle, persistence, recovery, duplicate-open protection, missing schema, required/type validation, and save failure behavior.
14. Playwright covers the primary Hungarian user flow, autosave timing, reload recovery, missing-schema blocking, completion failure/success, and retry behavior using stable identifiers.
15. Type checks, package tests, production build, and Compose health verification pass without unrelated generated or documentation-tree changes.

## Known Repository Touchpoints

- `apps/api/src/interviews/interviews.controller.ts` currently exposes create, answer update, and completion operations but no active-round read operation.
- `apps/api/src/interviews/interviews.service.ts@@ already locks rounds, validates values, writes audit records, and maps database rows to `InterviewRound`.
- `apps/api/src/interviews/interview-round.entity.ts` and the existing migration model the round type/status required by the invariant.
- `apps/api/src/database/migration-data-source.ts` registers production migrations.
- `apps/api/test/question-rounds.e2e-spec.ts` and `apps/api/test/round-integrity.e2e-spec.ts` construct explicit migration lists and must include the new migration.
- `packages/contracts/src/interviews.ts` already represents an `InterviewRound | null` read result and persisted answer snapshots.
- `apps/web/src/app/interviews/interview-api.service.ts` currently has create, answer update, and completion calls but no active-round call.
- `apps/web/src/app/interviews/interview.page.ts`, `.html`, and `.scss` currently implement the interview editor with local drafts and a manual save action.
- `apps/web/playwright.config.ts` already provides the local web server and base URL; `apps/web/e2e/shell.spec.ts` is the existing browser-test pattern.

## Implementation Tasks

### Task 1: Enforce one open initial round at the database boundary

**Files:**

- Add `apps/api/src/migrations/0005-initial-intake-open-round.ts`.
- Update `apps/api/src/database/migration-data-source.ts`.
- Update the explicit migration lists in `apps/api/test/question-rounds.e2e-spec.ts` and `apps/api/test/round-integrity.e2e-spec.ts`.
- Extend `apps/api/test/round-integrity.e2e-spec.ts` with the uniqueness boundary checks.

**Steps:**

- [ ] Add a failing integration test that attempts two open `INITIAL_INTAKE` rows for one project and expects the second insert to fail with PostgreSQL unique-violation code `23505`.
- [ ] Add a failing integration test proving a completed initial round does not prevent a later open initial round.
- [ ] Add migration `InitialIntakeOpenRound0005InitialIntakeOpenRound1786262400000`.
- [ ] In `up`, query for existing duplicate open initial rounds and fail with an actionable migration error instead of deleting, merging, or selecting a winner.
- [ ] Create the partial unique index `uq_interview_rounds_open_initial_intake` on `interview_rounds(project_id)` for rows with `status = 'OPEN'` and `type = 'INITIAL_INTAKE'`.
- [ ] In `down`, drop only that named index.
- [ ] Register the migration in the runtime data source and both test data sources.
- [ ] Run the two targeted API integrity suites and confirm both the rejection and completed-then-new-round paths.

**Design notes:**

- The application conflict check improves the error message, while the database index is the concurrency-safe final boundary.
- Migration failure on pre-existing duplicates is intentional. Data repair requires an explicit product decision and must not happen implicitly during startup.

### Task 2: Add active-round recovery and deterministic duplicate-start behavior to the API

**Files:**

- Modify `apps/api/src/interviews/interviews.controller.ts`.
- Modify `apps/api/src/interviews/interviews.service.ts`.
- Extend `apps/api/test/question-rounds.e2e-spec.ts`.

**Steps:**

- [ ] Add a failing API test for `GET /projects/:projectId/rounds/active` returning `null` before the first round.
- [ ] Add a failing API test that starts an initial round, saves an answer, reads the active round, and verifies the same round ID and answer value are returned.
- [ ] Add a failing API test that attempts a second open start and expects HTTP 409.
- [ ] Add a failing API test that completes the round, verifies the active endpoint returns `null`, and starts a new initial round successfully.
- [ ] Add `GET projects/:projectId/rounds/active` to the controller with the existing project/round response contract.
- [ ] Add `getActiveInitialIntake(projectId: string): Promise<InterviewRound | null>` to the service.
- [ ] Load the round, snapshots, and answers in one consistent read path and reuse the existing mapping logic so active recovery cannot silently omit answers.
- [ ] Make `createRound` reject an existing open initial round before building another snapshot set.
- [ ] Map a concurrent unique-index violation to the same 409 contract using the repository's existing `23505` handling pattern; do not expose database details or values.
- [ ] Preserve the existing 409 response for a missing published schema.
- [ ] Run the targeted API suite and inspect response bodies for stable, non-secret error messages.

**Endpoint contract:**

```text
GET /projects/:projectId/rounds/active
200 -> InterviewRound JSON when an open INITIAL_INTAKE exists
200 -> null when no open INITIAL_INTAKE exists
404/409 -> existing project/schema errors according to current API behavior
```

### Task 3: Load and resume the active round in the web page

**Files:**

- Modify `apps/web/src/app/interviews/interview-api.service.ts`.
- Modify `apps/web/src/app/interviews/interview.page.ts`.
- Modify `apps/web/src/app/interviews/interview.page.html`.
- Modify `apps/web/src/app/interviews/interview.page.scss` only for the new resume/status presentation.

**Steps:**

- [ ] Add `getActiveInitialIntake(projectId: string): Observable<InterviewRound | null>` to the API service.
- [ ] Extend the page's initial `forkJoin` load to fetch the active round with the question bank and project schema.
- [ ] When an active round exists, set `round`, hydrate drafts from its answer snapshots, and render resume state instead of offering a second start action.
- [ ] When no active round exists, keep the start action available only if the schema is published.
- [ ] Make the first-slice round type fixed to `INITIAL_INTAKE`; remove the multi-type selection from this flow or constrain it to the one supported option without leaving an unsupported path visible.
- [ ] Disable schema editing while an open round is active so the snapshot remains explainable and immutable.
- [ ] Keep existing stable test IDs, adding explicit IDs for resume state, per-question save state, retry action, blocking guidance, and Hungarian error text.
- [ ] Map network/API failures to clear Hungarian page-level messages while preserving the existing retry path.
- [ ] Add a focused component/service test only where it verifies a meaningful state transition not covered by the browser flow; do not test static translated strings as implementation details.

**State rules:**

- The server round is the source of truth after load.
- The current draft is retained in memory until the user leaves the page; it is not written to browser storage.
- A completed round is rendered read-only and cannot schedule new saves.
- A failed save does not replace the draft with the last persisted value.

### Task 4: Replace manual answer saving with safe autosave and deterministic Hungarian coaching

**Files:**

- Modify `apps/web/src/app/interviews/interview.page.ts`.
- Modify `apps/web/src/app/interviews/interview.page.html`.
- Modify `apps/web/src/app/interviews/interview.page.scss`.
- Modify `apps/api/test/question-rounds.e2e-spec.ts` if an API-level save-failure fixture is required by the existing test harness.

**Steps:**

- [ ] Add explicit per-question state for `idle`, `saving`, `saved`, and `error`, plus the latest draft and last persisted value.
- [ ] Add a per-question timer map and clear all pending timers when the page is destroyed.
- [ ] Schedule text and long-text values after exactly 750 ms of quiet time.
- [ ] Persist select, boolean, number, date, multi-select, and explicit clear actions immediately.
- [ ] Keep the current draft when a save fails and render a Hungarian retry action tied to that question.
- [ ] When an older request settles after a newer draft exists, keep the newer draft, mark the persisted value only when it matches the current request, and immediately persist the newer value when needed.
- [ ] Use a scalar/array-aware answer comparison helper so multi-select order and clear operations are handled deterministically according to the current contract.
- [ ] Remove the normal-flow manual save control or retain it only as an explicit retry action; it must not be required for ordinary answer persistence.
- [ ] Render each question's existing canonical text, hint, control point, required marker, blocking marker, type guidance, and option guidance through one deterministic template path.
- [ ] Translate loading, empty, save, completion, validation, retry, schema, and round-status messages into Hungarian.
- [ ] Keep `blocking` as critical coaching only; completion must continue to rely on the server's required/type rules.
- [ ] Add the minimum negative-path test for an API save failure: draft remains visible, error status appears, retry can persist the same value.

**Suggested explicit methods:**

```text
setTextDraft(question: RoundQuestionSnapshot, value: string): void
setDiscreteDraft(question: RoundQuestionSnapshot, value: AnswerValue | null): void
scheduleAnswerSave(question: RoundQuestionSnapshot, delayMs: number): void
persistAnswer(question: RoundQuestionSnapshot): void
retryAnswer(question: RoundQuestionSnapshot): void
clearAutosaveTimers(): void
answersEqual(left: AnswerValue | null, right: AnswerValue | null): boolean
```

The implementation may use different names only if the same single-purpose responsibilities and explicit parameters remain clear in the final diff.

### Task 5: Verify the real Hungarian browser flow

**Files:**

- Add `apps/web/e2e/guided-intake.spec.ts`.
- Modify `apps/web/e2e/shell.spec.ts` only if shared setup must be extracted without weakening its existing assertion.
- Modify existing API fixtures only to provide a deterministic published-schema project.

**Steps:**

- [ ] Establish a real test project through the API and ensure it has the canonical published question schema.
- [ ] Start the initial intake through a stable test ID.
- [ ] Assert the Hungarian page shell, active-round state, question guidance, and answer status through stable IDs or accessibility attributes.
- [ ] Enter a text answer, wait for the 750 ms debounce plus network completion, and verify the saved status.
- [ ] Change a discrete answer and verify immediate persistence.
- [ ] Reload the page and verify the same round and both values are recovered from the API.
- [ ] Complete with a missing required answer and verify the round remains open with a Hungarian validation state.
- [ ] Complete with valid required/type-correct values and verify the round becomes read-only.
- [ ] Start a new initial round after completion and verify the new round ID differs.
- [ ] Verify a project without a published schema shows the blocked state and cannot start.
- [ ] Force a save failure using the existing testable API boundary, verify the draft remains visible, and verify retry succeeds.
- [ ] Keep selectors independent from the exact Hungarian wording so copy review does not make the suite brittle.

**API negative-path coverage:**

- Duplicate open start.
- Missing published schema.
- Missing required answer.
- Invalid answer type.
- Save failure response.
- Completed-round answer mutation.

### Task 6: Run the verification gate and update current-state documentation

**Files:**

- Update `.planning/REQUIREMENTS.md` only after the corresponding evidence exists.
- Update `.planning/STATE.md` with the current implementation/verification state.
- Update `docs/operations-handoff.md` only if the runtime start, health, or recovery procedure changes.

**Steps:**

- [ ] Run `pnpm --filter @project-maker/api typecheck`.
- [ ] Run `pnpm --filter @project-maker/web typecheck`.
- [ ] Run `pnpm --filter @project-maker/contracts typecheck`.
- [ ] Run `pnpm --filter @project-maker/api test`.
- [ ] Run `pnpm --filter @project-maker/web test`.
- [ ] Run `pnpm --filter @project-maker/web test:e2e`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm verify` if the environment supports the complete repository gate without changing unrelated files.
- [ ] Run `pnpm compose:up`, verify `GET http://127.0.0.1:<api-port>/health` returns `{"status":"ok"}`, exercise the migration and active-round recovery path, then run `pnpm compose:down`.
- [ ] Re-run the repository preflight after any branch, dependency, Compose, or external-state change.
- [ ] Review the final diff for scope creep, generated-file noise, unintended contract changes, untranslated user-facing text, and secret-like values.
- [ ] Run the documentation-tree cleanliness scan and confirm no prohibited out-of-scope material is introduced.
- [ ] Mark `INTAKE-02`, `INTAKE-03`, and `INTAKE-05` complete only when all related acceptance criteria pass; otherwise record the exact partial state rather than claiming full completion.
- [ ] Stop before commit or push and present the evidence, remaining risks, and proposed integration action for explicit approval.

## Verification Matrix

| Concern | Primary evidence | Required negative path |
| --- | --- | --- |
| One open initial round | PostgreSQL migration/integrity test and API duplicate-start test | Concurrent or repeated start returns 409 |
| Active recovery | API GET test and Playwright reload test | No active round returns `null` |
| Autosave | Playwright timing/status assertions and persisted-answer API readback | Save failure retains draft and offers retry |
| Validation | API completion tests and Playwright completion flow | Missing required and invalid type remain open |
| Immutability | Existing database boundary tests plus completed-round browser state | Answer mutation after completion is rejected |
| Deterministic coaching | Contract-driven rendering assertions and code review | No model/keyword path is reachable |
| Deployment readiness | Typecheck, tests, build, Compose health and restart check | Missing schema and service restart fail clearly |

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Existing data already contains duplicate open initial rounds | Migration cannot safely create the invariant | Detect and fail with a repair list; never auto-delete or merge rows |
| Two start requests race | Duplicate rounds or inconsistent UX | Application conflict check plus partial unique index plus stable 409 mapping |
| Autosave requests settle out of order | Newer input can be overwritten | Track per-question latest draft/request value and persist the newest value after stale requests settle |
| Browser reload occurs during debounce or an in-flight request | Latest keystrokes may not be persisted | Document persistence boundary, keep draft during the session, and test only values confirmed saved as recovery guarantees |
| Canonical text semantics are misunderstood | Duplicate or incompatible contract fields | Reuse the existing snapshot `text` field, which is populated from the canonical example question |
| Translation changes break browser tests | False-negative QA | Use stable IDs and accessibility attributes, with copy assertions limited to intentional language markers |
| Compose restart is not reproducible in CI | Incomplete persistence evidence | Keep API/PostgreSQL integration evidence independent and run the restart check as an explicit deployment gate with captured output |

## Execution Order

1. Task 1 establishes the database invariant.
2. Task 2 exposes the server recovery contract and conflict behavior.
3. Task 3 wires the page to active-round recovery.
4. Task 4 implements autosave and deterministic Hungarian coaching.
5. Task 5 verifies the user-visible vertical slice.
6. Task 6 runs the complete gate and records only evidence-backed requirement status.

No implementation code should be written until this plan is accepted and an execution mode is selected.

## Completion Handoff

The implementation handoff must include:

- Exact changed files and migration identifier.
- API endpoint behavior and database invariant evidence.
- Test commands and pass/fail output summaries.
- Browser-flow evidence for autosave, reload recovery, validation, retry, and completed-round immutability.
- Compose health and restart evidence.
- Any remaining risk or partial requirement, stated explicitly.
- A separate recommendation for commit, branch integration, or push; none is performed automatically by this plan.
