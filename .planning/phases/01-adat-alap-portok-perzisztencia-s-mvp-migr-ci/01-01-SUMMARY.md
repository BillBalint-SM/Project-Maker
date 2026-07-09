---
phase: 01-adat-alap-portok-perzisztencia-s-mvp-migr-ci
plan: 01
subsystem: database

tags: [rxdb, zod, react-router, typescript, indexeddb, hexagonal-architecture, walking-skeleton]

# Dependency graph
requires: []
provides:
  - "Envelope<T> sync-ready record wrapper + CURRENT_APP_SCHEMA_VERSION (src/domain/model/envelope.ts)"
  - "Domain Project model mirroring legacy src/data/types.ts field-for-field (src/domain/model/types.ts)"
  - "Zod 4 schemas for runtime validation (ProjectSchema, createEnvelopeSchema, ProjectEnvelopeSchema)"
  - "createEmptyProject() factory for schema-valid, zeroed Project defaults"
  - "StoragePort interface (list/get/put) — hexagonal persistence seam"
  - "RxDB-backed RxdbStorageAdapter implementing StoragePort, Zod-validated on every read/write"
  - "app/container.ts composition-root factory (createStorageAdapter)"
  - "React Router 7 data router entry point + ProjectListView Walking Skeleton UI"
affects: [phase-2-survey-scoring, phase-3-spec-generation, 01-02-soft-delete, 01-03-backup-restore, 01-04-full-container, 01-05-legacy-migration]

# Tech tracking
tech-stack:
  added: [rxdb@17.3, rxjs@7.8, zod@4.4, react-router@7.18]
  patterns:
    - "Hexagonal ports & adapters: domain/ (pure TS, no IO) -> domain/ports/ (interfaces) -> adapters/ (IO implementations)"
    - "Sync-ready envelope wrapping every persisted record (id/schemaVersion/data/revision/updatedAt/updatedBy/deletedAt/dirty)"
    - "Zod validation at every storage read/write boundary — replaces the legacy `as Project` unsafe cast"
    - "Composition root (app/container.ts) injects the concrete RxStorage engine — domain/adapters never hardcode Dexie/Memory"
    - "TDD RED->GREEN commit pairing for UI-behavior tasks (test(...) then feat(...))"

key-files:
  created:
    - src/domain/model/envelope.ts
    - src/domain/model/types.ts
    - src/domain/model/schema.ts
    - src/domain/model/factory.ts
    - src/domain/ports/StoragePort.ts
    - src/adapters/storage/indexeddb/db.ts
    - src/adapters/storage/indexeddb/StorageAdapter.ts
    - src/adapters/storage/indexeddb/StorageAdapter.test.ts
    - src/app/container.ts
    - src/features/projects/ProjectListView.tsx
    - src/features/projects/ProjectListView.test.tsx
  modified:
    - package.json
    - pnpm-lock.yaml
    - tsconfig.json
    - src/main.tsx

key-decisions:
  - "Installed rxdb@17/rxjs@7/zod@4/react-router@7 during Task 2 (before Task 3's literal pnpm add step) because Task 2's Zod schema requires the real package to typecheck, and the Task 1 human checkpoint already approved all four packages before any implementation began"
  - "tsconfig.json moduleResolution changed Node -> Bundler: TypeScript could not resolve react-router's conditional './dom' subpath export under legacy Node resolution; Bundler is also the idiomatic choice for a Vite project"
  - "RxDB memory-storage test isolation requires db.remove() (close + wipe), not just db.close() — the memory storage engine keeps documents in a name-keyed pool shared across instances, so close() alone left prior tests' data visible to the next test"
  - "ProjectListView obtains storage via a module-level lazy singleton (getStorage()) exported from src/main.tsx, not by calling createStorageAdapter() itself — prevents re-opening the 'project-maker' RxDB database on every render (would throw RxDB's DB8 'name already used')"

patterns-established:
  - "Envelope<T> / Zod / StoragePort triad: every future adapter (backup, legacy migration) must round-trip through ProjectEnvelopeSchema.parse()"
  - "RxDB schema fields that mirror a nullable domain field but are declared optional (not nullable) in RxDB itself need an explicit null<->missing-key mapping at the adapter boundary (see deletedAt handling in StorageAdapter.ts)"

requirements-completed: [DATA-01, DATA-02, DATA-05]

