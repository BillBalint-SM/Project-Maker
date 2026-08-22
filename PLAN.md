# Plan: complete the remaining local simplification work

Depth: tree 3   Mode: orchestrated
Budget note: the work spans independent Angular, runtime, database, and documentation changes and cannot be proven safely in one pass.

## Contract

- Interfaces: existing HTTP, Angular, database, Customer-mail, Specification, queue, navigation, and MCP contracts remain externally unchanged.
- Data ownership: Customer-mail history, correlation identity, audit, Customer inbound messages, Specifications, and Git handoff data must not be lost; schema changes require an explicit forward migration.
- Naming and conventions: the vocabulary in `CONTEXT.md`, professional-English user-facing copy, Nest/Angular repository conventions, and the pnpm 11.20.0 toolchain are authoritative.
- Error convention: diagnostics never reach the UI; the shared HTTP mapper handles only generic failures, while feature-specific 409/recovery copy remains local.
- Concurrency: concurrent leaves own disjoint files. Persistence leaves that depend on each other run sequentially.
- Verification: each leaf uses focused evidence only; full `pnpm verify` and the container smoke run at root integration.
- Tracker boundary: GitHub issues, assignees, and states are not changed; this run produces local implementation only.
- Shared surfaces: `PLAN.md`, `GATES.md`, `gates/**`, and final roadmap/requirements reconciliation belong to the root driver.

## Leaf queue

| ID | Deliverable | Owns | Needs | Tier | Gates |
|---|---|---|---|---|---|
| 1.1.1 | Protected-behavior and supported-migration baseline | `docs/simplification-baseline.md` | none | default | `gates/leaf-1.1.1.md` |
| 1.1.2 | Requirements, roadmap, ADR, and operations reconciliation | `.planning/**`, `docs/roadmap.md`, `docs/operations-handoff.md`, `docs/adr/0004-project-operation-policy.md`, `README.md` | 1.2.1, 1.2.2, 1.3.1, 1.3.2 verified | default | `gates/leaf-1.1.2.md` |
| 1.2.1 | Remove cross-feature UI locking and simplify error mapping and the queue cursor | `apps/web/src/**`, `apps/web/e2e/**`, `apps/api/src/projects/active-project-queue-cursor.ts`, `apps/api/test/active-project-queue*.ts`; root integration owns shared env/Compose/CI files | 1.1.1, 1.2.2 code-verified | default | `gates/leaf-1.2.1.md` |
| 1.2.2 | One contracts runtime and a lean production API image | `packages/contracts/**`, `apps/api/Dockerfile`, `apps/api/scripts/copy-general-playbook.mjs`, `apps/api/package.json`, `apps/web/package.json`, `pnpm-lock.yaml`, `.github/workflows/ci.yml`, `scripts/run-container-smoke.mjs` | none | default | `gates/leaf-1.2.2.md` |
| 1.3.1 | Canonical Customer-mail persistence and a simple checkpoint | `apps/api/src/interview-customer-handoffs/**`, `apps/api/src/follow-ups/**`, `apps/api/src/mail-delivery/**`, `apps/api/src/customer-mailbox-sync/**`, related Customer-mail API tests, one forward migration, and mail runtime configuration; root integration owns shared env/Compose/CI files | 1.1.1, 1.2.2 code-verified | default | `gates/leaf-1.3.1.md` |
| 1.3.2 | Consolidate the supported migration chain and its test load | `apps/api/src/migrations/**`, `apps/api/src/database/migration-sequence.ts`, `apps/api/test/*migration*.ts`, `apps/api/test/migration-harness.ts` | 1.1.1, 1.3.1 verified | default | `gates/leaf-1.3.2.md` |

## Tree

- 1 Complete the remaining local work ........ `GATES.md`
  - 1.1 Contract and state .................... `gates/node-1.1.md`
    - 1.1.1 Baseline .......................... `gates/leaf-1.1.1.md`
    - 1.1.2 Reconciliation .................... `gates/leaf-1.1.2.md`
  - 1.2 Application and runtime simplification  `gates/node-1.2.md`
    - 1.2.1 UI/queue simplification ........... `gates/leaf-1.2.1.md`
    - 1.2.2 Contracts/container ............... `gates/leaf-1.2.2.md`
  - 1.3 Persistence simplification ............ `gates/node-1.3.md`
    - 1.3.1 Customer-mail persistence ......... `gates/leaf-1.3.1.md`
    - 1.3.2 Migration history ................. `gates/leaf-1.3.2.md`

