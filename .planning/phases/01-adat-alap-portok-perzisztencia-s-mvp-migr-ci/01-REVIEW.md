---
phase: 01-adat-alap-portok-perzisztencia-s-mvp-migr-ci
reviewed: 2026-07-09T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - src/adapters/llm/noop.test.ts
  - src/adapters/llm/noop.ts
  - src/adapters/migration/legacyImport.integration.test.ts
  - src/adapters/migration/legacyImport.test.ts
  - src/adapters/migration/legacyImport.ts
  - src/adapters/storage/indexeddb/StorageAdapter.test.ts
  - src/adapters/storage/indexeddb/StorageAdapter.ts
  - src/adapters/storage/indexeddb/backup.test.ts
  - src/adapters/storage/indexeddb/backup.ts
  - src/adapters/storage/indexeddb/db.test.ts
  - src/adapters/storage/indexeddb/db.ts
  - src/adapters/storage/memory/InMemoryStorageAdapter.ts
  - src/adapters/sync/noop.test.ts
  - src/adapters/sync/noop.ts
  - src/app/container.test.ts
  - src/app/container.ts
  - src/domain/model/envelope.ts
  - src/domain/model/factory.ts
  - src/domain/model/schema.ts
  - src/domain/model/types.ts
  - src/domain/ports/ContentPort.ts
  - src/domain/ports/ExportPort.ts
  - src/domain/ports/LlmPort.ts
  - src/domain/ports/StoragePort.ts
  - src/domain/ports/SyncPort.ts
  - src/features/projects/ProjectListView.test.tsx
  - src/features/projects/ProjectListView.tsx
  - src/main.tsx
  - src/test/fixtures/legacy-export-fixture.json
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-07-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Reviewed the hexagonal-architecture data/persistence layer introduced in this
phase: domain model + Zod schemas, the RxDB-backed `StoragePort`
implementation, backup export/import, legacy-MVP migration import, the
Noop LLM/Sync adapters, the composition root, and the walking-skeleton
`ProjectListView`. `npm run typecheck` and the full existing test suite
(`vitest run`, 12 files / 40 tests) both pass, and the code is generally
well-commented with explicit invariants. However, several of those
documented invariants are not actually enforced or are silently overridden
elsewhere in the same phase, and the walking-skeleton UI has an unguarded
read path that can turn a single bad record into a permanently broken
project list with zero user feedback. Findings below are grouped by
severity; each includes a concrete file/line and a fix.

## Critical Issues

### CR-01: `ProjectListView`'s `refresh()` has no error handling — one invalid record permanently blanks the entire list with no user feedback

**File:** `src/features/projects/ProjectListView.tsx:30-38`
**Issue:**
```ts
const refresh = useCallback(async () => {
  const storage = await getStorage();
  const items = await storage.list();
  setProjects(items);
}, []);

useEffect(() => {
  refresh();
}, [refresh]);
```
`RxdbStorageAdapter.list()` (`src/adapters/storage/indexeddb/StorageAdapter.ts:77-91`) is intentionally strict per DATA-05: it runs `ProjectEnvelopeSchema.parse()` over *every* stored document and throws on the first invalid one. That is a reasonable storage-layer contract, but `refresh()` calls `storage.list()` with no `try/catch`, and it is invoked bare (not awaited/caught) from `useEffect` on mount and after every `handleAddTestProject()`/`handleDelete()`. The moment any single document in IndexedDB fails Zod validation — a corrupted browser record, a partially-written legacy import, a future schema-mismatch — `list()` rejects, `refresh()` becomes an unhandled promise rejection, `setProjects` is never called, and the UI is stuck showing an empty/stale list forever. There is no error banner (unlike `handleExportBackup`/`handleRestoreFileChange`, which do have `try/catch` + `setError`), and every subsequent add/delete action silently fails to refresh too, because they all funnel through the same unguarded `refresh()`.
**Fix:** Wrap `refresh()` in `try/catch` and surface the failure the same way the export/restore handlers already do:
```ts
const refresh = useCallback(async () => {
  try {
    const storage = await getStorage();
    const items = await storage.list();
    setProjects(items);
  } catch (err) {
    setError(`Projektlista betöltése sikertelen: ${errorMessage(err)}`);
  }
}, []);
```

