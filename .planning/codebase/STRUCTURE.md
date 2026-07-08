# Codebase Structure

**Analysis Date:** 2026-07-08

## Directory Layout

```
repo/
├── index.html                    # Vite HTML entry point, mounts #root
├── vite.config.ts                # Vite + React plugin config
├── tsconfig.json                 # TypeScript config
├── package.json                  # Frontend deps (React, Tauri API, lucide-react, etc.)
├── pnpm-workspace.yaml           # pnpm workspace root
├── pnpm-lock.yaml                # Lockfile
├── public/
│   └── favicon.svg
├── src/                          # All frontend TypeScript/React source
│   ├── main.tsx                  # React DOM root mount
│   ├── App.tsx                   # Root component — view routing, top-level state
│   ├── App.test.tsx              # Smoke tests for App
│   ├── styles.css                # Global CSS
│   ├── app/
│   │   └── viewTypes.ts          # Shared view-layer types (DetailMode, SaveStatus, etc.)
│   ├── data/
│   │   ├── types.ts              # All domain types (Project, ChecklistAnswer, etc.)
│   │   └── checklist.ts          # Static checklist template (array of ChecklistTemplateItem)
│   ├── features/
│   │   ├── export/
│   │   │   ├── exportPreset.ts   # ExportPreset labels map
│   │   │   └── ExportPresetSelect.tsx  # Preset dropdown UI component
│   │   ├── project-detail/
│   │   │   ├── ProjectDetailView.tsx   # Tab container, detail state, edit/view mode
│   │   │   ├── ProjectDetailView.test.tsx
│   │   │   ├── detailTypes.ts    # DetailTab union type
│   │   │   ├── detailUi.tsx      # DetailTabs nav, Metric tile components
│   │   │   └── tabs/
│   │   │       ├── CockpitTab.tsx      # Decision cockpit — gap list, score summary
│   │   │       ├── InterviewTab.tsx    # Guided interview wizard (quick/full mode)
│   │   │       ├── OverviewTab.tsx     # Basic project fields editor
│   │   │       ├── ChecklistTab.tsx    # Expandable checklist items
│   │   │       ├── FollowUpsTab.tsx    # Follow-up questions list
│   │   │       └── DecisionTab.tsx     # Decision scores + final decision fields
│   │   └── projects/
│   │       ├── ProjectTable.tsx        # List/archive table with filters, bulk export
│   │       └── ProjectTable.test.tsx
│   ├── lib/
│   │   ├── project.ts            # Domain logic: createDraftProject, recalculateProject, toProjectListItem
│   │   ├── project.test.ts
│   │   ├── storage.ts            # ProjectRepository class + singleton export
│   │   ├── storage.test.ts
│   │   ├── storageAdapters.ts    # TauriSqliteProjectStorageAdapter, LocalProjectStorageAdapter, factory fn
│   │   ├── storageTypes.ts       # ProjectStorageAdapter interface, ProjectStorageInfo
│   │   ├── export.ts             # buildProjectsPdfBlob, buildProjectsExcelBlob, saveExportBlob
│   │   ├── exportPlan.ts         # Export content planning/formatting logic
│   │   └── exportPlan.test.ts
│   ├── ui/
│   │   └── common.tsx            # Shared UI: TooltipIconButton, SaveState, formatTime
│   └── test/
│       ├── builders.ts           # Test data builder helpers
│       └── setup.ts              # Vitest global setup
├── src-tauri/                    # Rust/Tauri native backend
│   ├── Cargo.toml                # Rust dependencies (tauri, rusqlite, serde)
│   ├── Cargo.lock
│   ├── build.rs                  # Tauri build script
│   ├── tauri.conf.json           # Tauri app config (identifier, window, bundle)
│   ├── capabilities/
│   │   └── default.json          # Tauri capability permissions
│   ├── icons/                    # App icons
│   └── src/
│       ├── main.rs               # Binary entry point — calls lib::run()
│       └── lib.rs                # All Tauri commands + SQLite logic
├── docs/                         # Design docs and ADRs
│   ├── adr/
│   │   └── 0001-offline-first-tauri-sqlite.md
│   └── codebase-architecture-refactor/design.md
└── .github/workflows/ci.yml      # CI pipeline
```

## Directory Purposes

**`src/app/`:**
- Purpose: Shared view-layer type definitions used across App and features
- Key files: `viewTypes.ts` — `DetailMode`, `SaveStatus`, `ProjectListFilter`

**`src/data/`:**
- Purpose: Static data and all domain type definitions
- Key files: `types.ts` (all interfaces/enums), `checklist.ts` (static checklist array)
- Note: No runtime logic — pure type/data declarations

