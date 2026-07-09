<!-- refreshed: 2026-07-08 -->
# Architecture

**Analysis Date:** 2026-07-08

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                       UI / View Layer                        │
├──────────────────┬──────────────────┬───────────────────────┤
│   App (router)   │   ProjectTable   │   ProjectDetail        │
│  `src/App.tsx`   │ `src/features/   │  `src/features/        │
│                  │  projects/`      │   project-detail/`     │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Domain / Lib Layer (pure fns)                │
│   `src/lib/project.ts`, `src/lib/export.ts`,                 │
│   `src/lib/exportPlan.ts`, `src/data/checklist.ts`            │
└────────┬───────────────────────────────────────┬──────────────┘
         │                                        │
         ▼                                        ▼
┌───────────────────────────────┐     ┌─────────────────────────┐
│  Persistence Abstraction       │     │  Export File Writer      │
│  `src/lib/storage.ts`          │     │  (Tauri IPC / browser    │
│  `src/lib/storageAdapters.ts`  │     │   download fallback)     │
└───────┬─────────────┬──────────┘     └─────────────┬────────────┘
        │             │                              │
        ▼             ▼                              ▼
┌───────────────┐ ┌───────────────┐      ┌───────────────────────┐
│ SQLite (native)│ │ localStorage  │      │  Rust Tauri Commands   │
│ via Rust IPC   │ │ (browser      │      │  `src-tauri/src/lib.rs`│
│                │ │  fallback)    │      │  (save_export_file)    │
└───────┬────────┘ └───────────────┘      └───────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  Rust / rusqlite backend — `src-tauri/src/lib.rs`             │
│  SQLite file at <app_dir>/data/project-maker.db               │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `App` | Root state, view routing (`AppView` enum), CRUD orchestration, error/notice banners | `src/App.tsx` |
| `ProjectTable` | List/archive view, search/filter, bulk selection, export trigger | `src/features/projects/ProjectTable.tsx` |
| `ProjectDetail` | Tab-based detail editor/viewer (overview, checklist, interview, follow-ups, decision, cockpit) | `src/features/project-detail/ProjectDetailView.tsx` |
| Detail tabs | Per-section editing UI, each owns its own local rendering | `src/features/project-detail/tabs/*.tsx` |
| `ExportPresetSelect` | UI for choosing export preset (executive/full/gaps) | `src/features/export/ExportPresetSelect.tsx` |
| `project.ts` | Project factory, recalculation of derived scores, list-item projection | `src/lib/project.ts` |
| `export.ts` / `exportPlan.ts` | PDF/Excel blob construction, file naming, saving | `src/lib/export.ts`, `src/lib/exportPlan.ts` |
| `ProjectRepository` | Unified persistence API; selects and delegates to a storage adapter | `src/lib/storage.ts` |
| `TauriSqliteProjectStorageAdapter` | IPC calls to Rust SQLite backend | `src/lib/storageAdapters.ts` |
| `LocalProjectStorageAdapter` | Fallback persistence via browser `localStorage` | `src/lib/storageAdapters.ts` |
| Rust commands | SQLite CRUD + file export to disk | `src-tauri/src/lib.rs` |
| `ui/common.tsx` | Small shared UI primitives (tooltip icon button, time formatting) | `src/ui/common.tsx` |

## Pattern Overview

**Overall:** Layered desktop app (Tauri + React) with a single God Component (`App`) holding all state, a pure-function domain layer, and a swappable persistence adapter.

**Key Characteristics:**
- No routing library — view switching is a `useState<AppView>` string in `App`.
- No global state manager (no Redux/Zustand/Context) — all state lives in `App` and flows down as props.
- Persistence is abstracted behind an adapter interface; native SQLite (via Tauri IPC) is preferred, `localStorage` is the automatic fallback when not running inside Tauri or when native init fails.
- Derived/computed data (completion %, decision score, recommendation, readiness gaps) is never stored as authoritative — it is recalculated on every load/save via `recalculateProject()`.
- The full `Project` object is serialized to JSON and stored in a `data` column in SQLite; queryable columns (`name`, `status`, `priority`, etc.) are duplicated for filtering/sorting at the SQL level.

## Layers

**UI / View Layer:**
- Purpose: Render UI, handle user interaction, drive state changes
- Location: `src/App.tsx`, `src/features/`, `src/ui/`
- Contains: React components, local UI state (active tab, interview step, checklist expand/collapse)
- Depends on: Domain/Lib layer, Persistence layer, `src/data/types.ts`
- Used by: nothing (top of stack)

**Domain / Lib Layer:**
- Purpose: Pure domain calculations — completion %, decision scoring, readiness gaps, project factory/defaults, export document building
- Location: `src/lib/project.ts`, `src/lib/export.ts`, `src/lib/exportPlan.ts`
- Contains: Pure functions, no React, no I/O side effects (except export.ts which triggers file writes)
- Depends on: `src/data/types.ts`, `src/data/checklist.ts`
- Used by: `App`, `ProjectRepository` (via `reviveProject`), detail tabs

