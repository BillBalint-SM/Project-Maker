# Codebase Structure

**Analysis Date:** 2026-07-08

## Directory Layout

```
repo/
├── src/                          # React/TypeScript frontend
│   ├── App.tsx                   # Root component: state, routing, CRUD orchestration
│   ├── App.test.tsx              # Tests for App
│   ├── main.tsx                  # Vite/React entry point, mounts #root
│   ├── styles.css                # Global CSS (no CSS-in-JS / Tailwind)
│   ├── app/
│   │   └── viewTypes.ts          # Shared view-related types (DetailMode, SaveStatus, filters)
│   ├── data/
│   │   ├── types.ts              # Core domain types (Project, ChecklistAnswer, etc.)
│   │   └── checklist.ts          # Static checklist template data
│   ├── features/
│   │   ├── export/
│   │   │   ├── exportPreset.ts        # Export preset labels/logic
│   │   │   └── ExportPresetSelect.tsx # Preset picker UI component
│   │   ├── project-detail/
│   │   │   ├── ProjectDetailView.tsx  # Tab container for a single project
│   │   │   ├── ProjectDetailView.test.tsx
│   │   │   ├── detailTypes.ts         # Types local to project-detail feature
│   │   │   ├── detailUi.tsx           # Shared UI bits for detail tabs
│   │   │   └── tabs/                  # One file per detail tab
│   │   │       ├── OverviewTab.tsx
│   │   │       ├── ChecklistTab.tsx
│   │   │       ├── InterviewTab.tsx
│   │   │       ├── FollowUpsTab.tsx
│   │   │       ├── DecisionTab.tsx
│   │   │       └── CockpitTab.tsx
│   │   └── projects/
│   │       ├── ProjectTable.tsx       # List/archive table, filters, bulk export
│   │       └── ProjectTable.test.tsx
│   ├── lib/
│   │   ├── project.ts             # Domain calculations, project factory
│   │   ├── project.test.ts
│   │   ├── export.ts              # PDF/Excel blob building, file save
│   │   ├── exportPlan.ts          # Export content planning/shaping
│   │   ├── exportPlan.test.ts
│   │   ├── storage.ts             # ProjectRepository (persistence facade)
│   │   ├── storage.test.ts
│   │   ├── storageAdapters.ts     # SQLite (Tauri IPC) + localStorage adapters
│   │   └── storageTypes.ts        # ProjectStorageAdapter interface
│   ├── test/
│   │   ├── builders.ts            # Test data builders/factories
│   │   └── setup.ts               # Vitest/jsdom global setup
│   └── ui/
│       └── common.tsx             # Small shared UI primitives (tooltip button, formatTime)
├── src-tauri/                    # Rust/Tauri native backend
│   ├── src/
│   │   ├── main.rs                # Native entry point, calls lib.rs::run()
│   │   └── lib.rs                 # Tauri commands: SQLite CRUD, file export
│   ├── capabilities/
│   │   └── default.json           # Tauri permission capabilities
│   ├── icons/                     # App icons (.ico, .png)
│   ├── windows/nsis/              # Windows NSIS installer customization
│   ├── Cargo.toml / Cargo.lock    # Rust dependencies
│   ├── build.rs                   # Tauri build script
│   └── tauri.conf.json            # App window/bundle configuration
├── docs/                          # Design docs, ADRs, plans (Markdown/HTML)
│   ├── adr/                       # Architecture decision records
│   ├── codebase-architecture-refactor/
│   └── project-intake-app/
├── .planning/                     # GSD planning artifacts (this document's home)
│   ├── codebase/                  # Generated codebase maps (this directory)
│   ├── phases/                    # Per-phase planning docs
│   └── research/                  # Pre-project research docs
├── .github/workflows/ci.yml       # CI pipeline
├── scripts/                       # PowerShell release/security scripts
├── public/favicon.svg             # Static asset served as-is
├── index.html                     # Vite HTML entry point
├── vite.config.ts                 # Vite + Vitest shared config
├── tsconfig.json                  # TypeScript compiler config
├── package.json / pnpm-lock.yaml  # Node dependencies
└── pnpm-workspace.yaml            # pnpm workspace definition
```

## Directory Purposes

**`src/features/`:**
- Purpose: Feature-scoped UI modules, one subdirectory per user-facing feature area
- Contains: Components, feature-local types, feature-local tests
- Key files: `src/features/projects/ProjectTable.tsx`, `src/features/project-detail/ProjectDetailView.tsx`

**`src/features/project-detail/tabs/`:**
- Purpose: One file per tab shown inside the project detail view
- Contains: Tab-specific form/display components, each owning its own local UI state
- Key files: `OverviewTab.tsx`, `ChecklistTab.tsx`, `InterviewTab.tsx`, `FollowUpsTab.tsx`, `DecisionTab.tsx`, `CockpitTab.tsx`

