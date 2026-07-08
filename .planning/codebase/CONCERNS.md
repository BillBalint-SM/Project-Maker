# Codebase Concerns

**Analysis Date:** 2026-07-08

## Tech Debt

**Database path tied to executable location:**
- Issue: `database_path()` and `app_directory()` in `src-tauri/src/lib.rs` derive the SQLite DB and exports folder from `std::env::current_exe()`'s parent directory. If the app is installed under `C:\Program Files\...` (a common NSIS install target), writes to `<install-dir>\data\project-maker.db` and `<install-dir>\exports` will fail without admin rights or UAC virtualization quirks.
- Files: `src-tauri/src/lib.rs:34-55`, `src-tauri/tauri.conf.json`
- Impact: On a locked-down Windows machine, first launch could silently fail persistence (errors surface only as a generic Hungarian string from `open_database()`), or writes could go to a UAC-virtualized shadow copy the user never finds.
- Fix approach: Use `tauri::api::path::app_data_dir()` (or Tauri 2's `app_handle().path().app_data_dir()`) instead of the exe directory, matching platform conventions for per-user writable storage.

**Data duplication between JSON blob and query columns:**
- Issue: Every `Project` is stored twice — as a full JSON blob in the `data` column and duplicated into flat columns (`name`, `status`, `priority`, `deadline`, `completion_state`, `completion_percent`, `archived_at`, `updated_at`) for filtering/sorting. These must be kept in sync manually via `toProjectRecord()`.
- Files: `src/lib/storageAdapters.ts:52-65`, `src-tauri/src/lib.rs:12-32` (`ProjectRecordInput`)
- Impact: Any new filterable/sortable field added to `Project` requires updates in three places (TS type, `toProjectRecord`, Rust struct + SQL) with no compiler-enforced link between them. A missed update produces silently stale list-view data (list uses columns; detail view uses the JSON blob).
- Fix approach: Either derive list-view fields from parsing the JSON blob at read time (simpler, avoids drift, likely fine at this project's scale) or add a single shared schema/migration test that fails when a `Project` field isn't reflected in both column set and struct.

**No debounce on autosave during editing:**
- Issue: `updateSelectedProject()` in `src/App.tsx:154-161` calls `saveProject()` (which invokes the storage adapter and, in SQLite mode, an IPC round-trip) on every single field update from the detail tabs (checklist answers, interview text, decision fields).
- Files: `src/App.tsx:141-161`, `src/features/project-detail/tabs/*.tsx`
- Impact: Fast typing (e.g., in `InterviewTab`) triggers many sequential SQLite writes; each also re-triggers `refreshLists()` which reloads both active and archived lists from disk. On larger project counts this becomes a per-keystroke double-list full reload.
- Fix approach: Debounce `saveProject` calls (e.g., 300-500ms) and avoid calling `refreshLists()` on every save — only refresh list-relevant summary fields, or refresh lazily when navigating back to the list view.

**No pagination or lazy loading of project lists:**
- Issue: `listProjects()` on both adapters (`src/lib/storageAdapters.ts:72-76`, `:127-132`) always loads and parses every row into memory; `App.tsx` fetches both active and archived lists in full on every `refreshLists()` call.
- Files: `src/lib/storageAdapters.ts`, `src/App.tsx:97-110`
- Impact: Fine for the current single-user desktop scale, but scales linearly with JSON parse cost per row; will visibly slow down list rendering and every-save refresh once a user accumulates a few hundred projects.
- Fix approach: Add pagination/virtualized list rendering and a lighter-weight "list projection" query that avoids full JSON parse for rows not currently visible.

## Known Bugs

**Silent data loss on localStorage fallback:**
- Symptoms: If native Tauri SQLite is unavailable (`createProjectStorageAdapter` catches and falls back, `src/lib/storageAdapters.ts:150-161`) or `localStorage.setItem` throws (quota exceeded, private browsing), the write silently fails — `writeProjects()` (`src/lib/storageAdapters.ts:104-106`) has no try/catch and no propagation path back to the UI beyond the generic "Az export nem sikerült" style messages used elsewhere.
- Files: `src/lib/storageAdapters.ts:82-106`
- Trigger: Run outside Tauri (plain browser dev/preview) with `localStorage` quota exceeded or disabled.
- Workaround: None currently surfaced to the user; `saveProject` in `App.tsx:141-152` does catch the thrown error and sets `saveStatus("error")`, but a `QuotaExceededError` thrown synchronously inside `writeProjects` would propagate correctly there — however no corresponding UI element in `App.tsx` renders `saveStatus === "error"` distinctly from `"saving"`/`"idle"` beyond whatever the header showed originally (only `appError` banner is rendered; `saveStatus` state has no visible UI, based on `App.tsx:260-345`, aside from being passed to `ProjectDetail`).

**No error boundary — render errors crash the whole app:**
- Symptoms: An uncaught exception in any tab component (`ChecklistTab`, `InterviewTab`, `DecisionTab`, etc.) unmounts the entire React tree, leaving the user with a blank/white window and no way to recover without restarting the app.
- Files: `src/main.tsx` (no `ErrorBoundary` wraps `<App />`)
- Trigger: Any unhandled render-time exception, e.g., malformed project JSON from a corrupted DB row reaching a component that doesn't null-check.
- Workaround: None; app restart is the only recovery path, and `selectedProject` state (unsaved edits) is lost.

## Security Considerations

**Unencrypted SQLite database stores full client project data:**
- Risk: `open_database()` (`src-tauri/src/lib.rs:76-102`) opens a plain, unencrypted `rusqlite::Connection`. All project data — potentially including client names, contact info, deadlines, and interview/decision notes — is stored in plaintext on disk at `<exe-dir>/data/project-maker.db`.
- Files: `src-tauri/src/lib.rs`
- Current mitigation: None (relies entirely on OS-level file permissions of the install directory).
- Recommendations: If the app is expected to hold sensitive client data, consider SQLCipher (`rusqlite` supports a `bundled-sqlcipher` feature) or OS-level encrypted storage (DPAPI-wrapped key + encrypted export files) — evaluate based on actual data sensitivity requirements before adding complexity.

**Export files written without prompting for destination or overwrite confirmation:**
- Risk: `save_export_file` (`src-tauri/src/lib.rs:104-114`) writes directly into `<exe-dir>/exports/<sanitized-name>` with no OS save dialog and silently overwrites any existing file of the same name (`fs::write` truncates).
- Files: `src-tauri/src/lib.rs:104-114`, `src/lib/export.ts` (`saveExportBlob` call site)
- Current mitigation: `sanitize_file_name()` strips path-separator and reserved characters, preventing path traversal.
- Recommendations: Low severity given single-user desktop context, but consider using Tauri's native save dialog (`@tauri-apps/plugin-dialog`) so users control export destination and get an OS-level overwrite prompt.

## Performance Bottlenecks

**Full list reload after every single field save:**
- Problem: Every keystroke-driven save in the detail view triggers `refreshLists()`, which runs two separate list queries (active + archived) and re-parses/recalculates every project via `recalculateProject()` (`src/lib/storage.ts:9-11`, called once per project per list).
- Files: `src/App.tsx:141-152`, `src/lib/storage.ts:28-32`
- Cause: `saveProject()` unconditionally awaits `refreshLists()` regardless of whether the save is a background autosave from a keystroke or a deliberate save action.
- Improvement path: Update just the affected project in local `projects`/`archive` state after a successful save instead of refetching everything from storage.

**PDF/Excel export libraries bundled in the main app (jspdf, jspdf-autotable, pdfmake, fflate):**
- Problem: `pdfmake` is included purely to reuse its bundled Roboto font VFS (per `.claude/CLAUDE.md` stack notes), while `jspdf`/`jspdf-autotable` do the actual PDF rendering — this is two separate PDF-capable libraries loaded together.
- Files: `src/lib/export.ts`
- Cause: Font-bundle reuse without a dedicated lightweight font-asset approach.
- Improvement path: Extract the Roboto TTF as a static asset (base64 or file import) and drop the `pdfmake` dependency entirely, reducing bundle size and eliminating a whole library's attack/maintenance surface for a font file.

## Fragile Areas

**Rust backend has no automated tests:**
- Files: `src-tauri/src/lib.rs` (no `#[cfg(test)]` module), `.github/workflows/ci.yml` (verify what it runs)
- Why fragile: All six Tauri commands (SQL string construction, path sanitization, file I/O) are unverified by any test suite; only the TypeScript side has Vitest coverage (`src/lib/*.test.ts`, `src/App.test.tsx`, feature `.test.tsx` files).
- Safe modification: Any change to `lib.rs` SQL statements, column mappings, or path logic should be manually smoke-tested against a live Tauri build before merging — there is no `cargo test` safety net.
- Test coverage: Zero for `src-tauri/`.

**App.tsx as a god component:**
- Files: `src/App.tsx` (352 lines, per `.claude/CLAUDE.md` "Anti-Patterns: App as God Component")
- Why fragile: All application state (view routing, both project lists, selection state, save status, error/notice banners, export preset) lives in one component and is threaded through props to `ProjectTable` and `ProjectDetail`. Any new cross-cutting feature (e.g., undo, multi-window, keyboard shortcuts) requires touching this file plus every consumer's prop signature.
- Safe modification: Prefer extracting cohesive slices (e.g., a `useProjectRepository()` hook encapsulating `refreshLists`/`saveProject`/`archiveProject`/`deleteProject`, and a `useExport()` hook for the export flow) before adding more state to `App.tsx`.
- Test coverage: `src/App.test.tsx` (125 lines) exercises some flows but a god component's combinatorial state space is inherently under-tested by nature.

## Scaling Limits

**Single-file SQLite with no migration system:**
- Current capacity: `open_database()` runs a single idempotent `CREATE TABLE IF NOT EXISTS` on every command invocation — there is no versioned migration mechanism.
- Limit: Any future schema change (new column, index, table) has no defined upgrade path for users with an existing `project-maker.db`; a naive `ALTER TABLE` added ad hoc to `open_database()` would need to handle "column already exists" errors manually, and there's no rollback story.
- Scaling path: Introduce a lightweight migration table (`schema_version`) and versioned migration functions run once per app start, or adopt a migration crate (e.g., `rusqlite_migration`).

## Dependencies at Risk

**Vite 8 / Vitest 4 major-version pairing on a small ecosystem:**
- Risk: Per `.claude/CLAUDE.md`, the project pins `vite: ^8.0.16` and `vitest: ^4.1.9` — both are recent major versions; plugin ecosystem compatibility (e.g., `@vitejs/plugin-react`) should be re-verified on any dependency bump given how young these majors are relative to this project's dependency lock date.
- Impact: Low currently (tests and build pass per `package.json` `checkpoint` script), but future `pnpm update` runs should re-run the full `checkpoint` script (`typecheck` + `test` + `build`) before merging, since major-version tooling churn is more likely to introduce breaking config changes than patch bumps.
- Migration plan: No action needed now; flag for attention on next dependency upgrade pass.

## Missing Critical Features

**No backup/restore or data export-for-migration path:**
- Problem: There is no user-facing "export all data" / "import data" feature distinct from the PDF/Excel presentation exports. If `project-maker.db` is lost (disk failure, accidental deletion, reinstall to a different directory per the exe-path issue above), all project data is unrecoverable.
- Blocks: Users cannot move data between machines, recover from corruption, or keep an off-site backup without manually copying the SQLite file (which requires knowing its non-obvious exe-relative location).

## Test Coverage Gaps

**Rust/Tauri command layer:**
- What's not tested: All SQL logic, path sanitization (`sanitize_file_name`), and file I/O in `src-tauri/src/lib.rs`.
- Files: `src-tauri/src/lib.rs`
- Risk: Regressions in persistence or export-file-writing logic would only surface via manual testing or user bug reports.
- Priority: High — this is the sole persistence layer for a desktop app whose primary value is not losing user data.

**Storage adapter fallback behavior:**
- What's not tested: The `createProjectStorageAdapter()` fallback path (Tauri import failure → localStorage) in `src/lib/storageAdapters.ts:150-161` has no test exercising the `catch` branch or the resulting `console.warn`.
- Files: `src/lib/storageAdapters.ts`
- Risk: A change that breaks the fallback (e.g., accidentally swallowing a different error type, or the dynamic `import("@tauri-apps/api/core")` failing for reasons other than "not in Tauri") would go unnoticed.
- Priority: Medium.

**Concurrent-save / race-condition scenarios:**
- What's not tested: Rapid sequential `saveProject` calls from the debounce-free autosave path (see Tech Debt above) — no test verifies that out-of-order IPC responses can't overwrite newer data with stale data.
- Files: `src/App.tsx:141-161`, `src/lib/storage.ts:39-41`
- Risk: In SQLite mode, if two `save_project_native` IPC calls race (unlikely but possible under slow disk I/O), the `ON CONFLICT DO UPDATE` is last-write-wins with no version check, so a slow earlier write completing after a faster later one could silently revert a field.
- Priority: Low given single-window, single-user desktop usage, but worth a regression test once autosave debouncing is added.

---

*Concerns audit: 2026-07-08*
