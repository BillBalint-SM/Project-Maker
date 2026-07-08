# Coding Conventions

**Analysis Date:** 2026-07-08

## TypeScript Usage

**Mode:** Strict (`"strict": true` in `tsconfig.json`). `allowJs` is `false` — pure TypeScript only.

**Types vs Interfaces:**
- Use `type` for union/string-literal types: `type AppView = "home" | "projects" | "archive" | "detail"` (`src/App.tsx:18`)
- Use `interface` for object shapes: `interface ChecklistAnswer { ... }` (`src/data/types.ts:45`)
- Rule of thumb in this codebase: `type` for discriminated unions and domain enums; `interface` for data records

**Import type:**
- Use `import type { ... }` for type-only imports throughout: `import type { Project, ProjectListItem } from "./data/types"` (`src/App.tsx:3`)
- Never import types without the `type` keyword

**satisfies operator:**
- Used for type-narrowing assertions: `"needsClarification" satisfies ProjectListFilter` (`src/features/projects/ProjectTable.test.tsx:50`)

**Target:** ES2020, ESNext modules, `isolatedModules: true`.

## Component Patterns

**Functional components only.** No class components detected.

**Export style:** Named exports. No default component exports.
```typescript
export function App() { ... }          // src/App.tsx:20
export function TextField({ ... }) {   // src/ui/common.tsx:7
export function ProjectTable(...) {    // src/features/projects/ProjectTable.tsx
```

**Props:** Inline type annotations on destructured props (no separate Props type alias unless reused):
```typescript
export function TextField({
  name, label, value, disabled, onChange, textarea = false, type = "text"
}: {
  name?: string;
  label: string;
  ...
})
```

**Hooks:** Used directly inside function bodies. Custom hooks are not detected in the current codebase — logic lives in `src/lib/` modules called from component bodies.

**State:** `useState` with explicit generics where type cannot be inferred:
```typescript
const [view, setView] = useState<AppView>("home");
const [selectedProject, setSelectedProject] = useState<Project | null>(null);
```

**Side effects:** `useEffect` with full dependency arrays. Async logic wrapped in inner async functions or `.then()` chains, never `async useEffect`.

**Memoization:** `useMemo` used for derived list filtering (`src/App.tsx:51`). No `useCallback` detected.

## Naming Conventions

**Files:**
- Components: PascalCase `.tsx` — `ProjectTable.tsx`, `ProjectDetailView.tsx`
- Lib/utilities: camelCase `.ts` — `project.ts`, `storage.ts`, `exportPlan.ts`
- Types file: `types.ts` (singular)
- Test files: co-located, same name + `.test.ts` / `.test.tsx` — `ProjectTable.test.tsx`

**Components:** PascalCase — `ProjectTable`, `ProjectDetail`, `TextField`, `SelectField`

**Functions:** camelCase — `createDraftProject`, `recalculateProject`, `makeExportFileName`

**Variables:** camelCase — `selectedProject`, `visibleProjects`, `exportPreset`

**Types and Interfaces:** PascalCase — `Project`, `ProjectListItem`, `ChecklistAnswer`, `ExportPreset`

**Event handlers:** `on` prefix for props, handler function name mirrors action:
```typescript
onView={(id) => openProject(id, "view")}
onArchive={archiveProject}
```

**Boolean state:** No `is`/`has` prefix convention observed — plain nouns used: `archived`, `disabled`

## CSS / Styling Approach

**Plain CSS only.** Single global stylesheet at `src/styles.css`. No CSS modules, no Tailwind, no styled-components.

**CSS custom properties** for design tokens defined on `:root`:
```css
--primary: #126b68;
--danger: #b42318;
--surface: #ffffff;
--shadow: 0 18px 40px rgba(15, 23, 42, 0.09);
```

**Class-based styling:** Semantic class names applied via JSX `className`. Example: `"app-shell home-shell"`, `"topbar"`, `"home-grid"`, `"error-banner"`.

**Conditional classes:** String template or ternary inline:
```typescript
const shellClass = view === "home" ? "app-shell home-shell" : "app-shell";
```

**No utility-class framework.** Do not introduce Tailwind or CSS-in-JS.

## Import Organization

Observed order (no enforced linter rule, but consistently applied):

1. External packages (React, lucide-react)
2. Internal type imports (`import type { ... }`)
3. Internal lib/utility imports
4. Internal feature/component imports
5. Internal UI imports

```typescript
import { ArrowLeft, FilePlus2, FolderOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ExportPreset, Project, ProjectListItem } from "./data/types";
import { createDraftProject, touchProject } from "./lib/project";
import { projectRepository } from "./lib/storage";
import type { DetailMode, ProjectListFilter, SaveStatus } from "./app/viewTypes";
import { ProjectDetail } from "./features/project-detail/ProjectDetailView";
import { ProjectTable } from "./features/projects/ProjectTable";
import { TooltipIconButton, formatTime } from "./ui/common";
```

No path aliases configured. All imports use relative paths.

## Error Handling

**Async functions:** `try/catch` with `console.error(error)` + user-facing state update:
```typescript
async function refreshLists() {
  try {
    ...
  } catch (error) {
    console.error(error);
    setAppError("A projektlista betöltése nem sikerült.");
  }
}
```

**Error display:** String state (`appError`, `appNotice`) rendered as banner elements in JSX. No toast/notification library.

**Void operator:** Fire-and-forget async calls marked explicitly:
```typescript
void saveProject(next);   // src/App.tsx:158
```

**Storage corruption:** Graceful degradation — broken JSON payloads return empty arrays instead of throwing (`src/lib/storage.test.ts:35`).

## Comments and Documentation

**Minimal inline comments.** Code is self-documenting via naming.

**No JSDoc/TSDoc** annotations detected on public functions.

**No `TODO`/`FIXME` markers** detected in `src/`.

**Hungarian UI strings** are used directly in JSX and labels (the app is in Hungarian). No i18n layer.

---

*Convention analysis: 2026-07-08*
