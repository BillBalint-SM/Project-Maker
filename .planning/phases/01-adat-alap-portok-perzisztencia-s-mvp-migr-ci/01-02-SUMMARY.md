---
phase: 01-adat-alap-portok-perzisztencia-s-mvp-migr-ci
plan: 02
subsystem: database

tags: [rxdb, tombstone, soft-delete, migration, typescript, indexeddb, tdd]

# Dependency graph
requires:
  - phase: 01-adat-alap-portok-perzisztencia-s-mvp-migr-ci (plan 01)
    provides: "Envelope<T>/Zod/StoragePort/RxdbStorageAdapter foundation, deletedAt null<->missing-key mapping convention"
provides:
  - "StoragePort.softDelete(id): Promise<void> — tombstone contract"
  - "RxdbStorageAdapter.softDelete() — real tombstone implementation, list() hides tombstoned records, get() still returns them"
  - "ProjectListView Törlés button wired to storage.softDelete(id)"
  - "Proof (db.test.ts) that RxDB's version-keyed migrationStrategies mechanism actually runs (DATA-04), independent of the still-empty production migration chain"
affects: [01-03-backup-restore, 01-04-full-container, 01-05-legacy-migration, phase-2-survey-scoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tombstone soft-delete: list() filters `{ deletedAt: { $exists: false } }`; get() is unfiltered and always returns the raw record including tombstones — never a physical RxDB .remove()"
    - "RxDB addCollections() with a higher schema version + migrationStrategies AUTO-RUNS the migration synchronously before its own promise resolves (RxDB's default autoMigrate: true) — no explicit migratePromise() call is needed to trigger it, only to await/observe an already-in-flight one"

key-files:
  created:
    - src/adapters/storage/indexeddb/db.test.ts
  modified:
    - src/domain/ports/StoragePort.ts
    - src/adapters/storage/indexeddb/StorageAdapter.ts
    - src/adapters/storage/indexeddb/StorageAdapter.test.ts
    - src/features/projects/ProjectListView.tsx
    - src/features/projects/ProjectListView.test.tsx

key-decisions:
  - "db.test.ts proves the migration mechanism via TWO separate createRxDatabase() calls sharing one database name over rxdb/plugins/storage-memory's getRxStorageMemory(), closing (not removing) the first — matching the persistence behavior already documented in 01-01's StorageAdapter.test.ts afterEach comment (memory storage keeps a name-keyed document pool that survives close(), only remove() wipes it)"
  - "The test does NOT explicitly call migratePromise() to trigger the migration — reading the installed rxdb@17.3.0 source (rx-collection.js's createRxCollection()) showed addCollections() already runs 'await collection.migratePromise()' internally when autoMigrate is true (the default) and the new schema version isn't 0, so the migration is already complete by the time addCollections()'s own promise resolves. The test asserts the migrated field's presence directly, plus a follow-up migrationNeeded() === false as secondary confirmation nothing is left pending"

patterns-established: []

requirements-completed: [DATA-03, DATA-04]

coverage:
  - id: D1
    description: "softDelete() tombstones a record (deletedAt/revision/updatedAt/dirty), never physically deletes it — list() hides it, get() still returns it (DATA-03)"
    requirement: "DATA-03"
    verification:
      - kind: unit
        ref: "src/adapters/storage/indexeddb/StorageAdapter.test.ts#softDelete() removes the record from list() but get() still returns it with deletedAt set (tombstone, not physical delete)"
        status: pass
      - kind: unit
        ref: "src/adapters/storage/indexeddb/StorageAdapter.test.ts#softDelete() throws when the id does not exist"
        status: pass
      - kind: other
        ref: "awk '/softDelete\\(/,/^  }/' src/adapters/storage/indexeddb/StorageAdapter.ts | grep -c '\\.remove()' == 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "ProjectListView 'Törlés' button calls storage.softDelete(id) and the row disappears from the rendered list"
    requirement: "DATA-03"
    verification:
      - kind: unit
        ref: "src/features/projects/ProjectListView.test.tsx#clicking \"Törlés\" calls storage.softDelete(id) and the row disappears from the list"
        status: pass
    human_judgment: false
  - id: D3
    description: "RxDB's version-keyed migrationStrategies mechanism is proven to actually run (not just declared), on a synthetic schema, while the production schema stays on an empty chain (DATA-04)"
    requirement: "DATA-04"
    verification:
      - kind: unit
        ref: "src/adapters/storage/indexeddb/db.test.ts#migrates a v0 document forward through migrationStrategies to v1, adding the new required field"
        status: pass
      - kind: other
        ref: "grep -A2 'migrationStrategies' src/adapters/storage/indexeddb/db.ts | grep -c '{}' >= 1"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min
completed: 2026-07-09
status: complete
---

# Phase 01 Plan 02: Tombstone soft-delete + proven RxDB migration mechanism Summary

**Tombstone `softDelete()` on StoragePort/RxdbStorageAdapter with a "Törlés" UI button, plus a synthetic-schema test proving RxDB's `migrationStrategies` mechanism genuinely runs (auto-triggered inside `addCollections()`) while the production schema stays on its intentional empty chain**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-09
- **Tasks:** 2 (both committed; Task 1 is TDD — RED then GREEN)
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments
- `StoragePort.softDelete(id): Promise<void>` — tombstone contract added to the hexagon's persistence seam
- `RxdbStorageAdapter.softDelete()` — upserts `deletedAt`/`revision`/`updatedAt`/`dirty`, never calls RxDB `.remove()`; throws `Project not found: {id}` for a missing id
- `RxdbStorageAdapter.list()` now filters tombstoned records via a Mango selector (`{ deletedAt: { $exists: false } }`); `get()` remains unfiltered, so a tombstone is still directly reachable (DATA-03 — Pitfall 2 in PITFALLS.md, "zombie record" prevention: the physical record survives, only its visibility changes)
- `ProjectListView` gained a "Törlés" button per row that calls `storage.softDelete(id)` then refreshes the list
- `db.test.ts` proves DATA-04's mechanism claim with a real, self-contained two-field synthetic schema going from version 0 → 1 across two separate `createRxDatabase()` calls sharing one name over `getRxStorageMemory()`, discovering along the way that RxDB's `addCollections()` auto-runs the migration synchronously (no manual trigger needed) — the production `projectEnvelopeSchema` (`db.ts`) is untouched and stays `version: 0` / `migrationStrategies: {}`
- 6 new automated tests (2 StorageAdapter tombstone cases, 1 ProjectListView Törlés case, 3-fold... actually 1 db.test.ts migration case); full suite: 29 tests, all green; `tsc --noEmit` and `vite build` both clean

## Task Commits

Each task was committed atomically:

1. **Task 1: softDelete (tombstone) — StoragePort, StorageAdapter, UI** (TDD) - `0b3a4ec` (test, RED) + `e809e38` (feat, GREEN)
2. **Task 2: Verzió-kulcsolt migrationStrategies mechanizmus bizonyítása** - `bef6e3b` (test)

**Plan metadata:** _pending — this commit, see final_commit step_

_Note: Task 1 is a TDD task (`tdd="true"`) — RED (failing tests, `0b3a4ec`) then GREEN (implementation, `e809e38`). No REFACTOR commit was needed; the GREEN implementation was already clean. Task 2 is `type="auto"` (not TDD) — its test file is the deliverable itself (proving a mechanism), committed as a single `test(...)` commit._

## Files Created/Modified
- `src/domain/ports/StoragePort.ts` - added `softDelete(id): Promise<void>` to the interface
- `src/adapters/storage/indexeddb/StorageAdapter.ts` - `softDelete()` implementation (upsert with fresh `deletedAt`/bumped `revision`/`updatedAt`/`dirty: true`, throws on missing id); `list()` now selector-filtered to `{ deletedAt: { $exists: false } }`
- `src/adapters/storage/indexeddb/StorageAdapter.test.ts` - 2 new tests: tombstone round-trip (put → list(1) → softDelete → list(0) → get() still non-null with `deletedAt` set) and throw-on-missing-id
- `src/adapters/storage/indexeddb/db.test.ts` - new file; synthetic 2-field schema (`{id, label}` → `{id, label, note}`), proves RxDB's real migration mechanism runs end-to-end
- `src/features/projects/ProjectListView.tsx` - added a "Törlés" button per row (`handleDelete` calls `storage.softDelete(id)` then `refresh()`)
- `src/features/projects/ProjectListView.test.tsx` - added `softDelete` to the hoisted storage mock and 1 new test for the Törlés click-to-disappear flow

## Decisions Made
- The migration proof test does not call `migratePromise()` to *trigger* migration — inspecting the installed `rxdb@17.3.0` source (`node_modules/rxdb/dist/cjs/rx-collection.js`, `createRxCollection()`) showed `addCollections()` already runs `await collection.migratePromise()` internally whenever `autoMigrate` (default `true`) is set and the new schema's version is not `0`. This runs BEFORE `addCollections()`'s own returned promise resolves, so by the time the test's `await dbV1.addCollections(...)` completes, the migration has already finished. The test asserts the migrated field directly and confirms `migrationNeeded() === false` afterward as secondary proof nothing is left pending, rather than asserting `migrationNeeded() === true` before an explicit trigger (which would be testing a stale/already-resolved cached promise, not the real mechanism).
- Followed 01-01's established `deletedAt` null↔missing-key mapping convention unchanged: `softDelete()` always writes a concrete non-null ISO string, so no null-omission branching was needed inside it (the existing `toPersisted()` helper already handles "write the key when non-null" correctly for this call site, per the plan's explicit guidance).

