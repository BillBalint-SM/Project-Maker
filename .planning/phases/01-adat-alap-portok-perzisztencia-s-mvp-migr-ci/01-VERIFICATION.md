---
phase: 01-adat-alap-portok-perzisztencia-s-mvp-migr-ci
verified: 2026-07-09T12:56:26Z
status: passed
score: 6/6 truths verified
behavior_unverified: 0
overrides_applied: 0
resolved_by_orchestrator_browser_check: true
behavior_unverified_items:
  - truth: "A projekt-lista nézet valós IndexedDB-ből (Dexie-n, valódi böngészőben) olvas, és 'Új teszt-projekt' gombbal valós írást tud kiváltani (01-01 must_have #3)"
    test: "Nyisd meg `pnpm dev`-et egy valódi böngészőben (http://127.0.0.1:5173), figyeld meg az üres-állapot szöveget, kattints az 'Új teszt-projekt' gombra, és ellenőrizd, hogy egy új sor megjelenik a listában, majd az oldal újratöltése után is megmarad (bizonyítva a valódi Dexie/IndexedDB perzisztenciát, nem csak a memory-storage tesztduplát)."
    expected: "Az üres-állapot szöveg megjelenik friss adatbázisnál; gombklikk után egy új projekt-sor jelenik meg; oldal-újratöltés után a sor megmarad (valódi IndexedDB-perzisztencia, nem csak in-memory állapot)."
    why_human: "Minden automatizált teszt (StorageAdapter.test.ts, ProjectListView.test.tsx, container.test.ts) getRxStorageMemory()-t vagy mockolt storage-modult használ — soha nem futtatja a valódi getRxStorageDexie() ágat egy tényleges böngésző IndexedDB-je ellen. A verifier ebben a környezetben csak `curl`-lal ellenőrizte a statikus HTML-t és a Vite modul-transzformot (200 OK mindkettőre) — ez bizonyítja, hogy a build/dev-szerver-lánc működik, de NEM bizonyítja a kattintás → valódi IndexedDB-írás → UI-frissítés interaktív láncot. Ugyanezt a rést maga a 01-01-SUMMARY.md is dokumentálta (D5, human_judgment: true) — a Chrome DevTools MCP nem volt elérhető az eredeti végrehajtási sessionben sem."
human_verification:
  - test: "Nyisd meg `pnpm dev`-et egy valódi böngészőben (http://127.0.0.1:5173). Ellenőrizd az üres-állapot szöveget ('Nincs megjeleníthető projekt.'), kattints az 'Új teszt-projekt' gombra, és nézd meg, hogy egy új sor megjelenik. Frissítsd az oldalt (F5) és ellenőrizd, hogy a sor megmaradt (valódi Dexie/IndexedDB-perzisztencia)."
    expected: "Az adat valóban a böngésző IndexedDB-jébe íródik, nem csak a React state-be — oldal-újratöltés után is látható."
    why_human: "Nincs Chrome DevTools MCP vagy más valós böngésző-vezérlési eszköz elérhető ebben a verifikációs környezetben; minden automatizált teszt mock vagy in-memory RxDB storage ellen fut."
  - test: "Kattints az 'Adatmentés exportálása' gombra egy valódi böngészőben, ellenőrizd hogy egy .json fájl valóban letöltődik a lemezre, majd a 'Visszaállítás' gombbal töltsd vissza — nézd meg hogy a projekt-lista helyesen áll vissza."
    expected: "Egy valódi fájl-letöltés történik (nem csak egy mock-URL hívás), és a visszatöltés valóban helyreállítja az állapotot."
    why_human: "jsdom nem implementálja a Blob-URL / fájl-letöltési böngésző-API-kat valóságosan; a unit-tesztek csak a `URL.createObjectURL`/`revokeObjectURL` hívásokat spy-olják, nem a tényleges fájlrendszer-letöltést."
---

# Phase 1: Adat-alap, portok, perzisztencia és MVP-migráció — Verification Report

**Phase Goal:** Sync-re felkészített, verziózott adatmodell és a hexagonális port-réteg áll; minden adat perzisztál, validálódik és menthető/visszaállítható, és a meglévő Tauri-MVP adatai nem-destruktívan behozhatók a webes domain-modellre — erre épül a teljes felület.
**Verified:** 2026-07-09T12:56:26Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Methodology Note

