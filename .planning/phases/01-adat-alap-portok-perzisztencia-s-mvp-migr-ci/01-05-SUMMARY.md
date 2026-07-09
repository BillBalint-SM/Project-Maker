---
phase: 01-adat-alap-portok-perzisztencia-s-mvp-migr-ci
plan: 05
subsystem: database

tags: [zod, rxdb, migration, typescript, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-adat-alap-portok-perzisztencia-s-mvp-migr-ci (plan 01)
    provides: "Envelope<T> / ProjectSchema / StoragePort / RxdbStorageAdapter / createStorageAdapter (container.ts) — the persistence stack this plan imports into"
provides:
  - "importLegacyExport(rows, storage) — parse + Zod-validate + idempotent, non-destructive import of the legacy Tauri-MVP {id,data} row shape into the web StoragePort (MIG-01)"
  - "InMemoryStorageAdapter — fast, RxDB-free StoragePort test double implementing the full current interface (list/get/put/softDelete)"
  - "src/test/fixtures/legacy-export-fixture.json — realistic synthetic legacy export fixture (4 rows, 1 intentionally invalid)"
affects: [phase-1-uat, future-real-tauri-migration-ux]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Row-independent import loop: JSON.parse + ProjectSchema.safeParse per row inside a for-loop, one bad row appended to skippedInvalid and the loop continues — never a hard throw that aborts the batch"
    - "Idempotency via storage.get(id) existence-check before storage.put(), never overwrite-on-exists"
    - "Envelope-level deletedAt (sync tombstone) kept strictly separate from domain-level data.archivedAt (legacy business field) — both can coexist on the same imported record without being conflated"

key-files:
  created:
    - src/adapters/migration/legacyImport.ts
    - src/adapters/migration/legacyImport.test.ts
    - src/adapters/migration/legacyImport.integration.test.ts
    - src/adapters/storage/memory/InMemoryStorageAdapter.ts
    - src/test/fixtures/legacy-export-fixture.json
  modified: []

key-decisions:
  - "InMemoryStorageAdapter implements the FULL current StoragePort interface (list/get/put/softDelete), not just list/get/put as the plan's action text assumed — StoragePort already gained softDelete in 01-02, before this plan ran, so a test double declaring `implements StoragePort` must satisfy the interface as it exists today, not as the plan text described it at authoring time"
  - "Fixture loaded via a native ESM JSON import (`import fixtureRows from '...legacy-export-fixture.json'`, tsconfig `resolveJsonModule: true`) rather than `fs.readFileSync(fileURLToPath(...))` — the latter threw `TypeError: The URL must be of scheme file` under this project's Vitest/Vite transform pipeline; the JSON-import approach is also simpler and matches how Vite already resolves JSON assets elsewhere"

patterns-established:
  - "Legacy-migration import functions take `storage: Pick<StoragePort, 'get' | 'put'>` (not the full StoragePort) — the narrowest capability slice a migration function actually needs, making it impossible for a migration path to accidentally call softDelete/list"

requirements-completed: [MIG-01]

coverage:
  - id: D1
    description: "importLegacyExport() imports valid legacy rows and reports Zod-invalid rows without aborting the batch (T-01-05-01 mitigation)"
    requirement: "MIG-01"
    verification:
      - kind: unit
        ref: "src/adapters/migration/legacyImport.test.ts#imports valid rows, reports invalid rows, and reports zero already-exists on a fresh storage"
        status: pass
      - kind: unit
        ref: "src/adapters/migration/legacyImport.test.ts#does not let one invalid row block import of the other valid rows"
        status: pass
    human_judgment: false
  - id: D2
    description: "Import is idempotent and non-destructive: a second run against the same storage imports nothing new and never overwrites"
    requirement: "MIG-01"
    verification:
      - kind: unit
        ref: "src/adapters/migration/legacyImport.test.ts#is idempotent: running the same fixture twice against the same storage imports nothing new the second time"
        status: pass
      - kind: integration
        ref: "src/adapters/migration/legacyImport.integration.test.ts#imports the 3 valid fixture rows into real IndexedDB-path persistence, then confirms idempotency on a second run"
        status: pass
    human_judgment: false
  - id: D3
    description: "Imported record data is preserved field-for-field, including Hungarian-accented fields, and the migration path never tombstones (softDelete never called)"
    requirement: "MIG-01"
    verification:
      - kind: unit
        ref: "src/adapters/migration/legacyImport.test.ts#preserves accented Hungarian fields byte-for-byte through the import"
        status: pass
      - kind: unit
        ref: "src/adapters/migration/legacyImport.test.ts#never calls storage.softDelete — migration import never tombstones"
        status: pass
    human_judgment: false
  - id: D4
    description: "The same import logic proven end-to-end through the real Envelope + Zod + RxDB persistence stack (not just the InMemoryStorageAdapter test double)"
    requirement: "MIG-01"
    verification:
      - kind: integration
        ref: "src/adapters/migration/legacyImport.integration.test.ts#imports the 3 valid fixture rows into real IndexedDB-path persistence, then confirms idempotency on a second run"
        status: pass
    human_judgment: false

# Metrics
duration: ~10min
completed: 2026-07-09
status: complete
---

# Phase 01 Plan 05: Legacy Tauri-MVP migration import (MIG-01) Summary

**`importLegacyExport()` — Zod-validated, idempotent, non-destructive import of the legacy Tauri-MVP `{id, data}` JSON-blob row format into the web StoragePort, proven on a synthetic Hungarian-accented fixture against both a fast in-memory test double and the real RxDB-backed adapter**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-09
- **Tasks:** 2 (Task 1: TDD RED+GREEN; Task 2: standalone integration test)
- **Files modified:** 5 (all created)

## Accomplishments
- `importLegacyExport(rows, storage)` parses each legacy `{id, data}` row, Zod-validates the parsed payload against `ProjectSchema`, and either imports it as a fresh `Envelope<Project>` or skips it (already-exists / invalid) — one bad row never blocks the rest of the batch (MIG-01, T-01-05-01 mitigation)
- Proven idempotent and non-destructive: running the same fixture twice against the same storage produces zero duplicate writes and zero overwrites, verified against both `InMemoryStorageAdapter` (fast unit test) and the real `RxdbStorageAdapter` via `createStorageAdapter()` (integration test)
- Synthetic, realistic fixture (`legacy-export-fixture.json`) with 4 rows: a fully-filled project with Hungarian-accented fields (`customerOrOrganization: "Székesfehérvári Önkormányzat"`, an accented `businessProblem` sentence), a minimally-filled fresh project, an already-archived project (`archivedAt` set), and one intentionally invalid row (missing the required `name` field) — the byte-for-byte preservation of accented fields through the import is directly asserted
- `InMemoryStorageAdapter` — new fast, RxDB-free `StoragePort` test double for this plan's own unit tests
- Envelope-level `deletedAt` (sync tombstone) is kept strictly independent from domain-level `data.archivedAt` — the migration never tombstones (`softDelete` is provably never called)

## Task Commits

Each task was committed atomically:

1. **Task 1: legacyImport.ts — parse+Zod-validáció+idempotens import, szintetikus fixtúrán** - `1f7efba` (test, RED) + `faea05e` (feat, GREEN)
2. **Task 2: Integrációs teszt a valós RxDB-alapú StorageAdapter ellen** - `de1758d` (test)

**Plan metadata:** _pending — this commit, see final_commit step_

_Note: Task 1 is a TDD task (`tdd="true"`) — RED (`legacyImport.test.ts` + fixture, failing because `legacyImport.ts`/`InMemoryStorageAdapter.ts` did not yet exist, confirmed via a temporary file-move) then GREEN (both implementation files, all 5 assertions passing). No REFACTOR commit was needed. Task 2 has no `tdd` attribute in the plan and is a single test-only commit, consistent with its `<files_modified>` scope (one file, no corresponding production code to pair it with — it exercises already-existing `container.ts`/`legacyImport.ts`)._

## Files Created/Modified
- `src/adapters/migration/legacyImport.ts` - `importLegacyExport(rows, storage)`, `LegacyProjectRow`, `LegacyImportResult` — row-independent parse+Zod-validate+idempotent import
- `src/adapters/migration/legacyImport.test.ts` - 5 unit tests against `InMemoryStorageAdapter` (fresh-storage counts, idempotent second run, partial-success on invalid row, byte-exact accented-field preservation, softDelete never invoked)
- `src/adapters/migration/legacyImport.integration.test.ts` - 1 integration test against the real `RxdbStorageAdapter` via `createStorageAdapter()` + `getRxStorageMemory()`, proving idempotency and correct `list()` output through the full persistence stack
- `src/adapters/storage/memory/InMemoryStorageAdapter.ts` - `InMemoryStorageAdapter implements StoragePort` (list/get/put/softDelete) backed by a `Map<string, Envelope<Project>>`
- `src/test/fixtures/legacy-export-fixture.json` - 4-row synthetic legacy export fixture (3 valid incl. Hungarian-accented and archived projects, 1 intentionally invalid)

## Decisions Made
- `InMemoryStorageAdapter` implements the full current `StoragePort` (including `softDelete`), not just `list`/`get`/`put` as the plan's action text described — `StoragePort` already gained `softDelete` in the prior 01-02 plan (confirmed by reading `src/domain/ports/StoragePort.ts` and `src/adapters/storage/indexeddb/StorageAdapter.ts` before writing), so any class declaring `implements StoragePort` must satisfy the interface's actual current shape, not a stale description of an earlier interface version. `importLegacyExport()` itself still only requires `Pick<StoragePort, "get" | "put">`, so this does not widen the migration function's own capability surface.
- Fixture is loaded via a native ESM JSON import (`import fixtureRows from ".../legacy-export-fixture.json"`, enabled by `tsconfig.json`'s existing `resolveJsonModule: true`) rather than `fs.readFileSync(fileURLToPath(new URL(...)))` — the latter threw `TypeError: The URL must be of scheme file` under this project's Vite/Vitest transform pipeline. The JSON-import approach needed no new configuration and is simpler.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] InMemoryStorageAdapter must implement `softDelete`, not just `list`/`get`/`put`**
- **Found during:** Task 1 (writing `InMemoryStorageAdapter.ts`)
- **Issue:** The plan's action text says "01-01 óta a StoragePort csak ezt a 3 metódust deklarálja" (StoragePort has declared only 3 methods since 01-01) and explicitly instructs NOT to implement `softDelete`. Reading the actual current `src/domain/ports/StoragePort.ts` (as instructed by the plan's own `<read_first>` for Task 2, and cross-checked against `RxdbStorageAdapter.ts`) shows the interface already has a 4th method, `softDelete(id)`, added by the already-completed 01-02 plan. A class declaring `implements StoragePort` without implementing `softDelete` fails to typecheck.
- **Fix:** Added a minimal `softDelete(id)` to `InMemoryStorageAdapter` (tombstone semantics matching `RxdbStorageAdapter`'s: throws if not found, sets `deletedAt`, bumps `revision`/`updatedAt`, sets `dirty: true`). `list()` also filters on `deletedAt === null` to stay consistent with the tombstone contract, even though no test in this plan exercises `list()` or `softDelete()` directly.
- **Files modified:** `src/adapters/storage/memory/InMemoryStorageAdapter.ts`
- **Verification:** `tsc --noEmit` clean; full test suite (43 tests) green.
- **Committed in:** `faea05e` (Task 1 GREEN commit)

**2. [Rule 3 - Blocking] Fixture loading via `fs.readFileSync` + `fileURLToPath` failed under Vitest**
- **Found during:** Task 1 (first GREEN verification run of `legacyImport.test.ts`)
- **Issue:** `fileURLToPath(new URL("../../test/fixtures/legacy-export-fixture.json", import.meta.url))` threw `TypeError: The URL must be of scheme file` when the test file ran through this project's Vite/Vitest transform pipeline (Vite rewrites `import.meta.url` in a way that is not a plain `file://` URL in this setup).
- **Fix:** Switched both `legacyImport.test.ts` and `legacyImport.integration.test.ts` to a native ESM default import of the JSON fixture (`import fixtureRows from "../../test/fixtures/legacy-export-fixture.json"`), relying on `tsconfig.json`'s pre-existing `resolveJsonModule: true`. No `node:fs`/`node:url` imports needed.
- **Files modified:** `src/adapters/migration/legacyImport.test.ts`, `src/adapters/migration/legacyImport.integration.test.ts`
- **Verification:** Both test files pass; `tsc --noEmit` clean.
- **Committed in:** `1f7efba` (Task 1 RED commit, test file authored this way from the start after the fix) and `de1758d` (Task 2 commit, same pattern reused)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking issues)
**Impact on plan:** Both fixes were necessary preconditions for the plan's own `<verify>`/`<acceptance_criteria>` commands to pass at all. No architectural changes, no scope creep — the `softDelete` addition matches an already-completed sibling plan's interface change, and the fixture-loading fix is a test-infrastructure detail with no production-code impact.

## Issues Encountered
None beyond the two auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MIG-01 is fully delivered within its D-01/D-02 scope (format/import-logic only, on a synthetic fixture; no live migration UX or Tauri-side export button — both explicitly deferred per 01-CONTEXT.md).
- `importLegacyExport()` is ready to be wired into a future real migration UX (a "Import legacy backup" button reading an actual uploaded/exported file) whenever that becomes in-scope — it already accepts the exact `LegacyProjectRow[]` shape a real file-read would produce.
- This was the last plan in Wave 2 of Phase 01; Phase 01 overall UAT/verification is the next step after this plan's state/roadmap bookkeeping completes.

## Self-Check: PASSED

All 5 created files were verified present on disk; all 3 task commit hashes (`1f7efba`, `faea05e`, `de1758d`) were verified present in `git log --oneline --all`.

---
*Phase: 01-adat-alap-portok-perzisztencia-s-mvp-migr-ci*
*Completed: 2026-07-09*