## Dispatch schedule

- Initial ready set: 1.1.1 and 1.2.2.
- After parent verification of 1.1.1 and 1.2.2: start 1.2.1 and 1.3.1.
- After parent verification of 1.1.1 and 1.3.1: start 1.3.2.
- After 1.2.1 and 1.2.2: verify `gates/node-1.2.md`.
- After 1.3.1 and 1.3.2: verify `gates/node-1.3.md`.
- After every implementation leaf: run 1.1.2, then verify `gates/node-1.1.md`.
- Root integration: `GATES.md`, one full verify, and one container smoke.

## Status log

- 2026-08-22: plan, contract, ownership, and gates recorded; no tracker mutation.
- 2026-08-22: 1.1.1 parent-verified — the protected-behavior matrix and the supported no-squash migration baseline from `0001` pass 5/5 gates.
- 2026-08-22: 1.2.2 code-verified — one contracts runtime, API/web typecheck, 18/18 contracts tests, production web build, and pruned image pass; container health remains open until the discovered `0013 -> 0014` data-upgrade defect is fixed.
- 2026-08-22: the container-discovered `0013 -> 0014` blocker was fixed test-first; a real PostgreSQL upgrade test proves retention of historical `COMPLETED` round data. Final image/health smoke follows all new migrations.
- 2026-08-22: 1.2.1 focused verification passed — 72/72 Angular tests, production build/typecheck, 2/2 cursor units, and 14/14 PostgreSQL queue e2e tests. The cursor is intentionally readable, versioned, validated navigation state rather than a security boundary; no dedicated runtime secret remains.
- 2026-08-22: 1.3.1 production code and data upgrade proven — shared canonical outbound/attempt seam, secret-free validated checkpoint, 72/72 mail tests, and a real `0031 -> 0032` preservation proof pass. Checkpoint-secret documentation removal belongs to final 1.1.2 reconciliation.
- 2026-08-22: 1.3.2 focused verification passed — the `0001 -> 0032` no-squash fixture retains Project, Specification, Customer-mail, audit, attachment, and identity data; undo/down-only test ceremony is gone, while real transaction-concurrency evidence remains. The migration target set passes 14/14 and round integrity passes 21/21.
- 2026-08-22: 1.2.2 fully verified — reusable local/CI container smoke passes fresh `0001 -> 0032` migration, health, canonical contracts import, and an authenticated policy consumer route; the pruned runtime image contains neither pnpm nor the full workspace.
- 2026-08-22: 1.1.2 documentation reconciled — delivered Batch 1–5 items are marked DELIVERED/[x] with evidence, while incomplete Project UX, optional scanner integration, restore/import, and PWA work remain open. ADR-0007 supersedes ADR-0004; operations/mail/README describe the 0032/no-squash and secret-free checkpoint model.
- 2026-08-22: root integration passed — a Markdown-template e2e that incorrectly assumed an empty shared database now follows its own unique record; `pnpm verify` passed with contracts 18/18, web 72/72, API 244/244, every typecheck, and every production build. Fresh-container `0001 -> 0032` smoke and all three parent nodes passed 5/5 gates.
- 2026-08-22: independent review findings addressed — legacy pre-gateway ping diagnostics now use the retained read-only fallback, handoff history loads canonical mail projections in a fixed query count, cursor documentation states the intentional untrusted-navigation boundary, and engineering artifacts use English. Focused Customer-mail/handoff tests pass 21/21; final `pnpm verify` passes with contracts 18/18, web 72/72, API 244/244, all typechecks, and all production builds. A fresh final image also passes the isolated `0001 -> 0032` container smoke and removes its temporary resources.
- 2026-08-22: pre-main Standards review found one uncovered Project-settings concurrency edge. The fix preserves independent command results by merging only their owned fields and ignores an older lifecycle response after a newer successful archive/restore/status result. Pending, out-of-order, lifecycle-stale, failure, and retry coverage now passes with the complete 75/75 web suite, typecheck, and production build; the review follow-up is the merge gate.

## Delivery path to GitHub main

Baseline on 2026-08-22:

- local `main`, `origin/main`, and the implementation base all point to
  `b71b623ee4f94a4d23cc7d1478a804bcb0def879`;