This phase is tagged `mode: mvp` in ROADMAP.md, but the phase's "Cél" (goal) is a technical/infrastructure statement, not a `As a ... I want ... so that ...` user story — the `mode: mvp` tag here reflects that the phase was *executed* using MVP/Walking-Skeleton planning discipline (see `SKELETON.md`), not that the phase delivers an end-user-facing capability that itself should be verified as a user flow. Per the task brief, this is a foundational, blocking phase (data model, ports, persistence, migration) with no direct end-user journey beyond the walking-skeleton proof-of-life UI. Standard goal-backward verification (ROADMAP Success Criteria + PLAN must_haves, cross-referenced against the actual codebase) was applied instead of the MVP User-Flow-Coverage table format.

## Independent Verification Performed

Beyond reading SUMMARY.md claims, the following was independently re-run against the actual codebase in this session:

- `pnpm exec tsc --noEmit` — **clean, zero errors** (matches SUMMARY claims)
- `pnpm test -- --run` (full suite) — **15 test files, 48 tests, all passed** (matches the 48-tests-green claim in 01-03-SUMMARY.md; not merely re-quoted from the summary)
- `pnpm exec vite --port 5199` (real dev server) + `curl` — root HTML served (200, contains `root` div), `/src/main.tsx` transforms cleanly (200) — confirms the Walking Skeleton's build→dev-server chain is real, not merely claimed
- Every artifact file listed in all 5 plans' frontmatter was opened and read in full; source code (not just SUMMARY prose) was checked against each plan's `<action>` and `must_haves` text
- All 16 commit hashes cited across the 5 SUMMARY.md files were confirmed present via `git cat-file -e` (all OK)
- `src/data/types.ts` (legacy) vs `src/domain/model/types.ts` (new) were diffed line-by-line — confirmed an exact field-for-field mirror, as claimed
- The legacy-migration fixture (`legacy-export-fixture.json`) was read in full — confirmed it genuinely contains 3 valid Hungarian-accented rows + 1 row with a missing `name` field, as claimed
- Anti-pattern grep (`TBD|FIXME|XXX`, `TODO|HACK|placeholder`) across all phase-created/modified source files — no unresolved debt markers found (2 documented, in-scope "Placeholder" comments for the `contact` field, explicitly deferred to Phase 2 by the plan itself)

## Goal Achievement

### ROADMAP Success Criteria (primary contract)

| # | Success Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Minden entitás stabil, kliens-generált ID-t kap; minden gyökér-rekord sync-envelope-ot hordoz (schema_version, monoton version, updated_at, actor, dirty); relációk csak ID-ra hivatkoznak | ✓ VERIFIED | `src/domain/model/envelope.ts` — `Envelope<T>` has all 8 fields (`id`, `schemaVersion`, `data`, `revision`, `updatedAt`, `updatedBy`, `deletedAt`, `dirty`). `RxdbStorageAdapter.put()` (`StorageAdapter.ts:102-123`) auto-increments `revision` on every write, forces `updatedBy: "local-user"`. `createEmptyProject`/`ProjectListView.handleAddTestProject` use `crypto.randomUUID()`. Test: `StorageAdapter.test.ts` round-trip + `updatedBy` override tests, both passing (confirmed via independent `pnpm test` run). |
| 2 | A törlés soft-delete (tombstone `deleted_at`): törölt rekordok alapból eltűnnek a listákból; minden mentés/betöltés Zod-sémán validálódik, hibás adat elutasításra kerül | ✓ VERIFIED | `softDelete()` (`StorageAdapter.ts:125-148`) sets `deletedAt`, never calls `.remove()` (grep-confirmed 0 matches in the method body). `list()` filters `{ deletedAt: { $exists: false } }`; `get()` remains unfiltered (tombstones still reachable). `put()`/`get()`/`list()`/`importBackup()` all call `ProjectEnvelopeSchema.parse()`/`safeParse()` before writing/returning — invalid data throws (verified via `StorageAdapter.test.ts`'s "put() with an incomplete object throws" case, passing). See also Anti-Patterns section for a UX-layer caveat (CR-01) that does not affect the underlying validation guarantee. |
| 3 | Teljes JSON backup/restore; a séma verziózott, verzió-kulcsolt migrációs lánccal, amely üres lánccal is elindul | ✓ VERIFIED | `backup.ts` (`serializeBackup`/`parseBackup`) + `StorageAdapter.exportBackup()`/`importBackup()` — dumps ALL envelopes incl. tombstones, validates every entry before any write (`backup.test.ts`, both tests passing). `db.ts`'s production `projectEnvelopeSchema` stays `version: 0`/`migrationStrategies: {}` (empty chain, DATA-04's literal requirement); `db.test.ts` proves the RxDB migration mechanism genuinely executes end-to-end on a synthetic v0→v1 schema (real `addCollections()` call, not a mock), asserting the migrated field's presence and `migrationNeeded() === false` afterward. |
| 4 | Mind az 5 port (Storage, Content, Export, Llm, Sync) definiált; app alapból NoopLlmAdapter+NoopSyncAdapter mögött fut, dirty/outbox könyveléssel — AI és sync nélkül teljes | ✓ VERIFIED | All 5 port files exist in `src/domain/ports/` (`StoragePort.ts`, `ContentPort.ts`, `ExportPort.ts`, `LlmPort.ts`, `SyncPort.ts`), none import `rxdb`/`dexie`/`react`/`adapters` (grep-confirmed 0 matches). `container.ts`'s `createContainer()` wires `llm: NoopLlmAdapter`, `sync: NoopSyncAdapter` unconditionally (`config.llmEnabled` exists but has no live branch — grep confirms no `LiveLlmAdapter` anywhere in `src/`). Dirty-bookkeeping is real: `put()`/`softDelete()` set `dirty: true`. `noop.test.ts` files (llm, sync) pass. |
| 5 | A meglévő Tauri-MVP adata nem-destruktívan és idempotensen importálható a webes domain-modellre, Zod-validálva, valósághű fixtúrán tesztelve; ismételt futtatás nem duplikál/ír felül | ✓ VERIFIED | `legacyImport.ts`'s `importLegacyExport()` — row-independent parse+Zod-validate loop, `storage.get(id)` existence check before `put()`. Fixture (`legacy-export-fixture.json`) read in full: 3 valid Hungarian-accented rows + 1 intentionally invalid row (missing `name`), confirmed. Both `legacyImport.test.ts` (in-memory double, 5 tests) and `legacyImport.integration.test.ts` (real `RxdbStorageAdapter` via `createStorageAdapter()`, 1 test) pass, proving `imported: 3` first run / `imported: 0, skippedExisting: 3` second run — idempotency proven against both the fast double and the real persistence stack. `grep -c "storage.softDelete" legacyImport.ts` = 0 (never tombstones). |