## Deviations from Plan

None — plan executed exactly as written. The one exploratory detour (confirming RxDB's auto-migration behavior via a throwaway debug script in the scratchpad, then in the repo root, then deleted before committing) was investigation to correctly implement Task 2's own `<action>` text, not a deviation from the plan's requirements; the final `db.test.ts` satisfies every acceptance criterion in the plan as written.

## Issues Encountered
- Initial `db.test.ts` draft asserted `migrationNeeded() === true` immediately before calling `migratePromise()`, expecting to observe a pending migration and then trigger it. This failed because RxDB's `addCollections()` had already run the migration automatically by that point (see Decisions Made above) — `migrationNeeded()` correctly reported `false` because there was nothing left to migrate, yet the document already carried the migrated `note` field. Resolved by removing the premature `migrationNeeded() === true` assertion and asserting the migrated field's presence directly, with a `migrationNeeded() === false` follow-up check instead.
- `pnpm` was not on `PATH` in this environment (only `node`/`npm`); used `corepack pnpm <cmd>` for all test/build/typecheck invocations in this session (functionally identical to `pnpm`, no config or lockfile changes).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `StoragePort` now has `list`/`get`/`put`/`softDelete`; `exportBackup`/`importBackup` remain deliberately absent, to be added by 01-03 per the plan's interface-first, incremental-extension design — do not add them speculatively.
- The tombstone convention (`deletedAt` present = hidden from `list()`, visible via `get()`) is now the load-bearing pattern for any future feature that lists or restores projects (e.g. an "archived projects" view, or 01-03's backup/restore, which must decide whether a full backup includes tombstoned records — likely yes, since backup/restore should be a faithful full dump).
- The migration-mechanism proof (`db.test.ts`) is deliberately isolated from the production schema; if a REAL schema version bump is ever needed for `projectEnvelopeSchema` (in `db.ts`), the pattern to follow is: bump `version`, add a real `migrationStrategies[n]` entry, and know that RxDB will auto-run it the next time `createProjectDatabase()` opens the existing IndexedDB with the bumped schema — no extra wiring needed in `RxdbStorageAdapter` itself.

## Self-Check: PASSED

All modified/created files were verified present on disk (`src/domain/ports/StoragePort.ts`, `src/adapters/storage/indexeddb/StorageAdapter.ts`, `src/adapters/storage/indexeddb/StorageAdapter.test.ts`, `src/adapters/storage/indexeddb/db.test.ts`, `src/features/projects/ProjectListView.tsx`, `src/features/projects/ProjectListView.test.tsx`), and all 3 task commit hashes (`0b3a4ec`, `e809e38`, `bef6e3b`) were verified present in `git log --oneline --all`.

---
*Phase: 01-adat-alap-portok-perzisztencia-s-mvp-migr-ci*
*Completed: 2026-07-09*