- the work continues on `codex/simplification-main-readiness`, so the local
  `main` pointer stays clean;
- GitHub `main` has no branch-protection rule, therefore delivery still uses a
  branch and pull request rather than a direct push;
- no remote mutation, commit, pull request, or merge is part of the local
  readiness pass.

Local readiness sequence:

1. Reconcile stale scripts, release guidance, migration counts, auth wording,
   and CI job names with the implemented state.
2. Validate workflow syntax and pinned action tags.
3. Run install, verify, and mail-gateway with the repository-pinned pnpm
   `11.20.0`, then run `node scripts/run-container-smoke.mjs`, using the
   database boundaries documented in `docs/operations-handoff.md`.
4. Run `git diff --check`, inspect the complete staged scope, and confirm that
   no secret, generated test output, or unrelated user change is included.

Remote delivery sequence, requiring separate authority:

1. Re-fetch `origin/main`. If it moved, rebase the feature branch and repeat
   only the affected focused checks plus the three root gates.
2. Preserve large, reviewable batches: application/runtime simplification;
   canonical mail persistence and forward migration; documentation and
   delivery-state reconciliation.
3. Push only `codex/simplification-main-readiness` and open one pull request to
   `main`.
4. Require one green run of `checkpoint`, `mail-gateway`, and
   `container-smoke`; do not rerun unchanged successful jobs speculatively.
5. Review and merge the pull request, then fetch and fast-forward local `main`
   to the resulting remote commit.

Recovery boundary: the branch and commits remain available until the merged
state is verified. Application rollback uses a compatible image and verified
database backup. Migration `0032` is forward-only; `migration:revert` is not a
supported recovery command.

Local evidence on 2026-08-22: the globally installed pnpm was `11.19.0`, so the
checks used `npx.cmd --yes pnpm@11.20.0` without changing the workstation. The
frozen install, fresh-database checkpoint, isolated mail-gateway suite, and
production container smoke all passed.

Final local readiness on 2026-08-22: `main...origin/main` remains `0 0` at the
recorded base; actionlint and all referenced action tags pass; the intended
91-path worktree contains no token-shaped added content or generated test
output; `git diff --check` passes. Only the separately authorized remote
push/PR/merge gate remains open.

## UX audit remediation — `UX-AUDIT-001` through `UX-AUDIT-006`

Depth: tree 4   Mode: orchestrated
Budget note: six proven runtime/UX defects across the Angular shell, Project
workflows, two HTTP contracts, product copy, and authoritative documentation.

### Contract

- Interfaces:
  - Customer-reply and Notification shell loads have independent state and an
    explicit retry; no polling or real-time channel is introduced.
  - Logout failure keeps the authenticated session, reports a controlled safe
    English message, and permits one deliberate retry.
  - Follow-up Settings links to
    `/projects/:projectId/customer-correspondences#customer-communication` and
    cannot enable automation before a non-empty draft exists; the API guard
    remains authoritative.
  - Formal Decision renders mutation controls only after Project state is
    proven active; loading/error/archived states fail closed and retain the API
    archive guard.
  - `GET` of an optional Question Schema or Delivery Package returns `200` with
    JSON `null` for a known Project with no resource. A missing Project remains
    `404`; export, handoff, and mutation prerequisites remain strict.
  - Employee-facing runtime copy uses professional software-development and
    project-management English. Current operating documentation quotes the
    same English UI labels; explanatory prose may remain in its intended
    reader language. Stored legacy values, user-authored content, and immutable
    history are unchanged.
- Data ownership: no persistence migration and no new role, permission,
  credential, retry daemon, or cross-feature state manager.
- Naming and errors: Angular signals and existing feature-local services;
  accessible `role="alert"` recovery; safe English errors; command-local
  pending state per ADR-0007.
- Shared surfaces: the driver owns `PLAN.md`, branch/root gate files, the audit
  backlog status, root integration, and final documentation reconciliation in
  `PLAN.md`; each leaf owns only its named leaf gate plus its disjoint
  application paths.

### Leaf queue

