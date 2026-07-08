<!-- refreshed: 2026-07-08 -->
# Architecture

**Analysis Date:** 2026-07-08

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                  React Frontend (Vite + TS)                  │
│                        src/App.tsx                           │
├──────────────────┬──────────────────┬───────────────────────┤
│  ProjectTable    │  ProjectDetail   │    Export UI           │
│  (list/archive)  │  (tabs/editor)   │  ExportPresetSelect   │
│  `src/features/  │  `src/features/  │  `src/features/        │
│   projects/`     │   project-detail/`│   export/`            │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Storage & Business Logic Layer                  │
│   ProjectRepository  `src/lib/storage.ts`                    │
│   StorageAdapters    `src/lib/storageAdapters.ts`            │
│   Project logic      `src/lib/project.ts`                    │
│   Export builders    `src/lib/export.ts`, `exportPlan.ts`    │
└──────────────────────────┬──────────────────────────────────┘
         │ isTauriRuntime() branch
         ▼
┌──────────────────────────────────────────────────┐
│            Tauri IPC Boundary                     │
│  @tauri-apps/api/core  invoke()                   │
└──────────────────────────┬───────────────────────┘
                           │
         ┌─────────────────▼──────────────────┐
         │      Rust Backend (src-tauri/)       │
         │  lib.rs — Tauri commands             │
         │  SQLite via rusqlite                 │
         │  exports via filesystem              │
         └────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `App` | Root state, view routing, CRUD orchestration | `src/App.tsx` |
| `ProjectTable` | List/archive view, filtering, bulk selection, export trigger | `src/features/projects/ProjectTable.tsx` |
| `ProjectDetail` | Tab-based detail editor/viewer, checklist, interview, decision | `src/features/project-detail/ProjectDetailView.tsx` |
| `ProjectRepository` | Unified persistence API, adapter selection | `src/lib/storage.ts` |
| `TauriSqliteProjectStorageAdapter` | IPC calls to Rust SQLite backend | `src/lib/storageAdapters.ts` |
| `LocalProjectStorageAdapter` | Fallback to browser `localStorage` | `src/lib/storageAdapters.ts` |
| Rust commands | SQLite CRUD + file export to disk | `src-tauri/src/lib.rs` |

## Pattern Overview

**Overall:** Single-page application with optional native backend via Tauri IPC. The frontend owns all business logic and UI state; the backend is a thin persistence + file I/O layer.

**Key Characteristics:**
- No routing library — view switching is a `useState<AppView>` string in `App`
- No global state manager — all state lives in `App` component and is passed down as props
- Storage is abstracted behind an adapter interface; Tauri SQLite is preferred, `localStorage` is the fallback
- The full `Project` object is serialized to JSON and stored in the `data` column; queryable columns (`name`, `status`, etc.) are duplicated for list queries

## Layers

**Presentation Layer:**
- Purpose: Render UI, handle user interactions, drive state changes
- Location: `src/App.tsx`, `src/features/`, `src/ui/`
- Contains: React components, local UI state (tab, interview step, checklist expand state)
- Depends on: storage layer, lib, data types
- Used by: nothing (top of stack)

**Business Logic / Library Layer:**
- Purpose: Domain calculations (completion %, decision scores, readiness gaps), project factory, export building
- Location: `src/lib/project.ts`, `src/lib/export.ts`, `src/lib/exportPlan.ts`
- Contains: Pure functions, no React
- Depends on: `src/data/types.ts`, `src/data/checklist.ts`
- Used by: `App`, `ProjectRepository`, detail tabs

**Storage Layer:**
- Purpose: Abstract persistence behind a single `ProjectRepository` API
- Location: `src/lib/storage.ts`, `src/lib/storageAdapters.ts`, `src/lib/storageTypes.ts`
- Contains: `ProjectRepository` class, two adapter implementations
- Depends on: `@tauri-apps/api/core` (conditionally), `localStorage`
- Used by: `App`

**Rust Backend:**
- Purpose: SQLite CRUD, export file writing to disk
- Location: `src-tauri/src/lib.rs`
- Contains: Six Tauri commands (`save_export_file`, `project_storage_info`, `list_projects_native`, `get_project_native`, `save_project_native`, `delete_project_native`)
- Depends on: `rusqlite`, `serde`
- Used by: `TauriSqliteProjectStorageAdapter` via IPC invoke

## Data Flow

### App Initialization