**Score:** 5/5 ROADMAP Success Criteria VERIFIED.

### Supplementary Walking Skeleton Truth (01-01 PLAN must_have, beyond the 5 ROADMAP SCs)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 6 | "A projekt-lista nézet valós IndexedDB-ből olvas, és 'Új teszt-projekt' gombbal valós írást tud kiváltani" (real browser Dexie/IndexedDB round-trip, not just mocked/memory-storage) | ✓ VERIFIED (browser-checked post-hoc, see addendum) | Originally flagged PRESENT_BEHAVIOR_UNVERIFIED by the verifier subagent (no browser tool in its environment). The orchestrator subsequently ran the app in a real Chromium preview (Claude Preview MCP) and confirmed the full round-trip directly — see "Post-Verification Addendum" below. |

**Overall score:** 6/6 tracked truths verified.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| DATA-01 | 01-01 | Stable client-generated ULID/UUID identity, relations by ID only | ✓ SATISFIED | `crypto.randomUUID()` in `factory.ts`, `ProjectListView.tsx`, `legacyImport.ts` (preserves legacy IDs, already UUID-shaped) |
| DATA-02 | 01-01 | Sync-envelope on every root record (schema_version/version/updated_at/actor/dirty) | ✓ SATISFIED | `Envelope<T>` (8 fields), `put()` bumps `revision`/`updatedAt`, forces `updatedBy` |
| DATA-03 | 01-02 | Soft-delete tombstone, hidden by default from lists | ✓ SATISFIED | `softDelete()`, `list()` selector filter, `get()` unfiltered |
| DATA-04 | 01-02 | Versioned schema, version-keyed migration chain, works even empty | ✓ SATISFIED | `db.ts` (`version: 0`, `migrationStrategies: {}`), `db.test.ts` proves the mechanism on a synthetic schema |
| DATA-05 | 01-01, 01-03 | Zod validation on every save/load | ✓ SATISFIED | `ProjectEnvelopeSchema.parse()`/`safeParse()` at every `StoragePort` method boundary (see CR-01 caveat below — validation itself is sound; UI error-surfacing has a gap, tracked as a warning, not a requirement failure) |
| DATA-06 | 01-03 | Full JSON backup/restore | ✓ SATISFIED | `backup.ts`, visible "Adatmentés exportálása"/"Visszaállítás" UI buttons, atomic validation-first import |
| PREP-01 | 01-04 | LLM behind a port, off by default, app fully usable without it | ✓ SATISFIED | `LlmPort`, `NoopLlmAdapter` (identity `enrichSpec`), no `LiveLlmAdapter` anywhere |
| PREP-02 | 01-04 | Sync behind a port, dirty/outbox bookkeeping prepared, no real sync built | ✓ SATISFIED | `SyncPort`, `NoopSyncAdapter` (`pending()` always `[]`), real dirty-flag bookkeeping lives in `StorageAdapter` |
| MIG-01 | 01-05 | Legacy Tauri-MVP data non-destructively, idempotently importable | ✓ SATISFIED | `legacyImport.ts` + unit/integration tests, synthetic realistic fixture |

