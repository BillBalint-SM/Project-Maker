# Codebase Concerns

**Analysis Date:** 2026-07-08

---

## Security Concerns

### HIGH — CSP Disabled

**Issue:** `tauri.conf.json` line 22 sets `"csp": null`, disabling Content Security Policy entirely.
**Files:** `src-tauri/tauri.conf.json:22`
**Impact:** Any XSS vector in the React layer (e.g., via user-entered data rendered unsanitised, or a rogue third-party script bundled in a future dependency) can call Tauri IPC commands directly. Without CSP the browser sandbox offers no additional barrier.
**Fix approach:** Set a strict CSP that allows only `'self'` and the specific `tauri:` scheme. Remove the `null` value and define an explicit policy.

---

### HIGH — No Code-Signing on Windows Installer

**Issue:** `SECURITY.md` and `docs/windows-code-signing.md` both acknowledge that the NSIS installer is unsigned.
**Files:** `SECURITY.md`, `docs/windows-code-signing.md`
**Impact:** Windows SmartScreen blocks or warns on install. Users downloading from unofficial mirrors have no tamper-detection. This is a pre-condition for any wider rollout.
**Fix approach:** Obtain an EV or OV code-signing certificate, integrate the signing step into the Tauri build pipeline (`tauri build` supports `--sign` and `signtool` hooks).

---

### MEDIUM — SQLite Database Stored Next to Executable

**Issue:** `database_path()` in `src-tauri/src/lib.rs:34-45` resolves the DB path as `<exe_dir>/data/project-maker.db`. On a standard Windows install (Program Files) this location may be write-protected or shared across users. Worse, if installed to a user-writable directory the data directory has no ACL restrictions.
**Files:** `src-tauri/src/lib.rs:34-45`
**Impact:** Multi-user machines would share or overwrite data. Elevated-privilege attacks on the data directory are possible.
**Fix approach:** Use Tauri's `app_data_dir()` (via `tauri::api::path`) to store the database under `%APPDATA%\Project Maker\` per-user.

---

### MEDIUM — Export Files Stored Next to Executable

**Issue:** `save_export_file` in `src-tauri/src/lib.rs:105-114` writes to `<exe_dir>/exports/`. Same ACL issue as the database.
**Files:** `src-tauri/src/lib.rs:105-114`
**Impact:** Exports may silently fail in hardened environments (Program Files). Path leakage — the full path is returned to the frontend and displayed in the notice banner.
**Fix approach:** Use `download_dir()` or `document_dir()` from Tauri's path API, or present a native save-file dialog.

---

### MEDIUM — Untyped IPC: Full Project JSON Blob Passed as String

**Issue:** `toProjectRecord()` in `src/lib/storageAdapters.ts:52-65` serialises the entire `Project` object to `JSON.stringify(project)` and stores it in the `data` column. The Rust side never validates this JSON; it simply stores and returns it. `parseProjectPayload` in `storageAdapters.ts:40-44` casts the result directly with `as Project` without schema validation.
**Files:** `src/lib/storageAdapters.ts:40-44, 52-65`, `src-tauri/src/lib.rs:128-150`
**Impact:** Corrupt or manually edited DB rows silently return partial `Project` objects. `normalizeProject` in `src/lib/project.ts:112-127` provides some resilience but only for known optional fields.
**Fix approach:** Add a runtime schema validator (e.g., Zod) on the frontend parse path. Alternatively validate the JSON structure in Rust before persistence.

---

### LOW — `isTauriRuntime()` Detection via Global Window Properties

**Issue:** Both `src/lib/storageAdapters.ts:33-38` and `src/lib/export.ts:47-52` detect Tauri by checking `__TAURI_INTERNALS__` or `__TAURI__` on `window`. These are undocumented internal globals that could change between Tauri versions.
**Files:** `src/lib/storageAdapters.ts:33-38`, `src/lib/export.ts:47-52`
**Impact:** Silent fallback to `localStorage` if Tauri renames the global in a future release, without any user-visible error.
**Fix approach:** Use the official `@tauri-apps/api/core` `isTauri()` helper if available in Tauri 2, or import the `invoke` function defensively and catch the "not in Tauri" error.

