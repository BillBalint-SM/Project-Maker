---
phase: 01-adat-alap-portok-perzisztencia-s-mvp-migr-ci
plan: 04
subsystem: database

tags: [rxdb, typescript, hexagonal-architecture, null-object-pattern, composition-root, tdd]

# Dependency graph
requires:
  - phase: 01-adat-alap-portok-perzisztencia-s-mvp-migr-ci
    provides: "app/container.ts's createStorageAdapter(storage) factory and StoragePort (01-01)"
provides:
  - "ContentPort, ExportPort, LlmPort, SyncPort interfaces (src/domain/ports/)"
  - "NoopLlmAdapter — identity enrichSpec, empty suggestFollowups, unknown rateAnswer (src/adapters/llm/noop.ts)"
  - "NoopSyncAdapter — no-op markDirty, always-empty pending() (src/adapters/sync/noop.ts)"
  - "app/container.ts config switchboard + createContainer(storage) full composition root (Storage/Llm/Sync wired, Content/Export documented as future)"
affects: [phase-2-survey-scoring, phase-3-spec-generation, phase-4-export, v2-live-llm-integration, v2-sync-milestone]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Null Object pattern for optional ports (LlmPort/SyncPort): a Noop adapter is the DEFAULT binding, not a fallback — the domain never assumes a live implementation exists"
    - "Composition root as single decision point: app/container.ts's createContainer() is the only place that knows which adapter backs which port"
    - "Interface-first, adapter-later: ContentPort/ExportPort exist as type contracts with zero implementations, deliberately, until Phase 3/4"

key-files:
  created:
    - src/domain/ports/ContentPort.ts
    - src/domain/ports/ExportPort.ts
    - src/domain/ports/LlmPort.ts
    - src/domain/ports/SyncPort.ts
    - src/adapters/llm/noop.ts
    - src/adapters/llm/noop.test.ts
    - src/adapters/sync/noop.ts
    - src/adapters/sync/noop.test.ts
    - src/app/container.test.ts
  modified:
    - src/app/container.ts

key-decisions:
  - "Task 1 followed strict RED/GREEN TDD despite the noop adapters' triviality: the plan's frontmatter marks Task 1 tdd=\"true\", so noop.ts implementations were first written as intentionally-wrong placeholders (NoopLlmAdapter.enrichSpec returning undefined, NoopSyncAdapter.pending() returning a fake entry), tests written against the CORRECT contract, confirmed failing, then fixed to the correct identity/empty-array behavior in a separate feat commit"
  - "container.test.ts cleans up its fixed-name \"project-maker\" RxDB memory database via a test-only cast to reach RxdbStorageAdapter's private `db` field and call `db.close()` in afterEach — RxDB throws DB8 (\"name already used\") on a second createRxDatabase() call with the same name while the first instance is still open; removeRxDatabase() was tried first but does not clear RxDB's internal USED_DATABASE_NAMES registry (only closing the actual instance does), so it did not resolve the conflict"

patterns-established:
  - "Noop-adapter-first ports (LlmPort, SyncPort): every future 'opcionális periféria' port should ship with its Null Object default in the SAME plan/PR that defines the interface, never as separate follow-up work"
  - "container.test.ts db-name-conflict cleanup pattern: when a composition-root test calls a factory that internally opens a fixed-name RxDB database without exposing the handle, close it via a documented test-only cast rather than skipping cleanup or renaming production code"

requirements-completed: [PREP-01, PREP-02]