**`src/lib/`:**
- Purpose: Framework-agnostic domain logic and persistence — no React imports here
- Contains: Pure calculation functions, export builders, storage adapters/facade
- Key files: `project.ts` (domain calc), `storage.ts` (repository facade), `storageAdapters.ts` (SQLite/localStorage), `export.ts` (PDF/Excel)

**`src/data/`:**
- Purpose: Domain type definitions and static reference data shared across the whole app
- Contains: `types.ts` (all domain types), `checklist.ts` (static checklist template)

**`src-tauri/`:**
- Purpose: Native Rust backend for the Tauri desktop shell
- Contains: Tauri commands (IPC handlers), SQLite schema/queries, app config, Windows installer assets
- Key files: `src-tauri/src/lib.rs` (all commands + SQLite logic), `src-tauri/tauri.conf.json` (app/bundle config)

**`.planning/`:**
- Purpose: GSD workflow artifacts — roadmap, phase plans, research, generated codebase docs
- Generated: Partially (this `codebase/` subdirectory is fully generated)
- Committed: Yes

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React app bootstrap, mounts `<App />`
- `src-tauri/src/main.rs`: Native executable entry, delegates to `lib.rs::run()`
- `index.html`: Vite HTML shell, references `src/main.tsx`

**Configuration:**
- `vite.config.ts`: Dev server (port 5173) + Vitest config (jsdom, setup file `src/test/setup.ts`)
- `tsconfig.json`: `strict: true`, target `ES2020`, no path aliases
- `src-tauri/tauri.conf.json`: Window size, bundle target (nsis), dev URL
- `src-tauri/capabilities/default.json`: Tauri permission capabilities (`core:default` only)

**Core Logic:**
- `src/App.tsx`: Root state and view routing
- `src/lib/project.ts`: Derived score calculation, project factory (`createDraftProject`, `recalculateProject`, `touchProject`)
- `src/lib/storage.ts`: `ProjectRepository` — the single persistence entry point
- `src/lib/storageAdapters.ts`: Adapter implementations and runtime selection (`createProjectStorageAdapter`)
- `src-tauri/src/lib.rs`: All native Tauri commands and SQLite schema

**Testing:**
- Co-located `*.test.ts`/`*.test.tsx` files next to the code they test
- `src/test/setup.ts`: Global Vitest/jsdom setup
- `src/test/builders.ts`: Shared test data builders

## Naming Conventions

**Files:**
- Components: PascalCase `.tsx` — `ProjectTable.tsx`, `ProjectDetailView.tsx`, `OverviewTab.tsx`
- Lib/utilities: camelCase `.ts` — `project.ts`, `storage.ts`, `exportPlan.ts`
- Types files: `types.ts` (singular) at the domain root; feature-scoped equivalents named `<feature>Types.ts` (e.g. `detailTypes.ts`, `viewTypes.ts`, `storageTypes.ts`)
- Test files: co-located, same base name + `.test.ts`/`.test.tsx` — `ProjectTable.test.tsx`, `storage.test.ts`

**Directories:**
- Feature directories under `src/features/` are lowercase-kebab or lowercase single words: `project-detail`, `projects`, `export`
- Rust source lives entirely under `src-tauri/src/`, separate from the TS `src/` tree

## Where to Add New Code

**New Feature:**
- Primary code: new subdirectory under `src/features/<feature-name>/`
- Tests: co-located `*.test.tsx` inside the same feature directory
- If the feature needs new domain types, add them to `src/data/types.ts` (shared) or a feature-local `<feature>Types.ts`

**New Detail Tab:**
- Implementation: `src/features/project-detail/tabs/<Name>Tab.tsx`
- Wire into `ProjectDetailView.tsx` tab list and `detailTypes.ts` if a new `GapTargetTab` value is needed (also update `src/data/types.ts`)

**New Persistence Field:**
- Add to `Project` type in `src/data/types.ts`
- If it must be filterable/sortable, update `toProjectRecord()` in `src/lib/storageAdapters.ts`, the Rust `ProjectRecordInput` struct, and the SQL schema/upsert in `src-tauri/src/lib.rs` together
- Add/extend round-trip test in `src/lib/storage.test.ts`

**New Tauri Command:**
- Implementation: add a `#[tauri::command]` function in `src-tauri/src/lib.rs`
- Register it in the `invoke_handler(tauri::generate_handler![...])` list in `run()`
- Call it from a TS adapter method via `invoke<T>("command_name", args)` in `src/lib/storageAdapters.ts` (or a new adapter file)

**Utilities:**
- Shared framework-agnostic helpers: `src/lib/`
- Shared small UI primitives: `src/ui/common.tsx`

## Special Directories

**`.planning/`:**
- Purpose: GSD workflow state — roadmap, phase plans, requirements, generated codebase documentation
- Generated: Partially (`.planning/codebase/` is fully generated; other files are authored/maintained manually)
- Committed: Yes

**`src-tauri/windows/nsis/`:**
- Purpose: Windows NSIS installer customization assets
- Generated: No
- Committed: Yes

**`docs/`:**
- Purpose: Architecture decision records, design docs, user guide
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-07-08*