**Persistence Abstraction Layer:**
- Purpose: Abstract storage behind a single `ProjectRepository` API regardless of runtime
- Location: `src/lib/storage.ts`, `src/lib/storageAdapters.ts`, `src/lib/storageTypes.ts`
- Contains: `ProjectRepository` class, `ProjectStorageAdapter` interface, two concrete adapters
- Depends on: `@tauri-apps/api/core` (dynamically imported, conditional), browser `localStorage`
- Used by: `App` (via singleton `projectRepository`)

**Native Backend Layer:**
- Purpose: SQLite CRUD and export file writing to disk
- Location: `src-tauri/src/lib.rs` (entry via `src-tauri/src/main.rs`)
- Contains: Six `#[tauri::command]` functions — `save_export_file`, `project_storage_info`, `list_projects_native`, `get_project_native`, `save_project_native`, `delete_project_native`
- Depends on: `rusqlite`, `serde`/`serde_json`
- Used by: `TauriSqliteProjectStorageAdapter` via `invoke()` IPC calls

## Data Flow

### App Initialization

1. `main.tsx` mounts `<App />` into `#root` (`src/main.tsx`)
2. `App`'s `useEffect` calls `projectRepository.init()` (`src/App.tsx`)
3. `createProjectStorageAdapter()` detects Tauri runtime via `window.__TAURI_INTERNALS__`/`__TAURI__`; on success it calls `TauriSqliteProjectStorageAdapter.create(invoke)`, which invokes `project_storage_info` to open/create the SQLite DB (`src/lib/storageAdapters.ts`, `src-tauri/src/lib.rs`)
4. On failure (or non-Tauri browser), falls back to `LocalProjectStorageAdapter` backed by `localStorage`
5. `App` calls `refreshLists()` to populate active/archived project lists via `listProjects()`

### Project Save Flow

1. User edits fields in a detail tab (`src/features/project-detail/tabs/*.tsx`)
2. Tab calls `onChange` prop chain up to `updateSelectedProject()` in `App` (`src/App.tsx`)
3. `touchProject()` updates `updatedAt`, then `saveProject()` is invoked
4. `ProjectRepository.saveProject()` calls `reviveProject()` → `recalculateProject()` to refresh derived scores, then delegates to the active adapter (`src/lib/storage.ts`)
5. `TauriSqliteProjectStorageAdapter.saveProject()` serializes the full project to JSON plus flat columns via `toProjectRecord()`, invokes `save_project_native` (upsert) over IPC (`src/lib/storageAdapters.ts` → `src-tauri/src/lib.rs`)
6. `App` calls `refreshLists()` to reflect the change in list views

### Export Flow

1. User selects rows in `ProjectTable` and picks PDF or Excel export
2. `App.exportProjects()` loads full `Project` objects via `loadProjectsForExport()` (`src/App.tsx`)
3. `buildProjectsPdfBlob()`/`buildProjectsExcelBlob()` (`src/lib/export.ts`) build a Blob using `jspdf`/`jspdf-autotable`/`pdfmake` (PDF) or `fflate`-based zip assembly (Excel), respecting `exportPreset` (executive/full/gaps)
4. `makeExportFileName()` derives a file name; `saveExportBlob()` invokes the Rust `save_export_file` command to write to `<app_dir>/exports/` (Tauri) or triggers a browser download fallback
5. `App` shows the resulting saved path in a notice banner

**State Management:**
- All application state (`view`, `projects`, `archive`, `selectedProject`, `saveStatus`, filters, selection set) lives in `App` as `useState` hooks and is passed down as props — no context or external store.

## Key Abstractions

**`ProjectStorageAdapter` interface:**
- Purpose: Decouple the repository from the Tauri-native vs browser runtime
- File: `src/lib/storageTypes.ts`
- Implementations: `TauriSqliteProjectStorageAdapter`, `LocalProjectStorageAdapter` (`src/lib/storageAdapters.ts`)
- Pattern: Factory function `createProjectStorageAdapter()` selects implementation at runtime based on `isTauriRuntime()` detection, with try/catch fallback

**`completion` derived-state block:**
- Purpose: All derived scores — readiness %, decision score, recommendation label, readiness gaps — live on `project.completion`
- Recalculated on every save/load via `recalculateProject()` in `src/lib/project.ts`
- Never stored as authoritative; always recomputed from raw checklist/interview answers, so stale cached values cannot drift from source data

**`AppView` state machine:**
- Purpose: Simple 4-state router (`"home" | "projects" | "archive" | "detail"`) replacing a routing library
- File: `src/App.tsx`
- Pattern: Plain `useState<AppView>`; view-specific JSX blocks are conditionally rendered inline in `App`'s return