coverage:
  - id: D1
    description: "Envelope<T> + Project domain model + Zod schemas validate every storage read/write (DATA-02, DATA-05)"
    requirement: "DATA-02"
    verification:
      - kind: unit
        ref: "src/adapters/storage/indexeddb/StorageAdapter.test.ts#put() then get() with the same id returns the same data payload"
        status: pass
      - kind: unit
        ref: "src/adapters/storage/indexeddb/StorageAdapter.test.ts#put() with an incomplete object throws a Zod error and does not write partially"
        status: pass
      - kind: unit
        ref: "src/adapters/storage/indexeddb/StorageAdapter.test.ts#put() with deletedAt: null does not throw an RxDB schema validation error, and get() returns deletedAt: null"
        status: pass
    human_judgment: false
  - id: D2
    description: "Stable client-generated UUID identity (DATA-01) — createEmptyProject() + envelope.id via crypto.randomUUID, used as the RxDB primaryKey"
    requirement: "DATA-01"
    verification:
      - kind: unit
        ref: "src/adapters/storage/indexeddb/StorageAdapter.test.ts#put() then get() with the same id returns the same data payload"
        status: pass
    human_judgment: false
  - id: D3
    description: "RxdbStorageAdapter — real RxDB-backed StoragePort implementation (list/get/put), updatedBy always forced to local-user, revision auto-increments"
    verification:
      - kind: unit
        ref: "src/adapters/storage/indexeddb/StorageAdapter.test.ts#put()-in updatedBy is always overwritten to local-user, even if the caller passed something else"
        status: pass
      - kind: unit
        ref: "src/adapters/storage/indexeddb/StorageAdapter.test.ts#list() returns an empty array on an empty database"
        status: pass
    human_judgment: false
  - id: D4
    description: "ProjectListView Walking Skeleton component behavior — empty state, list rendering, Új teszt-projekt add-and-refresh flow"
    verification:
      - kind: unit
        ref: "src/features/projects/ProjectListView.test.tsx#shows \"Nincs megjeleníthető projekt.\" when the list is empty"
        status: pass
      - kind: unit
        ref: "src/features/projects/ProjectListView.test.tsx#renders both project names when storage.list() returns two projects"
        status: pass
      - kind: unit
        ref: "src/features/projects/ProjectListView.test.tsx#clicking \"Új teszt-projekt\" calls put() with a valid envelope, then refreshes the list"
        status: pass
    human_judgment: false
  - id: D5
    description: "End-to-end dev-server smoke: React Router 7 entry point serves the '/' route with real RxDB/Dexie storage in an actual browser"
    verification:
      - kind: other
        ref: "curl http://127.0.0.1:5173/ (root div present) and curl http://127.0.0.1:5173/src/main.tsx (200, transforms without error)"
        status: pass
    human_judgment: true
    rationale: "Chrome DevTools MCP was unavailable in this environment, so the interactive behavior (empty-state text, add-button round-trip against real browser IndexedDB via Dexie) could not be exercised in a live browser — only the static HTML and Vite module transform were confirmed via curl. A human should run `pnpm dev`, open http://127.0.0.1:5173, confirm the empty-state text, click 'Új teszt-projekt', and confirm a new row appears."