coverage:
  - id: D1
    description: "LlmPort interface + NoopLlmAdapter Null Object — enrichSpec is identity, suggestFollowups always [], rateAnswer always {level: 'unknown'} (PREP-01)"
    requirement: "PREP-01"
    verification:
      - kind: unit
        ref: "src/adapters/llm/noop.test.ts#enrichSpec() returns the input deeply unchanged (identity — the deterministic pipeline never depends on the LLM)"
        status: pass
      - kind: unit
        ref: "src/adapters/llm/noop.test.ts#suggestFollowups() always resolves to an empty array"
        status: pass
      - kind: unit
        ref: "src/adapters/llm/noop.test.ts#rateAnswer() always resolves to { level: 'unknown' }"
        status: pass
    human_judgment: false
  - id: D2
    description: "SyncPort interface + ChangeLogEntry type + NoopSyncAdapter Null Object — pending() always [], markDirty() never throws (PREP-02); StorageAdapter already owns real dirty-bookkeeping from 01-01/01-02"
    requirement: "PREP-02"
    verification:
      - kind: unit
        ref: "src/adapters/sync/noop.test.ts#pending() always resolves to an empty array (the StorageAdapter already owns dirty-bookkeeping)"
        status: pass
      - kind: unit
        ref: "src/adapters/sync/noop.test.ts#markDirty() resolves without throwing and does nothing of substance"
        status: pass
    human_judgment: false
  - id: D3
    description: "ContentPort and ExportPort minimal type contracts (no adapters yet — Phase 3/4 scope), and a domain-purity guarantee: no port file imports rxdb/dexie/react/adapters"
    verification:
      - kind: other
        ref: "grep -RcE \"from ['\\\"](rxdb|dexie|react|\\.\\./\\.\\./adapters)\" src/domain/ports/ — zero matches across all 5 port files"
        status: pass
    human_judgment: false
  - id: D4
    description: "app/container.ts full composition root: config.llmEnabled switchboard + createContainer(storage) wiring storage/llm/sync; content/export deliberately absent with an explanatory comment"
    verification:
      - kind: unit
        ref: "src/app/container.test.ts#wires llm to the NoopLlmAdapter singleton (referential equality)"
        status: pass
      - kind: unit
        ref: "src/app/container.test.ts#wires sync to a NoopSyncAdapter whose pending() resolves to []"
        status: pass
      - kind: unit
        ref: "src/app/container.test.ts#wires storage to a working StoragePort — list() resolves without throwing (smoke test)"
        status: pass
    human_judgment: false

# Metrics
duration: ~15min (single continuous session, sequential execution on main after worktree-isolation fallback)
completed: 2026-07-09
status: complete
---

# Phase 01 Plan 04: LLM/Sync/Content/Export ports and full composition root Summary

**LlmPort/SyncPort/ContentPort/ExportPort interfaces + NoopLlmAdapter/NoopSyncAdapter Null Objects, wired into a `createContainer()` composition root alongside the existing StoragePort**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-09
- **Tasks:** 2 (both committed; Task 1 used TDD RED->GREEN)
- **Files modified:** 10 (9 created, 1 modified)

## Accomplishments
- All 5 hexagonal ports (Storage from 01-01, plus Content/Export/Llm/Sync from this plan) now exist as TypeScript interfaces in `src/domain/ports/`, none importing rxdb/dexie/react/adapters (domain purity preserved)
- `NoopLlmAdapter` and `NoopSyncAdapter` (Null Object pattern) are the app's DEFAULT bindings — `enrichSpec` is a proven identity function, `suggestFollowups`/`pending()` always resolve empty, `markDirty()`/`rateAnswer()` never throw or depend on a live LLM/sync backend
- `app/container.ts`'s `createContainer(storage)` is now the single, fully-wired composition root for Storage/Llm/Sync — `config.llmEnabled` exists as the documented future `LiveLlmAdapter` hook point, currently unused (no live branch exists in the codebase)
- ContentPort/ExportPort exist as minimal, forward-looking type contracts with zero implementations — explicitly documented as Phase 3/Phase 4 territory, not wired into `createContainer()`'s return type
- 9 new automated tests (3 NoopLlmAdapter, 2 NoopSyncAdapter, 3 createContainer, plus RED-phase fixtures), all green; full pre-existing suite stays green (37 total tests); `tsc --noEmit` clean

## Task Commits

Each task was committed atomically:

1. **Task 1: ContentPort, ExportPort, LlmPort, SyncPort + NoopLlmAdapter + NoopSyncAdapter** - `e2f93c4` (test, RED) + `0833128` (feat, GREEN)
2. **Task 2: Kompozíciós gyökér bővítése — container.ts mind az 5 porttal** - `0b3ff9f` (feat)

**Plan metadata:** _pending — this commit, see final_commit step_

_Note: Task 1 is a TDD task (`tdd="true"`) — RED (failing tests against intentionally-wrong placeholder adapters, `e2f93c4`) then GREEN (correct identity/empty-array implementation, `0833128`). No REFACTOR commit was needed; the GREEN implementation was already minimal and clean._