**No orphaned requirements** — all 9 IDs declared in the phase (`DATA-01..06, PREP-01, PREP-02, MIG-01`) are claimed by exactly one plan each in frontmatter, and REQUIREMENTS.md's traceability table marks all 9 as "Phase 1 / Complete" with no additional Phase-1-mapped IDs left unclaimed.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/domain/model/envelope.ts` | `Envelope<T>` + `CURRENT_APP_SCHEMA_VERSION` | ✓ VERIFIED | Exact 8-field interface, constant = 1 |
| `src/domain/model/types.ts` | Field-for-field mirror of legacy `Project` model | ✓ VERIFIED | Line-by-line diff against `src/data/types.ts` confirms exact match |
| `src/domain/model/schema.ts` | `ProjectSchema`, `createEnvelopeSchema`, `ProjectEnvelopeSchema` | ✓ VERIFIED | All enums match legacy literal unions; `checklistAnswers` correctly uses `z.record(z.string(), ...)` |
| `src/domain/model/factory.ts` | `createEmptyProject()` | ✓ VERIFIED | Present, used by `ProjectListView.tsx` and `db.test.ts`/`backup.test.ts` fixtures |
| `src/domain/ports/StoragePort.ts` | list/get/put/softDelete/exportBackup/importBackup | ✓ VERIFIED | All 6 methods present, incrementally extended across 01-01→01-03 as planned |
| `src/domain/ports/{Content,Export,Llm,Sync}Port.ts` | 4 remaining ports | ✓ VERIFIED | All present, domain-pure (no rxdb/dexie/react/adapters imports) |
| `src/adapters/storage/indexeddb/db.ts` | RxDB schema + `createProjectDatabase` | ✓ VERIFIED | `deletedAt` correctly optional (not `required`), version 0, empty migration chain |
| `src/adapters/storage/indexeddb/StorageAdapter.ts` | `RxdbStorageAdapter` (full StoragePort) | ✓ VERIFIED | All 6 methods implemented, Zod-validated, tombstone-aware |
| `src/adapters/storage/indexeddb/backup.ts` | `serializeBackup`/`parseBackup` | ✓ VERIFIED | Pure helpers, Zod-validated both directions |
| `src/adapters/storage/memory/InMemoryStorageAdapter.ts` | Fast StoragePort test double | ✓ VERIFIED | Full interface implemented, used by `legacyImport.test.ts` |
| `src/adapters/llm/noop.ts`, `src/adapters/sync/noop.ts` | Null Object defaults | ✓ VERIFIED | Identity/empty-array behaviors confirmed by dedicated tests |
| `src/adapters/migration/legacyImport.ts` | `importLegacyExport()` | ✓ VERIFIED | Row-independent, idempotent, Zod-validated, never tombstones |
| `src/app/container.ts` | `createStorageAdapter`, `createContainer`, `config` | ✓ VERIFIED | Full 3-port wiring (storage/llm/sync); Content/Export documented as future |
| `src/features/projects/ProjectListView.tsx` | Walking Skeleton UI + backup/restore buttons | ✓ VERIFIED | All 4 buttons present and wired (Új teszt-projekt / Törlés / Adatmentés exportálása / Visszaállítás) |
| `src/test/fixtures/legacy-export-fixture.json` | Realistic synthetic legacy fixture | ✓ VERIFIED | 4 rows, 3 valid (incl. Hungarian-accented, archived), 1 intentionally invalid — read and confirmed in full |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `ProjectListView.tsx` | `main.tsx` (`getStorage()`) | `import { getStorage } from "../../main"` | ✓ WIRED | Confirmed via source read; lazy singleton pattern avoids RxDB DB8 re-open error |
| `main.tsx` | `app/container.ts` | `createStorageAdapter(getRxStorageDexie())` | ✓ WIRED | Confirmed |
| `app/container.ts` | `adapters/storage/indexeddb/StorageAdapter.ts` | `new RxdbStorageAdapter(db)` | ✓ WIRED | Confirmed |
| `StorageAdapter.ts` | `domain/model/schema.ts` | `ProjectEnvelopeSchema.parse()` on every read/write | ✓ WIRED | Confirmed on `list()`, `get()`, `put()`, `softDelete()`, `exportBackup()` |
| `ProjectListView.tsx` | `StorageAdapter.ts` | `storage.softDelete(id)` ("Törlés" button) | ✓ WIRED | Confirmed, tested |
| `ProjectListView.tsx` | `StorageAdapter.ts` | `storage.exportBackup()`/`importBackup()` (backup buttons) | ✓ WIRED | Confirmed, tested (incl. error-path test for invalid restore) |
| `container.ts` | `adapters/llm/noop.ts` | `llm: NoopLlmAdapter` | ✓ WIRED | Confirmed, referential-equality tested in `container.test.ts` |
| `container.ts` | `adapters/sync/noop.ts` | `sync: NoopSyncAdapter` | ✓ WIRED | Confirmed, tested |
| `legacyImport.ts` | `domain/model/schema.ts` | `ProjectSchema.safeParse()` | ✓ WIRED | Confirmed |
| `legacyImport.ts` | `domain/ports/StoragePort.ts` | `storage.get()`/`storage.put()` (via `Pick<StoragePort, "get"\|"put">`) | ✓ WIRED | Confirmed; capability-narrowed on purpose (cannot call `softDelete`) |

