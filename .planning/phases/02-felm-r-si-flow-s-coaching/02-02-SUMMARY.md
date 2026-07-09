---
phase: 02-felm-r-si-flow-s-coaching
plan: 02
subsystem: database
tags: [rxdb, zod, migration, domain-model]

# Dependency graph
requires:
  - phase: 01-adat-alap-portok-perzisztencia-es-mvp-migracio
    provides: "Domain model (Project/ProjectSchema/createEmptyProject), RxDB StoragePort adapter, legacy MIG-01 import path"
provides:
  - "Project.playbookId: string (required, non-empty) — the SURVEY-04 data foundation"
  - "CURRENT_APP_SCHEMA_VERSION = 2 (domain-level; first non-empty migration)"
  - "RxDB projectEnvelopeSchema.version = 1 + migrationStrategies[1] backfilling playbookId: \"general\" on every Phase-1 document"
  - "legacyImport.ts playbookId backfill so the stricter ProjectSchema does not regress MIG-01"
  - "createEmptyProject(playbookId, overrides?) mandatory-first-param factory signature"
affects: [02-03, 02-05, 02-06, 02-07, 02-08]

# Tech tracking
tech-stack:
  added: []
  patterns: ["RxDB migrationStrategies[N] keyed by target version, registered via addRxPlugin(RxDBMigrationSchemaPlugin) in the production module (db.ts), not only in test files", "Backfill-before-Zod-validate pattern for legacy import boundaries when a field becomes newly required"]

key-files:
  created: []
  modified:
    - src/domain/model/types.ts
    - src/domain/model/schema.ts
    - src/domain/model/factory.ts
    - src/domain/model/envelope.ts
    - src/adapters/storage/indexeddb/db.ts
    - src/adapters/storage/indexeddb/StorageAdapter.test.ts
    - src/adapters/storage/indexeddb/backup.test.ts
    - src/adapters/migration/legacyImport.ts
    - src/adapters/migration/legacyImport.test.ts
    - src/features/projects/ProjectListView.tsx

key-decisions:
  - "createEmptyProject's playbookId is a mandatory FIRST positional parameter, never folded into overrides or given a silent default — enforces D-03 explicit-choice even though only \"general\" exists today"
  - "The 3 existing createEmptyProject(...) call sites were updated to pass the literal \"general\" as a deliberately transitional value — 02-05-PLAN.md's real playbook-select create flow replaces this literal"
  - "RxDBMigrationSchemaPlugin is now registered in db.ts itself (production module), not only in test files — otherwise the migration would never run in real browser/IndexedDB usage, only under test"
  - "The Task 2 migration test exercises the ACTUAL production createProjectDatabase() function (same \"project-maker\" db name, sequential create/close/reopen) rather than a duplicated migrationStrategies object, so the test proves the real code path"
  - "legacyImport.ts backfills playbookId immediately after JSON.parse, before ProjectSchema.safeParse — mirrors db.ts's RxDB-level backfill at a second, independent data-entry point (never-persisted legacy JSON blobs vs. already-persisted RxDB documents)"

requirements-completed: [SURVEY-04]

coverage:
  - id: D1
    description: "Project.playbookId is a required, non-empty Zod-validated field on the domain model; createEmptyProject() requires it as an explicit first parameter with no silent default"
    requirement: SURVEY-04
    verification:
      - kind: unit
        ref: "pnpm exec tsc --noEmit (acceptance-criteria greps: playbookId: string in types.ts, playbookId: z.string in schema.ts, createEmptyProject(playbookId: string in factory.ts) - all pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Phase-1 RxDB document persisted before playbookId existed is transparently migrated to playbookId: \"general\" on next open, via projectEnvelopeSchema.version 0->1 + migrationStrategies[1], without any other field changing"
    requirement: SURVEY-04
    verification:
      - kind: unit
        ref: "src/adapters/storage/indexeddb/StorageAdapter.test.ts > RxdbStorageAdapter — production migrationStrategies[1] (playbookId backfill) > migrates a v0 document (no playbookId) to playbookId: \"general\" via the real createProjectDatabase() migration, leaving other fields untouched - pass; confirmed RED (ZodError on data.playbookId) with version/migrationStrategies temporarily reverted, then GREEN restored"
        status: pass
    human_judgment: false
  - id: D3
    description: "The legacy MIG-01 import path (legacyImport.ts) still successfully imports previously-valid rows despite ProjectSchema now requiring playbookId, via a backfill inserted before Zod validation; genuinely invalid rows (missing name) still fail"
    requirement: SURVEY-04
    verification:
      - kind: unit
        ref: "src/adapters/migration/legacyImport.test.ts (7 tests, incl. new 'backfills playbookId: general on every imported row') + legacyImport.integration.test.ts (1 test) - all pass; confirmed RED via the natural Task-1 regression (4/5 existing tests failed with ZodError on data.playbookId before the fix), then GREEN after the backfill"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-07-09
status: complete
---

# Phase 2 Plan 02: Project.playbookId Domain Field + RxDB/Legacy Migration Summary

**Introduced `Project.playbookId` (SURVEY-04 data foundation) as the app's first non-empty schema migration — RxDB `migrationStrategies[1]` backfills persisted Phase-1 documents, and a parallel `legacyImport.ts` backfill prevents the stricter `ProjectSchema` from regressing the existing MIG-01 legacy-import path.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-09
- **Tasks:** 3/3
- **Files modified:** 10

