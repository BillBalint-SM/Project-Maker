# Testing Patterns

**Analysis Date:** 2026-07-08

## Test Framework

**Runner:** Vitest 4.x
- Config: `vite.config.ts` (unified config, `test` key)
- Environment: `jsdom`
- Setup file: `src/test/setup.ts`

**Assertion Library:** Vitest built-in `expect` + `@testing-library/jest-dom` matchers (`.toBeInTheDocument()`, etc.)

**Component Testing:** `@testing-library/react` 16.x with `@testing-library/user-event` 14.x

**Run Commands:**
```bash
pnpm test              # vitest run (single pass)
pnpm test:watch        # vitest (watch mode)
pnpm run checkpoint    # typecheck + test + build (full gate)
pnpm run verify        # alias for checkpoint
```

No coverage command configured in `package.json`. No coverage threshold enforced.

## Test File Organization

**Pattern:** Co-located with source files. Test file sits next to the file it tests.

**Naming:** `[ModuleName].test.ts` or `[ComponentName].test.tsx`

**Test files found:**
- `src/App.test.tsx` — integration test for the root App component
- `src/features/project-detail/ProjectDetailView.test.tsx` — component test
- `src/features/projects/ProjectTable.test.tsx` — component test
- `src/lib/exportPlan.test.ts` — unit test for export plan builder
- `src/lib/project.test.ts` — unit test for domain logic
- `src/lib/storage.test.ts` — unit test for repository + storage adapter

**Test support directory:** `src/test/`
- `src/test/setup.ts` — global setup: imports jest-dom matchers, calls `cleanup()` in `afterEach`, patches `scrollIntoView`
- `src/test/builders.ts` — test data factories: `makeProject()` and `makeMemoryStorage()`

## Test Suite Structure

**Describe / it pattern:**
```typescript
describe("project domain", () => {
  it("creates a draft project with default checklist answers and calculated completion", () => {
    ...
  });
});
```

**Setup:** `beforeEach` with `vi.clearAllMocks()` and mock initialization (used in `App.test.tsx`).

**Async:** `async/await` throughout. `waitFor` used to wait for async state resolution after renders.

## Mocking

**Framework:** Vitest's built-in `vi` API.

**Module mocking pattern — `vi.hoisted` + `vi.mock`:**
```typescript
const repositoryMock = vi.hoisted(() => ({
  init: vi.fn(),
  listProjects: vi.fn(),
  saveProject: vi.fn(),
  ...
  mode: "localStorage"
}));

vi.mock("./lib/storage", () => ({
  projectRepository: repositoryMock
}));
```
(`src/App.test.tsx:7-29`)

**What is mocked:**
- `projectRepository` (the singleton storage object) — mocked at module level in App and component tests
- `src/lib/export` module — mocked in `App.test.tsx` to avoid actual PDF/Excel generation
- Tauri APIs — implicitly avoided because jsdom environment never calls native bridge

**What is NOT mocked:**
- Domain logic in `src/lib/project.ts` — tested directly
- Storage adapters in `src/lib/storageAdapters.ts` — tested with `makeMemoryStorage()` (in-memory fake)
- Export plan builder in `src/lib/exportPlan.ts` — tested directly

## Fixtures and Factories

**Location:** `src/test/builders.ts`

**`makeProject(overrides?)`** — creates a fully calculated `Project` with realistic defaults:
```typescript
export function makeProject(overrides: Partial<Project> = {}): Project {
  const base = createDraftProject();
  return recalculateProject({ ...base, id: "project-1", name: "Alpha projekt", ... overrides });
}
```

**`makeMemoryStorage(initialValue?)`** — returns an in-memory key/value store compatible with the `StorageAdapter` interface, used to test the `LocalProjectStorageAdapter` without touching `localStorage`.

## Test Types

**Unit Tests:**
- `src/lib/project.test.ts` — tests `createDraftProject`, `recalculateProject`, `createFollowUpFromChecklist` in isolation
- `src/lib/storage.test.ts` — tests `ProjectRepository` methods end-to-end with an in-memory adapter
- `src/lib/exportPlan.test.ts` — tests section structure of export plan for each export preset

**Integration / Component Tests:**
- `src/App.test.tsx` — renders the full `App` component, drives user workflows (create project, navigate to list, export, archive/unarchive) with mocked storage and export modules
- `src/features/projects/ProjectTable.test.tsx` — renders `ProjectTable` with mock callbacks, exercises search, filter, selection, action buttons
- `src/features/project-detail/ProjectDetailView.test.tsx` — exercises the detail view component

**E2E Tests:** Not present. No Playwright, Cypress, or Tauri-level E2E setup detected.

## Coverage

**Requirements:** None enforced. No `coverage` script in `package.json`. No `c8`/`v8` reporter configured.

**Observed coverage areas:**
- Core domain logic (`src/lib/`) — well covered
- Root App workflows — covered via integration tests
- Main feature components (`ProjectTable`, `ProjectDetailView`) — covered
- Export logic (`exportPlan`) — covered via unit tests
- Actual PDF/Excel renderers (`src/lib/export.ts`) — not unit-tested (mocked at the boundary)
- Storage adapters beyond `LocalProjectStorageAdapter` — not directly tested
- UI primitives in `src/ui/common.tsx` — not directly tested

## Common Patterns

**Async component testing:**
```typescript
await renderAppWithProjects();
await user.click(screen.getByRole("button", { name: "Meglévő projektek" }));
expect(await screen.findByText("Alpha projekt")).toBeInTheDocument();
```

**Error/empty state testing:**
```typescript
await screen.findByText("Nincs megjeleníthető projekt.");
```

**Callback assertion:**
```typescript
expect(props.onFilterChange).toHaveBeenCalledWith("needsClarification" satisfies ProjectListFilter);
```

**Lazy import in test to allow `vi.mock` hoisting:**
```typescript
async function renderAppWithProjects() {
  const { App } = await import("./App");
  render(<App />);
  ...
}
```

---

*Testing analysis: 2026-07-08*