## Entry Points

**Frontend bootstrap:**
- Location: `src/main.tsx`
- Triggers: Vite dev server (`http://127.0.0.1:5173`) or production HTML load (`index.html`)
- Responsibilities: Mounts React root into `#root` div, wraps `<App />` in `React.StrictMode`

**Native app launch:**
- Location: `src-tauri/src/main.rs` → calls `src-tauri/src/lib.rs::run()`
- Triggers: Native executable launch (Windows NSIS installer target)
- Responsibilities: Registers all Tauri IPC commands via `invoke_handler`, starts the WebView window per `src-tauri/tauri.conf.json`

## Architectural Constraints

- **Threading:** Single-threaded JS frontend; Rust commands run synchronously on the Tauri main thread (no async Rust, no worker threads used).
- **Global state:** Single module-level `projectRepository` singleton exported from `src/lib/storage.ts` (`export const projectRepository = new ProjectRepository()`). All components reach it only through `App`.
- **Circular imports:** None detected.
- **Data duplication:** The full `Project` JSON is stored twice per row — once as structured SQLite columns (`name`, `status`, `priority`, `deadline`, `completion_state`, `completion_percent`, `archived_at`, `updated_at`) for filtering/sorting, and again as a full JSON blob in the `data` column. Both must stay in sync via `toProjectRecord()` in `src/lib/storageAdapters.ts` — any new field added to `Project` that needs to be queryable requires updating both the TS record mapper and the Rust `ProjectRecordInput`/SQL schema in `src-tauri/src/lib.rs`.
- **No routing library:** Navigation is a `useState<AppView>` enum inside `App`. Adding a new top-level view requires editing `src/App.tsx` directly (new enum member, new conditional render block, new nav trigger).
- **No path aliases:** `tsconfig.json` defines no path aliases; all imports use relative paths (e.g. `../data/types`).

## Anti-Patterns

### App as God Component

**What happens:** `src/App.tsx` owns nearly all application state (list data, selected project, save status, filters, export preset, selection set) and every state-mutating handler (CRUD, export, selection toggling) in one ~300-line component.
**Why it's wrong:** Any new feature that needs shared state must be wired through `App`, increasing coupling and making the component harder to test in isolation; there is no error boundary, so an uncaught render error in any child crashes the entire app.
**Do this instead:** When adding new cross-cutting state, prefer lifting only what is strictly necessary into `App` and pushing feature-local state into the feature's own component/hook (as already done for tab-local UI state in `src/features/project-detail/tabs/*.tsx`). If state ownership keeps growing, consider extracting a dedicated hook (e.g. `useProjectsController`) out of `App.tsx` rather than adding more `useState` calls directly.

### Manually synchronized dual-write storage

**What happens:** Every `Project` save writes the same data twice (flat SQL columns + JSON blob) via `toProjectRecord()` in `src/lib/storageAdapters.ts`, mirrored by a matching Rust struct/SQL statement in `src-tauri/src/lib.rs`.
**Why it's wrong:** Adding or renaming a field on `Project` (`src/data/types.ts`) that should be filterable requires touching four places (TS type, `toProjectRecord`, Rust `ProjectRecordInput`, SQL schema/upsert) with no compiler-enforced link between them; a missed update silently desyncs list-filtering from actual project data.
**Do this instead:** When adding a new filterable field, update `toProjectRecord()`, the Rust `ProjectRecordInput` struct, and the `CREATE TABLE`/`INSERT ... ON CONFLICT` statements in `src-tauri/src/lib.rs` together in the same change, and add/extend a test in `src/lib/storage.test.ts` asserting the new field round-trips.

## Error Handling

**Strategy:** Try/catch at every async boundary in `App`, with user-facing Hungarian error banners; no error boundary components exist.

**Patterns:**
- All async operations (`startNewProject`, `saveProject`, `refreshLists`, `exportProjects`) are wrapped in try/catch, log to `console.error`, and set `appError`/`saveStatus` state (`src/App.tsx`)
- Storage adapter errors are thrown as `String`s from Rust (`Result<T, String>`) via IPC and surfaced as JS exceptions caught in the calling adapter method (`src-tauri/src/lib.rs`, `src/lib/storageAdapters.ts`)
- No error boundary exists — an uncaught render error anywhere in the component tree crashes the whole app

## Cross-Cutting Concerns

**Logging:** `console.error`/`console.warn` only; no structured logging or remote error reporting.
**Validation:** No schema validation library; TypeScript types and manual defaults (`createDraftProject()` in `src/lib/project.ts`) are the only guardrails on `Project` shape.
**Authentication:** None — single-user local desktop app with no auth layer.

---

*Architecture analysis: 2026-07-08*
