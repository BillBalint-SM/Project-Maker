---
phase: 01-adat-alap-portok-perzisztencia-s-mvp-migr-ci
fixed_at: 2026-07-09T21:12:00Z
review_path: .planning/phases/01-adat-alap-portok-perzisztencia-s-mvp-migr-ci/01-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-07-09T21:12:00Z
**Source review:** .planning/phases/01-adat-alap-portok-perzisztencia-s-mvp-migr-ci/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (fix_scope: critical_warning — CR-01, WR-01 through WR-06; IN-01/IN-02/IN-03 excluded by scope)
- Fixed: 7
- Skipped: 0

**Note on this run:** All 7 in-scope findings already had dedicated, correctly-scoped commits present in the branch history when this fixer instance started (see commit hashes below). This indicates a prior fixer run applied and committed every fix but did not complete its REVIEW-FIX.md write (consistent with the `partial_success` failure mode: per-finding commits are self-contained and valid even if the reporting step is interrupted). This run independently re-read each modified file end-to-end, confirmed every fix matches its REVIEW.md finding and is intact (no corruption/partial edits), and re-ran verification (`npm run typecheck` — clean; `npm test` — 15 files / 48 tests passed) against the current `main` HEAD. No new commits were made; no further code changes were needed.

## Fixed Issues

### CR-01: `ProjectListView`'s `refresh()` has no error handling — one invalid record permanently blanks the entire list with no user feedback

**Files modified:** `src/features/projects/ProjectListView.tsx`
**Commit:** `e3d87d5`
**Applied fix:** `refresh()` now wraps `getStorage()`/`storage.list()`/`setProjects()` in `try/catch` and surfaces failures via `setError(...)`, matching the pattern already used by `handleExportBackup`/`handleRestoreFileChange`. Verified present at lines 30-38 of the current file; `useEffect` still calls bare `refresh()` but the promise no longer rejects unhandled since the function itself no longer throws.

### WR-01: `handleAddTestProject()` / `handleDelete()` have no error handling, unlike the export/restore handlers

**Files modified:** `src/features/projects/ProjectListView.tsx`
**Commit:** `5546f23`
**Applied fix:** Both handlers now call `setError("")` up front and wrap their storage calls (`storage.put()`, `storage.softDelete()`) in `try/catch`, setting a Hungarian-language error banner message (`Teszt-projekt létrehozása sikertelen: ...` / `Törlés sikertelen: ...`) on failure, consistent with `handleExportBackup`/`handleRestoreFileChange`.

### WR-02: No invariant enforced between `Envelope.id` (storage key) and `Envelope.data.id` (domain payload id)

**Files modified:** `src/adapters/storage/indexeddb/StorageAdapter.ts`, `src/adapters/storage/indexeddb/backup.ts`, `src/adapters/storage/memory/InMemoryStorageAdapter.ts`
**Commit:** `47e23b4`
**Applied fix:** `RxdbStorageAdapter.put()` now throws `Envelope id (...) does not match data.id (...)` immediately after Zod validation if the two diverge. `InMemoryStorageAdapter.put()` mirrors the identical check so both `StoragePort` implementations enforce the invariant consistently. `parseBackup()` in `backup.ts` also validates this cross-field invariant per backup entry (in addition to its own schemaVersion check — see WR-06), rejecting the whole restore with a descriptive per-index error if any entry's `id`/`data.id` disagree, so a divergent record can never be silently imported either.

### WR-03: `RxdbStorageAdapter.put()` unconditionally sets `dirty: true`, silently overriding `legacyImport.ts`'s documented `dirty: false` intent

**Files modified:** `src/adapters/migration/legacyImport.ts`
**Commit:** `591a826`
**Applied fix:** `legacyImport.ts` now sets `dirty: true` on the constructed envelope with an explanatory comment noting that `RxdbStorageAdapter.put()` unconditionally overrides this field regardless of what is passed, so the literal no longer claims a `dirty: false` guarantee the code cannot deliver. This matches the review's "preferred, least invasive" option (drop the misleading claim rather than change `put()`'s override behavior).

### WR-04: `RxdbStorageAdapter.put()`'s revision bump is a non-atomic read-modify-write (lost-update race)

**Files modified:** `src/adapters/storage/indexeddb/StorageAdapter.ts`
**Commit:** `9a6842d`
**Applied fix:** The existing-document branch of `put()` now calls `existing.incrementalModify(...)` instead of a separate `findOne()` read followed by a distinct `collection.upsert()` write. RxDB queues `incrementalModify()` calls per-document, so the mutation function always runs against the latest written state, closing the lost-update race described in the finding. A code comment documents why this closes the race. The first-write (`!existing`) branch is unaffected since there is no prior revision to race against.

### WR-05: `importBackup()`'s documented "atomic, all-or-nothing" guarantee only covers validation, not the write loop itself

**Files modified:** `src/adapters/storage/indexeddb/StorageAdapter.ts`, `src/domain/ports/StoragePort.ts`
**Commit:** `0ff1875`
**Applied fix:** Took the review's alternative (narrow-the-contract) option rather than switching to `bulkUpsert()`. `StoragePort.importBackup()`'s doc comment now explicitly states the "zero writes" guarantee covers validation failures only and does not extend to write-phase failures (storage-schema constraints, IndexedDB write/quota errors), noting there is no write-phase transaction/rollback. `RxdbStorageAdapter.importBackup()`'s inline comment was expanded to match, so callers can no longer read the code as promising more than it delivers.

### WR-06: Backup restore never checks the backup's `schemaVersion` against `CURRENT_APP_SCHEMA_VERSION`

**Files modified:** `src/adapters/storage/indexeddb/backup.ts`
**Commit:** `9aa8534`
**Applied fix:** `parseBackup()` now checks the top-level `schemaVersion` against `CURRENT_APP_SCHEMA_VERSION` immediately after JSON parsing and throws `Unsupported backup schema version: ... (expected ...)` on mismatch — before any per-entry Zod validation runs. It additionally checks each entry's own `schemaVersion` field (in case a hand-edited/partially-migrated backup has a stale top-level stamp but a divergent per-entry value), collecting per-index issues alongside the existing shape-validation and id/data.id checks.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-07-09T21:12:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
