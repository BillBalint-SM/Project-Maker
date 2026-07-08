# Coding Conventions

**Analysis Date:** 2026-07-08

## Naming Patterns

**Files:**
- React components: PascalCase `.tsx` — `ProjectTable.tsx`, `ProjectDetailView.tsx`, `ExportPresetSelect.tsx`
- Lib/domain modules: camelCase `.ts` — `project.ts`, `storage.ts`, `exportPlan.ts`, `export.ts`
- Types modules: `types.ts` for domain types (`src/data/types.ts`), narrower `*Types.ts` for subsystem types (`src/lib/storageTypes.ts`, `src/app/viewTypes.ts`, `src/features/project-detail/detailTypes.ts`)
- UI helper modules: camelCase, singular purpose — `detailUi.tsx` (shared detail UI atoms), `common.tsx` (shared generic UI atoms)
- Tab components live under `src/features/project-detail/tabs/` and are named `<Name>Tab.tsx` — `ChecklistTab.tsx`, `CockpitTab.tsx`, `DecisionTab.tsx`, `FollowUpsTab.tsx`, `InterviewTab.tsx`, `OverviewTab.tsx`

**Functions:**
- camelCase verbs describing action: `createDraftProject`, `recalculateProject`, `createFollowUpFromChecklist`, `toProjectListItem` (`src/lib/project.ts`)
- Factory functions prefixed `create*`: `createDraftProject`, `createDefaultChecklistAnswers`, `createProjectStorageAdapter`
- Conversion functions prefixed `to*`: `toProjectListItem`, `toProjectRecord` (`src/lib/storageAdapters.ts`)

**Variables:**
- camelCase throughout; no Hungarian-notation or type-prefixing
- Domain/UI copy strings are in Hungarian (e.g. `"Pontosítás szükséges"`, `"Nyitott"`, `"Kész"`) — identifiers themselves stay in English

**Types:**
- PascalCase for both `type` and `interface` names: `Project`, `ChecklistAnswer`, `AppView`, `ProjectListFilter`

## Code Style

**TypeScript strictness:**
- `tsconfig.json` has `"strict": true`; write null-safe code, avoid `any`
- Target `ES2020`, `moduleResolution: Node`, `jsx: react-jsx`, no path aliases — use relative imports (`../data/types`, `./project`)

**`type` vs `interface`:**
- Use `type` for union/string-literal types and discriminated unions: `type AppView = "home" | "projects" | "archive" | "detail"` (`src/App.tsx:18`)
- Use `interface` for object shapes / data records: `interface ChecklistAnswer { ... }` (`src/data/types.ts:45`)

**Type-only imports:**
- Always use `import type { ... }` for type-only imports: `import type { Project, ProjectListItem } from "./data/types"` (`src/App.tsx:3`)
- Never import a type without the `type` keyword — this is enforced by convention across the codebase, not just style preference

**Type assertions:**
- `satisfies` is used for narrowing/validating object literals against a type without widening: `"needsClarification" satisfies ProjectListFilter`, and in tests: `{ ...answer, status: "Kész" } satisfies ChecklistAnswer` (`src/lib/project.test.ts:29`)

**Formatting/Linting:**
- No ESLint or Prettier config detected in the repo — no automated linting/formatting is enforced. Match surrounding code style manually: 2-space indentation, double quotes for strings, semicolons required.

## Import Organization

**Order (observed pattern):**
1. External packages (`react`, `vitest`, `@testing-library/*`)
2. Relative type imports (`import type { ... } from "../data/types"`)
3. Relative value imports (local lib/component modules)

**Path Aliases:**
- None configured. All cross-module imports use relative paths (`../lib/project`, `./storage`, `../test/builders`).

## Error Handling

- Async operations at the top of the call stack (`App` component handlers: `startNewProject`, `saveProject`, `refreshLists`, `exportProjects`) are wrapped in try/catch.
- Storage adapter errors surface as strings thrown across the Tauri IPC boundary and are caught by the calling adapter method in `src/lib/storageAdapters.ts`.
- The `LocalProjectStorageAdapter` fails soft on corrupted data: a broken/non-JSON `localStorage` payload is treated as "no projects" rather than throwing (see `src/lib/storage.test.ts` — "ignores broken localStorage payloads instead of crashing").
- No React error boundary exists anywhere in the tree — an uncaught render error crashes the whole app. When adding new UI, prefer defensive checks over letting exceptions propagate to render.

## Logging

- No logging framework in use. No `console.*` calls found in reviewed source files — keep new code silent on the happy path; avoid adding ad hoc `console.log` debugging statements to committed code.

## Comments

- Source files are largely comment-free; code is expected to be self-documenting through naming and small pure functions.
- No JSDoc/TSDoc usage observed. Do not add JSDoc blocks unless matching an existing pattern in the touched file.

## Function Design

**Size:** Small, single-purpose functions, especially in `src/lib/project.ts` (one function per domain calculation: completion %, decision score, readiness gaps).

**Parameters:** Domain functions take the full `Project` object (or a partial/overrides object) rather than long parameter lists, e.g. `recalculateProject(project: Project): Project`, `createFollowUpFromChecklist(project: Project, itemId: number)`.

**Return Values:** Pure functions return new objects rather than mutating input (`recalculateProject` returns a new `Project` with recomputed `completion`); no in-place mutation of `Project` state.

## Module Design

**Exports:** Named exports throughout (no default exports observed in `src/lib` or `src/features`) — e.g. `export function createDraftProject`, `export class ProjectRepository`.

**Domain vs UI separation:** Pure domain/calculation logic (`src/lib/project.ts`, `src/lib/export.ts`, `src/lib/exportPlan.ts`) contains no React imports and no side effects beyond IO (storage/export). UI components import from `lib` but never the reverse.

**Barrel Files:** None — no `index.ts` re-export barrels found; import directly from the specific module file.

## Language / Locale Note

- All user-facing strings (labels, statuses, validation messages) are in Hungarian. When adding new UI text or domain enum values, match existing Hungarian terminology exactly (e.g. status values `"Kész"`, `"Nyitott"`; recommendation `"Pontosítás szükséges"`) rather than introducing English strings into the UI layer.

---

*Convention analysis: 2026-07-08*