---

## Performance Risks

### MEDIUM — PDF Library Loaded on Every Export (Large Bundle Chunk)

**Issue:** `loadPdfGenerator()` in `src/lib/export.ts:31-45` dynamically imports `jspdf`, `jspdf-autotable`, and `pdfmake/build/vfs_fonts` on each export call. `pdfmake/build/vfs_fonts` in particular embeds large Base64-encoded fonts. The `vfs_fonts` module is not cached between exports.
**Files:** `src/lib/export.ts:31-45`
**Impact:** Each PDF export re-parses and re-imports the font VFS. On slower hardware this adds latency. Bundle analysis not present, but jsPDF + pdfmake fonts can exceed 3–4 MB of JS.
**Fix approach:** Cache the loaded modules in a module-level variable after the first import. Consider dropping `pdfmake` (it is imported only for its VFS fonts); the actual PDF rendering uses `jspdf`. Removing the `pdfmake` dependency would reduce bundle and import time significantly.

---

### MEDIUM — SQLite Connection Opened and Closed Per Command

**Issue:** Every Tauri command (`list_projects_native`, `get_project_native`, `save_project_native`, `delete_project_native`, `project_storage_info`) calls `open_database()` which opens a new `Connection` and re-runs `CREATE TABLE IF NOT EXISTS`. There is no connection pool or persistent connection.
**Files:** `src-tauri/src/lib.rs:76-101, 127-229`
**Impact:** On projects with many auto-save cycles (every keystroke triggers `saveProject` via `updateSelectedProject`), this creates repeated open/close overhead. SQLite is resilient but this pattern does not scale.
**Fix approach:** Use Tauri's `State` managed state to hold a `Mutex<Connection>` that is opened once at startup and reused across commands.

---

### MEDIUM — Auto-Save on Every State Update Without Debounce

**Issue:** `updateSelectedProject` in `src/App.tsx:154-161` calls `void saveProject(next)` synchronously inside a `setState` callback. Every character typed in any field triggers a full save-and-refresh cycle (`saveProject` → `refreshLists`).
**Files:** `src/App.tsx:154-161`, `src/App.tsx:97-110`
**Impact:** High-frequency IPC calls under rapid typing. `refreshLists` fires two parallel Tauri invocations (`listProjects(false)` and `listProjects(true)`) after every save, re-rendering the full list.
**Fix approach:** Debounce `saveProject` (e.g., 500 ms). Separate the "refresh list on save" from inline editing — the list only needs refreshing when the user navigates away.

---

### LOW — Excel Built with Hand-Rolled XML (No Streaming)

**Issue:** `buildWorkbookBlob` in `src/lib/export.ts:500-519` assembles the entire xlsx in memory as strings before zipping. For large exports (many projects × many checklist items) this can be a large in-memory object.
**Files:** `src/lib/export.ts:500-519`
**Impact:** Acceptable for current single-user desktop MVP scale. Becomes a concern if used to export dozens of fully-filled projects.
**Fix approach:** Low priority. Consider a streaming xlsx library if export size becomes an issue.

---

## Maintainability Issues

### MEDIUM — Duplicate `isTauriRuntime()` Function

**Issue:** The function is defined identically in two separate files.
**Files:** `src/lib/storageAdapters.ts:33-38`, `src/lib/export.ts:47-52`
**Impact:** Changes to Tauri detection logic must be applied in two places.
**Fix approach:** Extract to a shared utility, e.g., `src/lib/tauriRuntime.ts`, and import from both modules.

---

### MEDIUM — `App.tsx` Manages Too Much State (God Component)