### Behavioral Spot-Checks (independently re-run in this session, not re-quoted from SUMMARY.md)

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full project typecheck | `pnpm exec tsc --noEmit` | Zero errors | ✓ PASS |
| Full test suite | `pnpm test -- --run` | 15 files / 48 tests, all passed | ✓ PASS |
| Dev server serves root route | `vite --port 5199` + `curl http://localhost:5199/` | HTTP 200, `root` div present | ✓ PASS |
| `main.tsx` transforms via Vite | `curl -o /dev/null -w "%{http_code}" http://localhost:5199/src/main.tsx` | HTTP 200 | ✓ PASS |
| Migration idempotency mechanism | Read `legacyImport.test.ts`/`legacyImport.integration.test.ts` assertions directly (not just SUMMARY prose) | `imported: 3` then `imported: 0, skippedExisting: 3` on both the in-memory double and the real RxDB adapter | ✓ PASS |
| RxDB migration mechanism genuinely runs | Read `db.test.ts` directly | Real `addCollections()` v0→v1 call, asserts migrated field + `migrationNeeded() === false` | ✓ PASS |
| Real interactive browser round-trip (click → real IndexedDB write → UI refresh → reload persists) | N/A — no browser automation tool available in this environment | Not exercised | ? SKIP (routed to human verification) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `src/features/projects/ProjectListView.tsx` | 30-38 | `refresh()` has no `try/catch`; a single Zod-invalid stored record would leave `list()` throwing, silently freezing the UI's project list (no error banner, unlike export/restore handlers) | ⚠️ Warning (carried from 01-REVIEW.md CR-01, not duplicated in full — see note below) | This is a UX/robustness gap, not a functional failure of DATA-05's core guarantee: invalid data is still never silently *written* (the storage layer's `parse()` still throws on write, per `StorageAdapter.test.ts`'s passing "put() with an incomplete object throws" case). The gap is specifically in *read-path user feedback* — a corrupted record would produce a stuck blank list with zero visible error, which is a legitimate (but non-blocking) DATA-05 "spirit" gap in user-facing behavior. Recommend addressing before Phase 2 builds further UI on top of this component, but it does not invalidate the phase's core persistence/validation truths. |
| `src/adapters/storage/indexeddb/StorageAdapter.ts` | 49 | `// Placeholder — contact-concatenation is Phase 2 territory` | ℹ️ Info | Explicitly scoped out by the plan itself (`ProjectListView` does not render a `contact` column); not a hidden stub — documented, in-scope deferral |
| `src/adapters/storage/memory/InMemoryStorageAdapter.ts` | 70 | Same `contact` placeholder, mirrored for consistency with the real adapter | ℹ️ Info | Same as above |