# Metrics
duration: ~28min (continuation session covering Tasks 2-4; Task 1's checkpoint was resolved by the orchestrator before this session started)
completed: 2026-07-09
status: complete
---

# Phase 01 Plan 01: Domain model, RxDB StorageAdapter, and Walking Skeleton Summary

**Envelope<T>/Zod/RxDB persistence stack with a React Router 7 + IndexedDB Walking Skeleton (ProjectListView) proving the full build->domain->storage->routing->UI chain**

## Performance

- **Duration:** ~28 min (continuation session; Task 1 checkpoint approval happened before this session)
- **Completed:** 2026-07-09
- **Tasks:** 4 (Task 1: checkpoint, no commit; Tasks 2-4: committed)
- **Files modified:** 15 (11 created, 4 modified)

## Accomplishments
- Domain-pure Envelope<T> + Project model + Zod 4 schemas (ProjectSchema, createEnvelopeSchema, ProjectEnvelopeSchema) mirroring the legacy Tauri MVP's `src/data/types.ts` field-for-field
- StoragePort (list/get/put) implemented by a real RxDB-backed RxdbStorageAdapter — every read/write round-trips through Zod validation, invalid data throws instead of writing silently (DATA-05)
- Stable client-generated UUID identity (DATA-01) via `createEmptyProject()`; sync-ready envelope metadata (schemaVersion/revision/updatedAt/updatedBy/deletedAt/dirty) on every record (DATA-02)
- Composition root (`app/container.ts`) wires the StoragePort to RxDB, storage engine injected by the caller (Dexie in the browser, Memory in tests)
- React Router 7 data-router entry point replacing the direct `<App/>` mount; ProjectListView Walking Skeleton reads real IndexedDB data and can write a new test project through a UI button
- 8 new automated tests (5 StorageAdapter, 3 ProjectListView), all green; full pre-existing suite (25 tests) stays green; `tsc --noEmit` and `vite build` both clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Csomag-legitimitás ellenőrzés telepítés előtt** - no commit (human-verify checkpoint; user approved all 4 packages before this session started — see `<checkpoint_resolution>` in the orchestrator handoff)
2. **Task 2: Domain-kontraktusok — Envelope, Project-típus, Zod-sémák, StoragePort, factory** - `b749b23` (feat)
3. **Task 3: RxDB StorageAdapter, db-inicializálás, kompozíciós gyökér** - `bb46e40` (feat)
4. **Task 4: Routing + ProjectListView (Walking Skeleton proof-of-life UI)** - `97854f9` (test, RED) + `5ce5135` (feat, GREEN)

**Plan metadata:** _pending — this commit, see final_commit step_

_Note: Task 4 is a TDD task (`tdd="true"`) — RED (failing test, `97854f9`) then GREEN (implementation, `5ce5135`). No REFACTOR commit was needed; the GREEN implementation was already clean._

## Files Created/Modified
- `src/domain/model/envelope.ts` - `Envelope<T>` (8 fields) + `CURRENT_APP_SCHEMA_VERSION = 1`
- `src/domain/model/types.ts` - `Project` + 14 related types, 1:1 field mirror of legacy `src/data/types.ts`
- `src/domain/model/schema.ts` - Zod 4 schemas; `checklistAnswers` keyed `z.record(z.string(), ...)` (JS object keys are always strings at runtime)
- `src/domain/model/factory.ts` - `createEmptyProject(overrides?)` — zeroed, schema-valid Project, no scoring computation
- `src/domain/ports/StoragePort.ts` - `list`/`get`/`put` only (softDelete/backup deliberately deferred to 01-02/01-03)
- `src/adapters/storage/indexeddb/db.ts` - `projectEnvelopeSchema` (RxDB collection schema, version 0) + `createProjectDatabase(storage)`; `deletedAt` declared optional in `properties` (not `required`) to survive RxDB's default `additionalProperties: false`
- `src/adapters/storage/indexeddb/StorageAdapter.ts` - `RxdbStorageAdapter implements StoragePort`; Zod-validates on every put/get/list; null<->missing-key mapping for `deletedAt`; `updatedBy` always forced to `"local-user"`; `revision` auto-increments
- `src/adapters/storage/indexeddb/StorageAdapter.test.ts` - 5 tests against `getRxStorageMemory()` (round-trip, empty list, Zod rejection on incomplete write, `updatedBy` override, `deletedAt: null` round-trip)
- `src/app/container.ts` - `createStorageAdapter(storage)` composition-root factory
- `src/features/projects/ProjectListView.tsx` - Walking Skeleton proof-of-life UI
- `src/features/projects/ProjectListView.test.tsx` - 3 tests (empty state, two-project render, add-and-refresh flow), mocking `src/main.tsx`'s `getStorage()`
- `package.json` / `pnpm-lock.yaml` - added `rxdb@17.3.0`, `rxjs@7.8.2`, `zod@4.4.3`, `react-router@7.18.1`
- `tsconfig.json` - `moduleResolution` changed `Node` -> `Bundler`
- `src/main.tsx` - React Router 7 data router (`createBrowserRouter` + `RouterProvider` from `react-router/dom`), module-level lazy-singleton `getStorage()`

## Decisions Made
- Installed all 4 approved packages (rxdb, rxjs, zod, react-router) during Task 2's execution window rather than strictly at Task 3's literal `pnpm add` step, because Task 2's Zod schema needs the real `zod` package to typecheck via `tsc --noEmit`, and the Task 1 checkpoint's human approval already covered all four packages before any Task 2/3 work began. The `package.json`/`pnpm-lock.yaml` diff was committed together with Task 3 (matching Task 3's planned file ownership).
- `tsconfig.json` `moduleResolution` changed from `Node` to `Bundler`: TypeScript's legacy Node resolution could not follow `react-router`'s conditional `./dom` subpath export (`rxdb`'s own subpath exports worked fine under `Node`, but `react-router/dom` specifically needs `bundler`/`node16`/`nodenext`). `Bundler` is also the idiomatic setting for a Vite-based project; `tsc --noEmit` stayed fully clean project-wide after the change.
- `ProjectListView` obtains its `StoragePort` via a lazy singleton (`getStorage()`) exported from `src/main.tsx`, rather than calling `createStorageAdapter()` directly — this prevents the component from re-opening the `project-maker` RxDB database on every mount/render (RxDB throws `DB8` "name already used" on a second `createRxDatabase()` call with the same name+storage combination).
- Test isolation for `StorageAdapter.test.ts` uses `db.remove()` (not `db.close()`) in `afterEach` — RxDB's memory storage plugin keeps documents in a storage-name-keyed pool that survives a plain `close()`, so only `remove()` (close + wipe) gives each test a genuinely empty database.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed rxdb/rxjs/zod/react-router ahead of Task 3's literal install step**
- **Found during:** Task 2 (writing `src/domain/model/schema.ts`, which imports `zod`)
- **Issue:** The plan sequences the `pnpm add rxdb@17 rxjs@7 zod@4 react-router@7` command inside Task 3's action text, but Task 2's Zod schema file needs the real `zod` package installed to pass its own `<verify>` step (`tsc --noEmit`). Without it, `tsc` would report "Cannot find module 'zod'" against a `domain/model` file.
- **Fix:** Ran the full approved install (`pnpm add rxdb@17 rxjs@7 zod@4 react-router@7`) before writing Task 2's files, since the Task 1 checkpoint's human approval already covered all four packages. The resulting `package.json`/`pnpm-lock.yaml` diff was committed with Task 3 (its planned file owner), not Task 2.
- **Files modified:** `package.json`, `pnpm-lock.yaml`
- **Verification:** `tsc --noEmit` clean immediately after Task 2's files were written; `package.json` dependency versions confirmed (`rxdb@17.3.0`, `rxjs@7.8.2`, `zod@4.4.3`, `react-router@7.18.1`)
- **Committed in:** `bb46e40` (Task 3 commit)

**2. [Rule 3 - Blocking] tsconfig.json moduleResolution Node -> Bundler**
- **Found during:** Task 4 (`src/main.tsx` importing `RouterProvider` from `react-router/dom`)
- **Issue:** `tsc --noEmit` failed with `TS2307: Cannot find module 'react-router/dom'` — TypeScript's legacy `Node` module resolution mode does not follow package.json conditional `exports` subpaths reliably; `react-router`'s `./dom` export requires `bundler`/`node16`/`nodenext` resolution.
- **Fix:** Changed `tsconfig.json` `compilerOptions.moduleResolution` from `"Node"` to `"Bundler"` (idiomatic for a Vite-based project; the project already used `module: "ESNext"` and `isolatedModules: true`).
- **Files modified:** `tsconfig.json`
- **Verification:** `tsc --noEmit` returned clean project-wide (no new errors introduced anywhere else in the codebase) after the change.
- **Committed in:** `5ce5135` (Task 4 GREEN commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking issues)
**Impact on plan:** Both fixes were necessary preconditions for the plan's own `<verify>` commands (`tsc --noEmit`, `pnpm test`) to run at all. No scope creep — no packages beyond the 4 already human-approved, no architectural changes.

## Known Stubs

- `src/adapters/storage/indexeddb/StorageAdapter.ts` — `toProjectListItem()`'s `contact` field is hardcoded to `""`. This is explicitly specified by the plan ("contact — üres string helykitöltő, mert a contact-összefűzés Phase 2 tárgya") and `ProjectListView.tsx` does not render a contact column in this Walking Skeleton, so it has no visible UI impact yet. Resolved when Phase 2 builds the real survey/contact UI.

## Issues Encountered
- RxDB's memory storage plugin (`getRxStorageMemory()`) keeps documents in a storage-name-keyed pool shared across separate `createRxDatabase()` calls with the same name — a plain `db.close()` between tests only freed RxDB's internal "name already used" (`DB8`) tracking, not the actual document data, causing test 2 onward to see test 1's leftover data. Resolved by using `db.remove()` (close + wipe) in the test's `afterEach`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The domain model, Zod validation, and StoragePort/RxDB adapter are now the stable foundation for 01-02 (softDelete/tombstone), 01-03 (backup/restore), 01-04 (full container with Llm/Sync/Content Noop ports), and 01-05 (legacy Tauri-MVP migration import).
- `StoragePort` intentionally still lacks `softDelete`/`exportBackup`/`importBackup` — these are added incrementally by 01-02/01-03 per the plan's interface-first design; do not add them speculatively in later plans without re-reading those plans' exact method signatures.
- D5 (live-browser interactive verification of the dev server) was only checked via curl/static-HTML — a human or a future agent with Chrome DevTools MCP access should do one real-browser pass on `pnpm dev` before this phase's overall UAT closes out.

## Self-Check: PASSED

All 11 created source files and the SUMMARY.md itself were verified present on disk; all 4 task commit hashes (`b749b23`, `bb46e40`, `97854f9`, `5ce5135`) were verified present in `git log --oneline --all`.

---
*Phase: 01-adat-alap-portok-perzisztencia-s-mvp-migr-ci*
*Completed: 2026-07-09*