## Warnings

### WR-01: `handleAddTestProject()` / `handleDelete()` have no error handling, unlike the export/restore handlers

**File:** `src/features/projects/ProjectListView.tsx:40-67`
**Issue:** `handleExportBackup` and `handleRestoreFileChange` both wrap their storage calls in `try/catch` and call `setError(...)` on failure. `handleAddTestProject` and `handleDelete` do not:
```ts
async function handleDelete(id: string) {
  const storage = await getStorage();
  await storage.softDelete(id); // throws "Project not found: {id}" if id doesn't exist
  await refresh();
}
```
If `softDelete()` throws (e.g. the id/`data.id` mismatch described in WR-02, or a race with another delete), the click handler rejects silently — no error banner, and the row may stay in the table with no indication anything went wrong.
**Fix:** Apply the same `try/catch` + `setError` pattern used elsewhere in this file:
```ts
async function handleDelete(id: string) {
  setError("");
  try {
    const storage = await getStorage();
    await storage.softDelete(id);
    await refresh();
  } catch (err) {
    setError(`Törlés sikertelen: ${errorMessage(err)}`);
  }
}
```

### WR-02: No invariant enforced between `Envelope.id` (storage key) and `Envelope.data.id` (domain payload id) — `ProjectListItem.id` is derived from the latter but `get()`/`put()`/`softDelete()` key off the former