## Files Created/Modified
- `src/domain/ports/LlmPort.ts` - `LlmPort` interface (`rateAnswer`, `suggestFollowups`, `enrichSpec<T>`)
- `src/domain/ports/SyncPort.ts` - `SyncPort` interface (`markDirty`, `pending`) + `ChangeLogEntry` type; `push()`/`pull()` deliberately absent (future sync milestone)
- `src/domain/ports/ContentPort.ts` - `ContentPort` interface (`forQuestion`), return type intentionally `unknown` (no coaching-content model yet)
- `src/domain/ports/ExportPort.ts` - `ExportPort` interface (`serialize`), `viewModel` intentionally `unknown` (Phase 4 territory)
- `src/adapters/llm/noop.ts` - `NoopLlmAdapter: LlmPort` — identity `enrichSpec`, empty `suggestFollowups`, `{level: "unknown"}` `rateAnswer`
- `src/adapters/llm/noop.test.ts` - 3 tests proving the Null Object contract
- `src/adapters/sync/noop.ts` - `NoopSyncAdapter: SyncPort` — no-op `markDirty`, always-empty `pending`
- `src/adapters/sync/noop.test.ts` - 2 tests proving the Null Object contract
- `src/app/container.ts` - added `config` (feature-flag switchboard) + `createContainer(storage)` (full DI wiring for storage/llm/sync); `createStorageAdapter` unchanged
- `src/app/container.test.ts` - 3 tests proving `createContainer()`'s wiring, with test-only db-close cleanup for the fixed-name RxDB memory database

## Decisions Made
- Followed strict TDD RED->GREEN for Task 1 (marked `tdd="true"` in the plan frontmatter) even though the Null Object behaviors are trivial: wrote intentionally-wrong placeholder implementations first, confirmed the tests failed against them, then fixed to the correct behavior in a separate commit. This keeps the RED/GREEN gate sequence auditable in git history (`test(01-04): ...` then `feat(01-04): ...`), matching this project's established TDD convention from 01-01/01-02.
- `container.test.ts` needed a cleanup strategy for the fixed-name `"project-maker"` RxDB database that `createContainer()` opens internally: `removeRxDatabase()` (RxDB's name-based cleanup API) was tried first but does not clear RxDB's internal `USED_DATABASE_NAMES` registry — only closing the actual `RxDatabase` instance does. Since `createContainer()`/`RxdbStorageAdapter` do not expose the `db` handle publicly (by design), the test reaches it via a documented test-only type cast (`container.storage as unknown as { db: RxDatabase }`) purely for teardown in `afterEach`. Production code never does this.
- `ContentPort`/`ExportPort` were created as pure type contracts per the plan's explicit instruction, with no adapter and not part of `createContainer()`'s return type — a comment in `container.ts` documents this as intentional (Phase 3/4 scope), preventing a future contributor from treating their absence as an oversight.

## Deviations from Plan

None - plan executed exactly as written. All file paths, method signatures, and behaviors match the plan's `<action>` blocks exactly (LlmPort's 3 methods, SyncPort's 2 methods with no push/pull, ContentPort/ExportPort's minimal single-method shapes, NoopLlmAdapter/NoopSyncAdapter's exact behaviors, container.ts's `config`/`createContainer` additions without touching `createStorageAdapter`'s existing signature).

The only deltas from the plan's literal text are test-infrastructure choices not specified by the plan (RED/GREEN staging order for Task 1, and the `container.test.ts` RxDB cleanup mechanism) — both are documented above as decisions, not deviations, since they did not change any behavior, file, or interface the plan specified.

## Issues Encountered
- `container.test.ts`'s first cleanup attempt (`removeRxDatabase(name, storage)`) did not resolve RxDB's DB8 "name already used" error between tests, because that API only wipes collection storage data — it does not clear the separate in-memory `USED_DATABASE_NAMES` registry that `createRxDatabase()` checks. Resolved by closing the actual `RxDatabase` instance (via a test-only cast to `RxdbStorageAdapter`'s private `db` field) in `afterEach` instead.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 hexagonal ports now exist; `app/container.ts` is the single composition root for Storage/Llm/Sync. Phase 2 (survey/scoring) and beyond can depend on `createContainer()` without re-deriving DI wiring.
- `ContentPort`/`ExportPort` remain intentionally unimplemented — Phase 3 (spec-generation/coaching content) and Phase 4 (export) should add their concrete adapters and extend `createContainer()`'s return type at that time; do not add stub/placeholder adapters for them speculatively before those phases.
- `config.llmEnabled` exists as a flag with no live branch — a future v2/Phase 8 LLM-integration plan will add `LiveLlmAdapter` and make this flag load-bearing; until then it is always `false` and always resolves to `NoopLlmAdapter`.
- 01-05 (legacy Tauri-MVP migration import) can now assume the full 5-port container shape is stable when it wires up its own import path.

## Self-Check: PASSED

All 9 created source files were verified present on disk; all 3 task commit hashes (`e2f93c4`, `0833128`, `0b3ff9f`) were verified present in `git log --oneline --all`.

---
*Phase: 01-adat-alap-portok-perzisztencia-s-mvp-migr-ci*
*Completed: 2026-07-09*