## Accomplishments
- `Project.playbookId: string` added to `types.ts`/`schema.ts` (Zod `z.string().min(1)`); `CURRENT_APP_SCHEMA_VERSION` bumped 1 → 2 with a doc-comment explaining this is the domain level's first real migration
- `createEmptyProject(playbookId, overrides?)` now requires `playbookId` as a mandatory first positional parameter (no silent default, per D-03); all 3 existing call sites updated to pass the transitional literal `"general"`
- RxDB `projectEnvelopeSchema.version` bumped 0 → 1 with `migrationStrategies[1]` backfilling `data.playbookId = "general"` on every pre-existing document; `RxDBMigrationSchemaPlugin` now registered in `db.ts` itself (not only test files) so the migration actually runs in production/browser use
- A new test in `StorageAdapter.test.ts` proves the migration against the REAL `createProjectDatabase()` production function (not a duplicated migration object) — confirmed RED (ZodError) with the migration temporarily reverted, then GREEN
- `legacyImport.ts` backfills `playbookId: "general"` on parsed legacy rows before Zod validation, restoring the pre-Task-1 import counts (`imported=3`, `skippedInvalid=1`) that the stricter schema would otherwise have regressed
- Full `pnpm run checkpoint` (typecheck + 50-test suite + build) green after all three tasks

## Task Commits

Each task was committed atomically (Tasks 2 and 3 as separate test/feat commits per `tdd="true"`):

1. **Task 1: playbookId mező hozzáadása a domain-modellhez** - `e97f83c` (feat)
2. **Task 2: RxDB séma-verzió bump + migrationStrategies[1]** - `c068248` (test, RED) + `90483c3` (feat, GREEN)
3. **Task 3: Legacy MIG-01 import playbookId-backfill** - `378e1f1` (test, RED) + `e6f7344` (feat, GREEN)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS update)

## Files Created/Modified
- `src/domain/model/types.ts` - Added `playbookId: string` to the `Project` interface
- `src/domain/model/schema.ts` - Added `playbookId: z.string().min(1)` to `ProjectSchema`
- `src/domain/model/factory.ts` - `createEmptyProject` signature changed to require `playbookId` as the first parameter
- `src/domain/model/envelope.ts` - `CURRENT_APP_SCHEMA_VERSION` 1 → 2, doc-comment explaining the migration
- `src/adapters/storage/indexeddb/db.ts` - `projectEnvelopeSchema.version` 0 → 1, `migrationStrategies[1]` playbookId backfill, `RxDBMigrationSchemaPlugin` registered in the production module
- `src/adapters/storage/indexeddb/StorageAdapter.test.ts` - Updated `buildEnvelope()` helper call site; new describe block proving the production migration
- `src/adapters/storage/indexeddb/backup.test.ts` - Updated `buildEnvelope()` helper call site
- `src/adapters/migration/legacyImport.ts` - playbookId backfill inserted between `JSON.parse` and `ProjectSchema.safeParse`
- `src/adapters/migration/legacyImport.test.ts` - New test asserting the backfill on every imported row
- `src/features/projects/ProjectListView.tsx` - `handleAddTestProject` updated to pass `"general"` as the new mandatory first argument

## Decisions Made
- `createEmptyProject`'s `playbookId` is mandatory and positional — never folded into `overrides`, never defaulted — per D-03's "véglegesség" principle; the 3 existing call sites pass the literal `"general"` as an explicitly transitional value until 02-05's real playbook-select create flow replaces it.
- Registered `RxDBMigrationSchemaPlugin` in `db.ts` itself, not only in test files — the migration must actually run for real browser/IndexedDB users, not just under Vitest.
- The Task 2 migration test reuses the shared `"project-maker"` database name (the same name `createProjectDatabase()` always opens) so it can call the actual production function directly, rather than duplicating its `migrationStrategies` object — this keeps the test coupled to the real code path, catching future edits to db.ts automatically.
- `legacyImport.ts`'s backfill mirrors the RxDB migration's default ("general") at a structurally different data-entry point (never-persisted JSON blob vs. already-persisted RxDB document) — both needed independent fixes because they never share a code path.

## Deviations from Plan

None - plan executed exactly as written, including the TDD RED/GREEN gate sequencing for Tasks 2 and 3 (both confirmed RED via temporary reversion/natural regression before the GREEN implementation commit).

## Issues Encountered
None - `corepack pnpm` continued to resolve correctly for all commands (`tsc --noEmit`, `vitest run`, `pnpm run checkpoint`), consistent with 02-01's finding.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `Project.playbookId` is now a durable, migrated, required field across both live RxDB storage and the legacy import path — 02-03 (domain scoring engine) can safely read `project.playbookId` to parameterize readiness/decision calculations per playbook.
- The transitional `"general"` literal in `ProjectListView.tsx`'s `handleAddTestProject` and the two test helpers is explicitly a placeholder for 02-05's real playbook-select create flow — no other plan should introduce a new `createEmptyProject(...)` call site without an explicit playbook choice.
- No blockers identified for downstream plans.

---
*Phase: 02-felm-r-si-flow-s-coaching*
*Completed: 2026-07-09*

## Self-Check: PASSED

- FOUND: src/domain/model/types.ts
- FOUND: src/domain/model/schema.ts
- FOUND: src/domain/model/factory.ts
- FOUND: src/domain/model/envelope.ts
- FOUND: src/adapters/storage/indexeddb/db.ts
- FOUND: src/adapters/migration/legacyImport.ts
- FOUND: .planning/phases/02-felm-r-si-flow-s-coaching/02-02-SUMMARY.md
- FOUND: e97f83c (Task 1 commit)
- FOUND: c068248 (Task 2 RED test commit)
- FOUND: 90483c3 (Task 2 GREEN feat commit)
- FOUND: 378e1f1 (Task 3 RED test commit)
- FOUND: e6f7344 (Task 3 GREEN feat commit)