| ID | Deliverable | Owns | Needs | Tier | Gates |
| --- | --- | --- | --- | --- | --- |
| 2.1.1 | `UX-AUDIT-001/002`: recoverable shell attention loads and visible logout failure | `apps/web/src/app/app.component.{ts,html,scss,spec.ts}` | none | default | `gates/ux-audit-shell.md` |
| 2.1.2 | `UX-AUDIT-003/004`: follow-up prerequisite path and fail-closed Formal Decision state | `apps/web/src/app/projects/customer-follow-up/**`, `apps/web/src/app/projects/decision-review.page.*` | none | default | `gates/ux-audit-project-safety.md` |
| 2.2.1 | `UX-AUDIT-005/006`: successful optional-resource absence plus complete professional English | Question Schema and Delivery Package API/controller/tests; related web adapters/tests; Delivery/Discovery copy; `README.md`, `CONTEXT.md`, `docs/roadmap.md`, `docs/user-guide.md`, `docs/adr/0007-command-local-pending-state.md` | none | default | `gates/ux-audit-contract-english.md` |

### Tree

- 2 Resolve `UX-AUDIT-001` through `UX-AUDIT-006` ........ `gates/ux-audit-root.md`
  - 2.1 Runtime recovery and workflow safety .............. `gates/ux-audit-node-runtime.md`
    - 2.1.1 Shell recovery and logout ...................... `gates/ux-audit-shell.md`
    - 2.1.2 Project workflow safety ........................ `gates/ux-audit-project-safety.md`
  - 2.2 Contract and language correctness ................. `gates/ux-audit-node-quality.md`
    - 2.2.1 Optional-resource contract and English ......... `gates/ux-audit-contract-english.md`

### Dispatch schedule

- Initial ready set: 2.1.1, 2.1.2, and 2.2.1.
- Parent-force each returned leaf immediately against its own gate file.
- After 2.1.1 and 2.1.2 are parent-verified: run the runtime branch gates.
- After 2.2.1 is parent-verified: run the contract/language branch gates.
- After both branches pass: reconcile the audit ledger, run root gates once,
  then perform one independent final code review.

### UX audit remediation status log

- 2026-08-22: contract, disjoint ownership, TDD seams, leaf gates, branch
  gates, and root completion gates recorded before implementation.
- 2026-08-22: leaves 2.1.1, 2.1.2, and 2.2.1 dispatched concurrently with
  disjoint file ownership and red-first gate requirements.
- 2026-08-22: leaf 2.1.2 parent-verified — Follow-up Settings enforces and
  links the saved-draft prerequisite; Formal Decision fails closed across
  loading/error/archived state; focused tests and all 6/6 leaf gates pass.
- 2026-08-22: leaf 2.1.1 parent-verified — independent shell resource recovery,
  stale-user suppression, and visible retryable logout failure pass all 6/6
  leaf gates.
- 2026-08-22: leaf 2.2.1 parent-verified — known-empty optional reads return
  200/null while unknown Projects remain 404; confirmed mixed-language copy
  and owned documentation are aligned; focused tests and all 8/8 leaf gates
  pass. A full reused-database test exposed unrelated reference-file fixture
  accumulation, so the leaf gate remains correctly scoped to the two new
  nullable cases; full adjacent files are reserved for a fresh branch database.
- 2026-08-22: adversarial composition reopened two incomplete leaves before
  branch validation. Shell cancellation now preserves later feature-local
  badge updates and keeps failed-logout recovery visible; the missed Delivery
  side-panel title and all explicitly identified current-language declarations
  are corrected. Formal Decision coverage now proves retry-to-archived and the
  proven-active creation control path.
- 2026-08-22: all 20 leaf gates were parent-forced after the corrections. The
  runtime branch passed 5/5 gates, including the full Angular component suite
  and production build. The contract/language branch passed 5/5 gates,
  including both complete adjacent API E2E files on a freshly migrated
  database.
- 2026-08-22: first-pass independent Standards/Spec review reopened final
  closure for unsafe logout diagnostics and stale documentation labels. A
  follow-up adversarial shell review also found that feature-local requests
  from a previous session could race the next user's badges. Red tests proved
  both cross-session races; badge publications and Notification snapshots are
  now session-scoped, while the shell retains the last valid current-user
  count and ignores stale updates. Final review and re-measurement remain open.
- 2026-08-22: final adversarial review reopened `UX-AUDIT-004` for overlapping
  Formal Decision availability retries. A red out-of-order detector proved
  that an older active result could replace a newer archived result. The page
  now accepts only the latest availability request, keeping the UI fail-closed.