**Issue:** `src/App.tsx` holds 12+ state variables, all export logic, all CRUD handlers, all navigation transitions, and all error/notice state. It is 353 lines.
**Files:** `src/App.tsx`
**Impact:** Hard to test individual flows in isolation; any new feature adds more state to an already crowded component.
**Fix approach:** Extract a `useProjectManager` custom hook for CRUD and storage state. Extract `useExport` for export-related state and handlers. Keep `App.tsx` as a thin shell that composes these hooks.

---

### LOW — `contact` Field Computed at List Time, Not Stored

**Issue:** `toProjectListItem` in `src/lib/project.ts:524-542` joins `contactPhone | contactEmail | contactOther` into a single `contact` string for the list view. This means the list search in `App.tsx:76-90` searches the concatenated string, not individual fields.
**Files:** `src/lib/project.ts:524-542`, `src/App.tsx:76-90`
**Impact:** Minor search inconsistency. Not a bug now but becomes confusing if search is expanded.

---

### LOW — Hungarian-Language String Literals in Business Logic

**Issue:** Decision labels, readiness state values, status strings, and gap messages are hardcoded Hungarian strings in `src/lib/project.ts` and `src/data/checklist.ts`. These strings are compared with `===` in multiple places (e.g., `listFilter` comparisons in `App.tsx:55-71`).
**Files:** `src/lib/project.ts:332-386`, `src/App.tsx:55-71`
**Impact:** Internationalisation would require touching all comparison sites. Typos in string literals cause silent logic failures.
**Fix approach:** Define string constants or a TypeScript `const` enum for status/recommendation values, and use those constants in comparisons.

---

## Missing Features vs Promises

### HIGH — No Data Backup or Export of Raw Data

**Issue:** `CONTEXT.md` and `future_scaling.md` describe an offline-first desktop MVP. There is no mechanism to back up or export the raw SQLite database. Users have no way to migrate data to a future web version without custom tooling.
**Files:** `src-tauri/src/lib.rs` (no backup command exists)
**Impact:** Data lock-in risk for current users. Migration to the future multi-user Angular/PostgreSQL platform described in `future_scaling.md` has no defined path.
**Fix approach:** Add a Tauri command to copy the database file to a user-chosen location, or expose a full JSON dump/restore command.

---

### MEDIUM — No Input Validation on Project Fields

**Issue:** All project fields (e.g., `deadline`, `plannedDecisionDate`, `kickoffDate`) are free-text strings. There is no validation that dates are valid ISO dates, emails are valid, or required fields meet minimum length.
**Files:** `src/lib/project.ts` (no validation functions), `src/features/project-detail/tabs/OverviewTab.tsx` (not read, but inferred from types)
**Impact:** Corrupt or malformed data can enter the database and produce incorrect readiness/decision score calculations.
**Fix approach:** Add a `validateProject` function that returns typed errors, called before `saveProject`.

---

### MEDIUM — No Undo/Redo for Edits

**Issue:** Auto-save writes every change immediately. There is no undo stack.
**Files:** `src/App.tsx:154-161`
**Impact:** Accidental field deletions are permanent once the save cycle completes.

---

### LOW — Archive Delete Has No Soft-Delete / Recycle

**Issue:** `deleteProject` in `src/App.tsx:183-195` calls `window.confirm` then immediately hard-deletes via `projectRepository.deleteProject`. `CONTEXT.md` states "az archívumból a törlés végleges" — this is intentional but worth noting.
**Files:** `src/App.tsx:183-195`, `src-tauri/src/lib.rs:221-229`
**Impact:** No recovery path for accidental deletion of archived projects.

---

## Dependency Risks

### MEDIUM — `jspdf` v4 and `jspdf-autotable` v5 Are Recent Major Versions

**Issue:** `package.json` pins `jspdf: ^4.2.1` and `jspdf-autotable: ^5.0.8`. Both are major-version bumps from the broadly-used v2/v3 ecosystem. The compatibility between them is not guaranteed and both are relatively new.
**Files:** `package.json:22-24`
**Impact:** Less community support, potential API instability. The current code uses internal casting (`doc as JsPdf & { addFileToVFS... }`) which suggests the type definitions may lag the runtime.
**Fix approach:** Pin exact versions (remove `^`) in the lockfile until the libraries are more stable. Monitor changelogs.