**`src/features/`:**
- Purpose: Feature-scoped React components, co-located with their types and tests
- Contains: `export/`, `project-detail/`, `projects/`
- Pattern: Each feature subdirectory owns its components and local types

**`src/lib/`:**
- Purpose: Framework-independent business logic and storage layer
- Contains: Pure functions, classes, and the `projectRepository` singleton
- Note: No React imports — fully testable without rendering

**`src/ui/`:**
- Purpose: Generic, reusable UI primitives not tied to any feature
- Key files: `common.tsx` — `TooltipIconButton`, `SaveState`, `formatTime`

**`src/test/`:**
- Purpose: Shared test utilities
- Key files: `builders.ts` (factory helpers), `setup.ts` (Vitest global setup)

**`src-tauri/src/`:**
- Purpose: All Rust backend code — SQLite operations and file system access
- Key files: `lib.rs` (all Tauri command implementations), `main.rs` (binary entry)

## Key File Locations

**Entry Points:**
- `src/main.tsx`: Frontend React mount
- `src-tauri/src/main.rs`: Native binary entry, calls `lib::run()`

**Domain Types:**
- `src/data/types.ts`: Single source of truth for all TypeScript interfaces

**Core Business Logic:**
- `src/lib/project.ts`: `createDraftProject`, `recalculateProject`, `toProjectListItem`, `touchProject`
- `src/lib/storage.ts`: `ProjectRepository` class, `projectRepository` singleton

**Storage Adapters:**
- `src/lib/storageAdapters.ts`: `createProjectStorageAdapter` factory, both adapter classes

**Rust Commands:**
- `src-tauri/src/lib.rs`: All six Tauri IPC commands + SQLite schema creation

**Export:**
- `src/lib/export.ts`: `buildProjectsPdfBlob`, `buildProjectsExcelBlob`, `saveExportBlob`
- `src/lib/exportPlan.ts`: Export content formatting

**Configuration:**
- `vite.config.ts`: Frontend build config
- `src-tauri/tauri.conf.json`: App identifier, window config, bundle settings

## Naming Conventions

**Files:**
- React components: PascalCase (e.g., `ProjectDetailView.tsx`, `ChecklistTab.tsx`)
- Non-component TS modules: camelCase (e.g., `storageAdapters.ts`, `exportPlan.ts`)
- Type-only files: camelCase with "Types" suffix (e.g., `viewTypes.ts`, `detailTypes.ts`, `storageTypes.ts`)
- Test files: co-located, `.test.ts` or `.test.tsx` suffix

**Directories:**
- Feature directories: kebab-case (e.g., `project-detail/`, `projects/`)
- Top-level src subdirs: lowercase (e.g., `app/`, `data/`, `lib/`, `ui/`, `test/`)

## Where to Add New Code

**New feature UI component:**
- Implementation: `src/features/<feature-name>/<ComponentName>.tsx`
- Tests: `src/features/<feature-name>/<ComponentName>.test.tsx`
- Local types: `src/features/<feature-name>/<featureName>Types.ts`

**New detail tab:**
- Implementation: `src/features/project-detail/tabs/<TabName>Tab.tsx`
- Register in `ProjectDetailView.tsx` — add to `DetailTab` union in `src/features/project-detail/detailTypes.ts`, add render branch and tab button

**New business logic / domain function:**
- Location: `src/lib/project.ts` (project domain) or a new `src/lib/<name>.ts` module

**New Tauri command:**
- Add Rust function with `#[tauri::command]` in `src-tauri/src/lib.rs`
- Register in `tauri::generate_handler![]` in `lib.rs::run()`
- Add corresponding adapter method in `TauriSqliteProjectStorageAdapter` in `src/lib/storageAdapters.ts`
- Mirror the method signature on `ProjectStorageAdapter` interface in `src/lib/storageTypes.ts`

**Shared UI primitives:**
- Location: `src/ui/common.tsx`

**New domain type:**
- Location: `src/data/types.ts`

## Special Directories

**`src-tauri/target/`:**
- Purpose: Rust build artifacts
- Generated: Yes
- Committed: No (in `.gitignore`)

**`src-tauri/capabilities/`:**
- Purpose: Tauri v2 permission declarations for IPC commands
- Generated: No
- Committed: Yes

**`docs/`:**
- Purpose: Architecture decision records and design documents
- Generated: No
- Committed: Yes

**`src/test/`:**
- Purpose: Shared test helpers only — not a mirror of `src/` structure
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-07-08*
