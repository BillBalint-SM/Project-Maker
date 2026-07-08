<!-- GSD:project-start source:PROJECT.md -->

## Project

**Project-Maker**
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.5.4 - All frontend source (`src/`)
- Rust (edition 2021) - Tauri backend (`src-tauri/src/`)
- HTML - Single entry point `index.html`
- CSS - Global styles `src/styles.css`

## Runtime

- Node.js (version not pinned; no `.nvmrc` or `.node-version` found)
- Rust toolchain via Cargo (version tracked in `src-tauri/Cargo.lock`)
- pnpm (workspace config in `pnpm-workspace.yaml`)
- Lockfile: `pnpm-lock.yaml` present

## Frameworks

- React 18.3.1 - UI rendering (`src/`)
- Tauri 2.0 - Desktop app shell, native IPC, OS integration (`src-tauri/`)
- Vitest 4.1.9 - Test runner and assertion library (config in `vite.config.ts`)
- @testing-library/react 16.3.2 - Component testing
- @testing-library/user-event 14.6.1 - User interaction simulation
- jsdom 29.1.1 - DOM environment for tests
- Vite 8.0.16 - Dev server and production bundler (`vite.config.ts`)
- @vitejs/plugin-react 6.0.2 - React Fast Refresh and JSX transform

## Key Dependencies

- `@tauri-apps/api` ^2.0.0 - Frontend-to-Rust IPC bridge (`src/lib/storageAdapters.ts`, `src/lib/export.ts`)
- `react` / `react-dom` ^18.3.1 - UI layer
- `rusqlite` 0.32 (bundled) - Embedded SQLite for offline data storage (`src-tauri/src/lib.rs`)
- `serde` / `serde_json` 1 - Rust JSON serialization for IPC payloads (`src-tauri/src/lib.rs`)
- `jspdf` ^4.2.1 - PDF generation (landscape A4, `src/lib/export.ts`)
- `jspdf-autotable` ^5.0.8 - Table rendering inside PDFs (`src/lib/export.ts`)
- `pdfmake` ^0.2.20 - Provides VFS font bundle (Roboto TTF, `src/lib/export.ts`)
- `fflate` ^0.8.3 - In-memory ZIP compression for `.xlsx` file assembly (`src/lib/export.ts`)
- `lucide-react` ^0.468.0 - SVG icon set used in UI components

## Configuration

- `tsconfig.json`: `strict: true`, target `ES2020`, `moduleResolution: Node`, `jsx: react-jsx`
- No path aliases defined
- `vite.config.ts`: shared config for dev server (port 5173) and Vitest (`jsdom` environment, setup file `src/test/setup.ts`)
- `src-tauri/tauri.conf.json`: Tauri app config — window size (1280x820), bundle target `nsis` (Windows installer), dev URL `http://127.0.0.1:5173`
- No `.env` files detected; no runtime environment variables required by the frontend
- Tauri capabilities defined in `src-tauri/capabilities/default.json` (`core:default` permissions only)

## Dev Tooling

## Platform Requirements

- Node.js + pnpm
- Rust toolchain + Cargo
- Tauri CLI (`@tauri-apps/cli` ^2.0.0)
- Windows desktop only (bundle target: `nsis`)
- Installer language: Hungarian (primary), English (secondary)
- App identifier: `com.projectmaker.desktop`

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## TypeScript Usage

- Use `type` for union/string-literal types: `type AppView = "home" | "projects" | "archive" | "detail"` (`src/App.tsx:18`)
- Use `interface` for object shapes: `interface ChecklistAnswer { ... }` (`src/data/types.ts:45`)
- Rule of thumb in this codebase: `type` for discriminated unions and domain enums; `interface` for data records
- Use `import type { ... }` for type-only imports throughout: `import type { Project, ProjectListItem } from "./data/types"` (`src/App.tsx:3`)
- Never import types without the `type` keyword
- Used for type-narrowing assertions: `"needsClarification" satisfies ProjectListFilter` (`src/features/projects/ProjectTable.test.tsx:50`)

## Component Patterns

## Naming Conventions

- Components: PascalCase `.tsx` — `ProjectTable.tsx`, `ProjectDetailView.tsx`
- Lib/utilities: camelCase `.ts` — `project.ts`, `storage.ts`, `exportPlan.ts`
- Types file: `types.ts` (singular)
- Test files: co-located, same name + `.test.ts` / `.test.tsx` — `ProjectTable.test.tsx`

## CSS / Styling Approach

## Import Organization

## Error Handling

## Comments and Documentation

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

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

- No routing library — view switching is a `useState<AppView>` string in `App`
- No global state manager — all state lives in `App` component and is passed down as props
- Storage is abstracted behind an adapter interface; Tauri SQLite is preferred, `localStorage` is the fallback
- The full `Project` object is serialized to JSON and stored in the `data` column; queryable columns (`name`, `status`, etc.) are duplicated for list queries

## Layers

- Purpose: Render UI, handle user interactions, drive state changes
- Location: `src/App.tsx`, `src/features/`, `src/ui/`
- Contains: React components, local UI state (tab, interview step, checklist expand state)
- Depends on: storage layer, lib, data types
- Used by: nothing (top of stack)
- Purpose: Domain calculations (completion %, decision scores, readiness gaps), project factory, export building
- Location: `src/lib/project.ts`, `src/lib/export.ts`, `src/lib/exportPlan.ts`
- Contains: Pure functions, no React
- Depends on: `src/data/types.ts`, `src/data/checklist.ts`
- Used by: `App`, `ProjectRepository`, detail tabs
- Purpose: Abstract persistence behind a single `ProjectRepository` API
- Location: `src/lib/storage.ts`, `src/lib/storageAdapters.ts`, `src/lib/storageTypes.ts`
- Contains: `ProjectRepository` class, two adapter implementations
- Depends on: `@tauri-apps/api/core` (conditionally), `localStorage`
- Used by: `App`
- Purpose: SQLite CRUD, export file writing to disk
- Location: `src-tauri/src/lib.rs`
- Contains: Six Tauri commands (`save_export_file`, `project_storage_info`, `list_projects_native`, `get_project_native`, `save_project_native`, `delete_project_native`)
- Depends on: `rusqlite`, `serde`
- Used by: `TauriSqliteProjectStorageAdapter` via IPC invoke

## Data Flow

### App Initialization

### Project Save Flow

### Export Flow

## Key Abstractions

- Purpose: Decouple repository from Tauri vs browser runtime
- File: `src/lib/storageTypes.ts`
- Implementations: `TauriSqliteProjectStorageAdapter`, `LocalProjectStorageAdapter` in `src/lib/storageAdapters.ts`
- Pattern: Factory function `createProjectStorageAdapter()` selects implementation at runtime
- Purpose: All derived scores — readiness %, decision score, recommendations, gaps — live on `project.completion`
- Recalculated on every save via `recalculateProject()` in `src/lib/project.ts`
- Never stored as authoritative data; always recomputed from raw answers

## Entry Points

- Location: `src/main.tsx`
- Triggers: Vite dev server or production HTML load
- Responsibilities: Mounts React root into `#root` div in `index.html`
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

## Error Handling

- All async operations (`startNewProject`, `saveProject`, `refreshLists`, `exportProjects`) are wrapped in try/catch
- Storage adapter errors are thrown as strings from Rust via IPC and caught in the adapter
- No error boundary components exist — an uncaught render error would crash the whole app

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