---

### LOW — `pdfmake` Imported Only for Font VFS

**Issue:** `pdfmake` (v0.2.20) is a full PDF generation library listed as a production dependency but is only used to access its bundled font VFS (`pdfmake/build/vfs_fonts`). The actual rendering uses `jspdf`.
**Files:** `package.json:26`, `src/lib/export.ts:35`
**Impact:** ~400 KB+ unnecessary bundle weight. Two PDF libraries in the dependency tree increase supply-chain surface.
**Fix approach:** Extract the Roboto font files directly into the project assets and load them without the `pdfmake` dependency.

---

### LOW — `lucide-react` v0.468 (Unpinned Minor)

**Issue:** `lucide-react: ^0.468.0` — lucide-react releases frequently and occasionally renames or removes icons between minor versions.
**Files:** `package.json:25`
**Impact:** `pnpm update` could silently break icon renders if icons used in `src/ui/common.tsx` or other files are renamed.
**Fix approach:** Pin to an exact version or use a lock on the minor.

---

## Build / CI Concerns

### MEDIUM — No CI Pipeline

**Issue:** No `.github/workflows/` or equivalent CI configuration exists in the repository.
**Files:** (absent)
**Impact:** The `checkpoint` script (`typecheck && test && build`) exists but is only run manually. Regressions can ship without being caught.
**Fix approach:** Add a GitHub Actions workflow that runs `pnpm checkpoint` on every push and PR.

---

### MEDIUM — No Automated Tauri Build Verification

**Issue:** `pnpm tauri:build` is not part of the `checkpoint` or `verify` scripts. The Rust compilation and Tauri bundling are never exercised in CI.
**Files:** `package.json:11-13`
**Impact:** Frontend tests can pass while the Rust layer fails to compile.
**Fix approach:** Add a `tauri build` step to CI, or at minimum a `cargo check` / `cargo test` step in `src-tauri/`.

---

### LOW — No Rust Unit Tests

**Issue:** `src-tauri/src/lib.rs` has no `#[cfg(test)]` module. The Rust-side SQL logic, `sanitize_file_name`, and `database_path` are untested.
**Files:** `src-tauri/src/lib.rs`
**Impact:** Regressions in file-name sanitisation or DB schema changes are not caught.

---

## Future-Scaling Gaps (from `future_scaling.md`)

### HIGH — No Data Migration Path from SQLite to PostgreSQL

**Issue:** `future_scaling.md` describes a target architecture with PostgreSQL on Azure. The current `Project` domain model is stored as a raw JSON blob in the `data` column with no schema versioning. There is no migration script or versioning field.
**Files:** `src-tauri/src/lib.rs:82-101` (schema), `src/lib/storageAdapters.ts:52-65`
**Impact:** Moving to a relational backend requires re-parsing all historical JSON blobs with no version discriminator to handle field additions/removals over time.
**Fix approach:** Add a `schema_version` field to the `Project` type and the SQLite schema now. Write a migration shim in `normalizeProject` keyed on version.

---

### MEDIUM — No Auth Layer Stub for Future Entra ID Integration

**Issue:** `future_scaling.md` specifies Microsoft Entra ID as the auth provider. The current app has zero auth concepts — no user identity, no session, no token handling.
**Files:** (absent)
**Impact:** When auth is added it will require threading a user identity through every storage adapter, export, and list operation. The current `ProjectRepository` interface has no concept of a user context.
**Fix approach:** Define a `UserContext` type now (even if it holds a stub `{ userId: "local" }`) and pass it through `ProjectStorageAdapter`. This keeps the refactor surface small when real auth is introduced.

---

*Concerns audit: 2026-07-08*