No unreferenced `TBD`/`FIXME`/`XXX` debt markers were found anywhere in the phase's created/modified files (grep across `src/domain`, `src/adapters`, `src/app`, `src/features/projects/ProjectListView.tsx`, `src/main.tsx` returned zero matches).

**Note on 01-REVIEW.md:** A prior code-review pass (`01-REVIEW.md`, `status: issues_found`, 1 critical + 6 warnings) already documents this and 6 other quality findings (WR-01 through WR-06, IN-01 through IN-03) in full detail — non-atomic revision-bump race (WR-04), backup write-loop not truly atomic beyond Zod validation (WR-05), no `schemaVersion` compatibility check on restore (WR-06), envelope-id vs `data.id` invariant not enforced (WR-02), `legacyImport.ts`'s `dirty: false` intent silently overridden by `put()` (WR-03). None of these represent a missing/stub/unwired artifact or an unmet phase-level truth — they are legitimate hardening/robustness follow-ups for a foundational data layer, consistent with a `mode: mvp` walking-skeleton phase. This verification does not re-litigate or duplicate that report; it is referenced here only to confirm none of its findings rise to a must-have FAILURE for this phase's stated goal.

## Human Verification Required

None remaining — both items originally listed here were resolved by direct browser verification (see addendum below) before this report was finalized.

## Post-Verification Addendum — Orchestrator Browser Check (2026-07-09T13:03Z)

The verifier subagent above had no browser-automation tool in its sandboxed environment and correctly routed truth #6 to human verification. The orchestrator (main session) has access to the Claude Preview MCP tool (a real Chromium instance), which the subagent did not — so rather than handing both items to the human, the orchestrator ran them directly:

**Setup:** Created `repo/dev-server.cmd` (thin `corepack pnpm run dev` wrapper, needed because the Preview tool resolves `.claude/launch.json` relative to the outer working directory, one level above the git repo root) and `.claude/launch.json` (outside the repo, not committed), then started the real Vite dev server via `preview_start` and drove it with `preview_eval`/`preview_click`/`preview_snapshot`.

**Item 1 — Real Dexie/IndexedDB round-trip:**
1. Loaded `http://127.0.0.1:5173/` — confirmed empty-state text "Nincs megjeleníthető projekt." via accessibility snapshot.
2. Clicked "Új teszt-projekt" (via `element.click()` in-page — the MCP click tool's synthetic event didn't register for this button, direct DOM `.click()` did). A new row appeared: "Teszt projekt 2026-07-09T13:01:38.433Z" / "Előkészítés".
3. Queried `indexedDB.databases()` — confirmed two real databases were created: `rxdb-dexie-project-maker--0--_rxdb_internal` and `rxdb-dexie-project-maker--0--projects`. The `dexie` in the name confirms the real Dexie storage engine, not `getRxStorageMemory()`.
4. Called `location.reload()` and re-snapshotted — **the row was still present after a full page reload**, proving persistence to real browser IndexedDB, not React state.

**Item 2 — Real backup/restore file round-trip:**
1. Instrumented `URL.createObjectURL` and `HTMLAnchorElement.click` in-page before clicking "Adatmentés exportálása". Confirmed a real `Blob` (1530 bytes, `application/json`) was created and a real anchor download was triggered with filename `project-maker-backup-2026-07-09T13:02:14.669Z.json`.
2. Captured the blob's actual text content — a well-formed backup JSON containing the full `Envelope<Project>` for the test project (schemaVersion, revision, updatedBy: "local-user", deletedAt: null, dirty: true, and the complete nested `Project` payload).
3. Clicked "Törlés" (soft-delete) on the project — UI returned to the empty state ("Adatmentés exportálva." success banner then empty list).
4. Constructed a real `File` from the exported JSON text and a `DataTransfer`, assigned it to the hidden `<input type="file" accept="application/json">`, and dispatched a `change` event — i.e., a genuine File API round-trip, not a mocked call.
5. UI showed "Visszaállítás sikeres." and the project reappeared in the list with its original data intact — confirming restore correctly recovers even a soft-deleted (tombstoned) record from a real exported file.

**Conclusion:** Both items are genuinely verified against real browser IndexedDB and File APIs, not mocks or static HTML checks. Phase 1 status is upgraded to `passed`. `dev-server.cmd` was left in the repo (untracked, harmless, useful for future phase UI verification) but not committed as part of this phase.

---

_Verified: 2026-07-09T12:56:26Z_
_Verifier: Claude (gsd-verifier)_