**File:** `src/adapters/storage/indexeddb/StorageAdapter.ts:45-63`, also duplicated in `src/adapters/storage/memory/InMemoryStorageAdapter.ts:66-85`
**Issue:**
```ts
function toProjectListItem(data: Project): ProjectListItem {
  return {
    id: data.id, // <- Project's own embedded id, NOT the envelope's storage key
    ...
  };
}
```
Every `StoragePort` method that takes an `id` (`get`, `put`'s implicit primary key, `softDelete`) resolves it against the RxDB collection's `primaryKey: "id"`, which is the **envelope-level** `id` (see `db.ts:27`). `list()`, however, returns `ProjectListItem.id` sourced from `envelope.data.id` — the *domain payload's own* `id` field. `ProjectListView.tsx:159` then feeds that `ProjectListItem.id` straight into `handleDelete(project.id)` → `storage.softDelete(id)`, assuming it is a valid storage key.

Today the two values happen to always match by construction (`factory.ts`'s `createEmptyProject` and `legacyImport.ts` both set `data.id` and `envelope.id` from the same source), but nothing — not the Zod schema (`createEnvelopeSchema` in `schema.ts:149-160`), not `RxdbStorageAdapter.put()`, not `parseBackup()` — actually checks or enforces `envelope.id === envelope.data.id`. Any future write path (an edit feature, a hand-crafted backup, a legacy row whose DB-column id differs from its embedded JSON id) that lets them diverge will make delete/lookup either throw "Project not found" or silently operate on the wrong record, with no validation error anywhere to catch it (contradicting the DATA-05 "invalid data is never silently written/returned" intent this phase otherwise upholds carefully).
**Fix:** Either derive `ProjectListItem.id` from the envelope's own id (requires threading the envelope id into `toProjectListItem`), or add an explicit cross-field check in `put()`/`parseBackup()`:
```ts
// in RxdbStorageAdapter.put(), after validating:
if (validated.data.id !== validated.id) {
  throw new Error(`Envelope id (${validated.id}) does not match data.id (${validated.data.id})`);
}
```

### WR-03: `RxdbStorageAdapter.put()` unconditionally sets `dirty: true`, silently overriding `legacyImport.ts`'s documented `dirty: false` intent

**File:** `src/adapters/storage/indexeddb/StorageAdapter.ts:112-120`, contradicted comment at `src/adapters/migration/legacyImport.ts:90-93`
**Issue:** `legacyImport.ts` explicitly builds its envelope with:
```ts
// Freshly-imported data is in sync with itself; there is no pending
// local change to flag as dirty.
dirty: false
```
but every envelope passed to `storage.put()` gets that field unconditionally clobbered:
```ts
const toWrite: Envelope<Project> = {
  ...validated,
  revision,
  updatedAt: new Date().toISOString(),
  updatedBy: "local-user",
  dirty: true          // <- always, regardless of what the caller passed
};
```
So every legacy-imported project actually ends up persisted with `dirty: true`, the opposite of what the comment in `legacyImport.ts` promises and of what neither test file (`legacyImport.test.ts` uses the non-overriding `InMemoryStorageAdapter`, so it never observes this; `legacyImport.integration.test.ts` never asserts on `dirty` at all) catches. This is currently inert only because `SyncPort` is a no-op, but it is a real, silent contract violation that will surface incorrectly-flagged outbox entries the moment sync is wired up.
**Fix:** Either drop the now-misleading comment/field in `legacyImport.ts`, or make `put()` respect an explicit "already synced" case, or (preferred, least invasive) simply delete the dead `dirty: false` assignment and its comment from `legacyImport.ts` so the code doesn't claim a guarantee it cannot deliver.

### WR-04: `RxdbStorageAdapter.put()`'s revision bump is a non-atomic read-modify-write (lost-update race)

**File:** `src/adapters/storage/indexeddb/StorageAdapter.ts:102-123`
**Issue:**
```ts
const existing = await this.collection.findOne(validated.id).exec();
const revision = existing
  ? (existing.toJSON() as PersistedProjectEnvelope).revision + 1
  : 1;
...
await this.collection.upsert(toPersisted(toWrite));
```
Between the `findOne()` read and the `upsert()` write there is an `await` boundary; two concurrent `put()` calls for the same `id` (e.g. a rapid double-click, or two open tabs) can both read the same `existing.revision`, both compute the same "next" revision, and the second `upsert()` silently overwrites the first — one logical revision increment is lost. `revision` is documented as "Monotonic per-client revision counter (logical clock core)" (`envelope.ts:18`) that future LWW sync conflict-resolution will depend on; a lost increment here is exactly the kind of bug that surfaces much later as an unexplained sync conflict.
**Fix:** Use RxDB's `incrementalModify`/`atomicUpdate` (or an equivalent read-and-write-in-one-storage-transaction primitive) instead of separate `findOne()` + `upsert()`, so the revision bump is computed and written atomically.

### WR-05: `importBackup()`'s documented "atomic, all-or-nothing" guarantee only covers validation, not the write loop itself

**File:** `src/adapters/storage/indexeddb/StorageAdapter.ts:164-177`, contract stated in `src/domain/ports/StoragePort.ts:30-36`
**Issue:** The port doc comment promises: *"Validates every entry in `blob` BEFORE writing anything. If any single entry fails validation, the whole import is rejected with zero writes (atomic, all-or-nothing)."* `parseBackup()` does guarantee that for Zod-validation failures. But the actual write phase is a plain loop with no transaction or rollback:
```ts
for (const envelope of envelopes) {
  await this.collection.upsert(toPersisted(envelope));
}
```
If any `upsert()` in the middle of this loop fails for a reason Zod's `ProjectEnvelopeSchema` doesn't catch but the RxDB collection schema does (e.g. `id` exceeding the RxDB schema's `maxLength: 100`, or an IndexedDB-level write error, quota error, etc. — see `db.ts:30-33` / `db.ts:44-46`), the loop throws partway through, and every envelope upserted before the failing one has already been written. The documented "zero writes" guarantee does not hold for this failure class.
**Fix:** Either write via a single bulk operation (`collection.bulkUpsert()`, which reports all successes/errors together) and only report success if every write succeeded, or explicitly narrow the doc comment to "validated atomically; write-phase failures may leave a partial import" so callers aren't relying on a guarantee the code doesn't provide.

### WR-06: Backup restore never checks the backup's `schemaVersion` against `CURRENT_APP_SCHEMA_VERSION`

**File:** `src/adapters/storage/indexeddb/backup.ts:48-78`, write side `src/adapters/storage/indexeddb/StorageAdapter.ts:164-177`
**Issue:** `serializeBackup()` stamps both a top-level `schemaVersion` and a per-envelope `schemaVersion` (`CURRENT_APP_SCHEMA_VERSION`, currently `1`). `parseBackup()` reads the `projects` array and Zod-validates each entry's *shape*, but never compares either the top-level or per-entry `schemaVersion` value against `CURRENT_APP_SCHEMA_VERSION`. Any envelope whose `schemaVersion` field happens to be a non-negative integer (`z.number().int().nonnegative()`, `schema.ts:152`) passes, regardless of what version it actually claims to be. A backup produced by a future, incompatible schema version would be imported as current-version data with no version guard or migration step, silently mislabeling stale/foreign data as up to date.
**Fix:** Add an explicit check in `parseBackup()` (or its caller) rejecting/flagging entries whose `schemaVersion` doesn't match a supported version:
```ts
if (parsedBackup.schemaVersion !== CURRENT_APP_SCHEMA_VERSION) {
  throw new Error(
    `Unsupported backup schema version: ${parsedBackup.schemaVersion} (expected ${CURRENT_APP_SCHEMA_VERSION})`
  );
}
```

## Info

### IN-01: `legacyImport.ts` computes `updatedAt`/`updatedBy` that `RxdbStorageAdapter.put()` immediately discards

**File:** `src/adapters/migration/legacyImport.ts:85-92`, overridden at `src/adapters/storage/indexeddb/StorageAdapter.ts:112-120`
**Issue:** `legacyImport.ts` builds the envelope with `updatedAt: new Date().toISOString()` and `updatedBy: "local-user"`, but `put()` unconditionally recomputes both fields again on write. The values computed in `legacyImport.ts` are therefore dead — never observable in the persisted record. Harmless today (both effectively resolve to "now" / `"local-user"` either way) but confusing to a future reader who might assume the import-time timestamp survives.
**Fix:** Either drop the redundant fields from the envelope literal in `legacyImport.ts` (rely on `put()` to set them), or add a one-line comment noting they're placeholders overwritten by `put()`.

### IN-02: `NoopLlmAdapter.enrichSpec` test only checks deep equality, not the identity it documents

**File:** `src/adapters/llm/noop.test.ts:5-9`, doc comment at `src/domain/ports/LlmPort.ts:14-18`
**Issue:** The port's doc comment states the Noop implementation "MUST be the identity function." The test asserts:
```ts
const result = await NoopLlmAdapter.enrichSpec(spec);
expect(result).toEqual({ foo: 1 }); // deep-equality, not identity
```
`toEqual` would also pass for an accidental future implementation that returns a deep clone instead of the same reference, so the test doesn't actually pin down the "identity" contract it's named after.
**Fix:** Add a referential-equality assertion alongside the structural one: `expect(result).toBe(spec);`

### IN-03: `legacyImport.integration.test.ts` never closes/removes its RxDB instance, unlike every other RxDB-backed test file

**File:** `src/adapters/migration/legacyImport.integration.test.ts:12-46`
**Issue:** `StorageAdapter.test.ts`, `backup.test.ts`, and `db.test.ts` all carefully `db.remove()`/`db.close()` in `afterEach`/inline cleanup, with comments explaining exactly why (RxDB's DB8 "name already used" + the memory-storage plugin's module-level pool). `legacyImport.integration.test.ts` opens a real `createStorageAdapter(getRxStorageMemory())` (fixed DB name `"project-maker"`, per `db.ts:75`) and never tears it down; the file's own comment argues this is currently safe only because it's the sole test in the file and Vitest's default per-file isolation prevents cross-file pool contamination. That reasoning is correct under the current `vite.config.ts` (no `isolate: false`), but it is a silent dependency on a global test-runner setting that isn't enforced or asserted anywhere — if isolation is ever turned off for speed, this file (not the ones that already clean up) is the one that will start failing with DB8.
**Fix:** Add a matching `afterEach`/inline `db.remove()` for consistency and to remove the implicit dependency on test-isolation config, e.g. capture the adapter's underlying db (same test-only cast pattern already used in `container.test.ts:27`) and call `.close()`/`.remove()` after the assertions.

---

_Reviewed: 2026-07-09T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