1. `src/main.tsx` — React root mounts `<App />`
2. `App` `useEffect` calls `projectRepository.init()`
3. `ProjectRepository.init()` calls `createProjectStorageAdapter()` in `src/lib/storageAdapters.ts`
4. `isTauriRuntime()` checks `window.__TAURI_INTERNALS__` or `window.__TAURI__`
5. If Tauri: dynamically imports `@tauri-apps/api/core`, calls `project_storage_info` IPC command, constructs `TauriSqliteProjectStorageAdapter`
6. If browser: constructs `LocalProjectStorageAdapter`
7. `App` sets `storageMode` display string and calls `refreshLists()`

### Project Save Flow

1. User edits a field in a detail tab
2. Tab calls `onChange(updater)` prop
3. `App.updateSelectedProject` runs the updater, calls `touchProject` (updates `updatedAt`), fires `saveProject(next)`
4. `saveProject` calls `projectRepository.saveProject(project)` which calls `recalculateProject` then the adapter
5. Tauri adapter: calls `save_project_native` IPC with `ProjectRecordInput` (structured columns + full JSON in `data` field)
6. Rust `save_project_native`: upserts row in SQLite `projects` table
7. `refreshLists()` re-fetches active and archived lists and updates `App` state

### Export Flow

1. User selects projects and clicks PDF/Excel export
2. `App.exportProjects` loads full `Project` objects via `projectRepository.getProject`
3. Calls `buildProjectsPdfBlob` or `buildProjectsExcelBlob` in `src/lib/export.ts`
4. Calls `saveExportBlob(blob, fileName)` — in Tauri runtime this invokes `save_export_file` IPC; in browser it triggers a download
5. Rust `save_export_file`: writes bytes to `<app-dir>/exports/<sanitized-name>`

## Key Abstractions

**ProjectStorageAdapter Interface:**
- Purpose: Decouple repository from Tauri vs browser runtime
- File: `src/lib/storageTypes.ts`
- Implementations: `TauriSqliteProjectStorageAdapter`, `LocalProjectStorageAdapter` in `src/lib/storageAdapters.ts`
- Pattern: Factory function `createProjectStorageAdapter()` selects implementation at runtime

**ProjectCompletion (computed field):**
- Purpose: All derived scores — readiness %, decision score, recommendations, gaps — live on `project.completion`
- Recalculated on every save via `recalculateProject()` in `src/lib/project.ts`
- Never stored as authoritative data; always recomputed from raw answers

## Entry Points

**Web/Dev entry:**
- Location: `src/main.tsx`
- Triggers: Vite dev server or production HTML load
- Responsibilities: Mounts React root into `#root` div in `index.html`

**Tauri native entry:**
- Location: `src-tauri/src/main.rs` → calls `src-tauri/src/lib.rs::run()`
- Triggers: Native app launch
- Responsibilities: Registers Tauri commands, starts WebView window

## Architectural Constraints

- **Global state:** Single module-level `projectRepository` singleton exported from `src/lib/storage.ts`. All components depend on it through `App` props.
- **Threading:** Single-threaded JS frontend; Rust commands run synchronously on the Tauri main thread (no async Rust used)
- **Circular imports:** None detected
- **Data duplication:** Project JSON is stored twice — as structured columns for filtering, and as full JSON blob in `data` column. These must stay in sync via `toProjectRecord()` in `src/lib/storageAdapters.ts`
- **No routing library:** Navigation is a `useState<AppView>` enum. Adding a route requires modifying `App.tsx` directly.

## Anti-Patterns

### App as God Component

**What happens:** `App.tsx` holds all top-level state (projects, archive, selected project, save status, view, filters, export preset, selection set) and passes everything down as props.
**Why it's wrong:** Adding any new cross-cutting feature requires modifying `App.tsx`.
**Do this instead:** Extract domain slices (e.g., `useProjectList`, `useDetailState`) into hooks in `src/hooks/` as the feature set grows.

## Error Handling

**Strategy:** Try/catch blocks in `App` async handlers set `appError` state, which renders an error banner.

**Patterns:**
- All async operations (`startNewProject`, `saveProject`, `refreshLists`, `exportProjects`) are wrapped in try/catch
- Storage adapter errors are thrown as strings from Rust via IPC and caught in the adapter
- No error boundary components exist — an uncaught render error would crash the whole app

## Cross-Cutting Concerns

**Logging:** `console.error` in catch blocks; no structured logging
**Validation:** Domain validation is purely computed (readiness gaps) rather than form validation
**Authentication:** None — local desktop app with no auth layer

---

*Architecture analysis: 2026-07-08*
