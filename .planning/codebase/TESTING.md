# Testing Patterns

**Analysis Date:** 2026-07-08

## Test Framework

**Runner:**
- Vitest 4.1.9
- Config: `vite.config.ts` (`test` block — shared with Vite dev config, not a separate `vitest.config.ts`)
  - `environment: "jsdom"`
  - `setupFiles: "src/test/setup.ts"`

**Assertion Library:**
- Vitest built-in `expect`, extended with `@testing-library/jest-dom/vitest` matchers (`toBeInTheDocument`, etc.) via `src/test/setup.ts`

**Component Testing:**
- `@testing-library/react` 16.3.2 for rendering and querying
- `@testing-library/user-event` 14.6.1 for simulating user interaction (`userEvent.setup()`)

**Run Commands:**
```bash
npm run test          # vitest run (single pass, CI mode)
npm run test:watch    # vitest (watch mode)
npm run checkpoint    # typecheck + test + build — full verification gate
npm run verify        # alias for checkpoint
```

There is no separate coverage command configured; no coverage thresholds are enforced.

## Test File Organization

**Location:** Co-located with the source file under test, same directory.

**Naming:** `<SourceName>.test.ts` for pure logic, `<ComponentName>.test.tsx` for React components.

**Examples:**
- `src/App.test.tsx` — top-level app smoke tests
- `src/features/project-detail/ProjectDetailView.test.tsx`
- `src/features/projects/ProjectTable.test.tsx`
- `src/lib/exportPlan.test.ts`
- `src/lib/project.test.ts`
- `src/lib/storage.test.ts`

**Shared test infrastructure:**
- `src/test/setup.ts` — global Vitest setup: imports jest-dom matchers, runs `cleanup()` after each test, stubs `HTMLElement.prototype.scrollIntoView` (required because jsdom does not implement it and components call it, e.g. auto-scroll-into-view on tab change)
- `src/test/builders.ts` — shared test-data builders/factories, imported by every test file that needs a `Project` fixture or an in-memory storage backend

## Test Structure

**Suite organization** — `describe` block per module/component, `it` blocks with full-sentence behavior descriptions:

```typescript
describe("project domain", () => {
  it("creates a draft project with default checklist answers and calculated completion", () => {
    const project = createDraftProject();
    expect(project.name).toMatch(/^Névtelen projekt - /);
    expect(Object.keys(project.checklistAnswers)).toHaveLength(checklistTemplate.length);
  });
});
```

**Patterns:**
- Arrange-Act-Assert within each `it`, no shared `beforeEach` for pure-logic tests (each test builds its own fixture via `makeProject`)
- For stateful/mocked suites (`App.test.tsx`), `beforeEach` resets mocks and sets default resolved values (`vi.clearAllMocks()` + re-mock every method used in the test suite)
- Multiple assertions per test are acceptable when they verify one logical outcome (e.g. checking several fields of `project.completion` after one `recalculateProject` call)

## Mocking

**Framework:** Vitest's built-in `vi` (`vi.fn()`, `vi.mock()`, `vi.hoisted()`, `vi.clearAllMocks()`)

**Patterns:**

Module-level mock objects, declared with `vi.hoisted()` so they're available inside `vi.mock()` factories:

```typescript
const repositoryMock = vi.hoisted(() => ({
  init: vi.fn(),
  listProjects: vi.fn(),
  getProject: vi.fn(),
  saveProject: vi.fn(),
  archiveProject: vi.fn(),
  reopenProject: vi.fn(),
  deleteProject: vi.fn(),
  mode: "localStorage"
}));

vi.mock("./lib/storage", () => ({
  projectRepository: repositoryMock
}));
```

Dependency injection instead of mocking for lower-level modules — `ProjectRepository` accepts an adapter factory in its constructor, so storage tests use a real `LocalProjectStorageAdapter` backed by an in-memory fake `localStorage` (`makeMemoryStorage()`), not a mock:

```typescript
const storage = makeMemoryStorage();
const adapter = new LocalProjectStorageAdapter(storage);
const repository = new ProjectRepository(async () => adapter);
```

**What to Mock:**
- External IO boundaries at the top level: `./lib/storage` (repository) and `./lib/export` when testing `App.tsx`, since they touch persistence/file system/Tauri IPC
- Anything crossing the Tauri IPC boundary

**What NOT to Mock:**
- Pure domain logic (`src/lib/project.ts`, `src/lib/exportPlan.ts`) — test these directly with real inputs/outputs, no mocking needed
- Lower-level storage adapters — prefer a fake in-memory implementation (`makeMemoryStorage`) over mocking `ProjectRepository`'s internals, so the real adapter logic (including error handling for corrupted data) is exercised

## Fixtures and Factories

**Test data factory** (`src/test/builders.ts`):

```typescript
export function makeProject(overrides: Partial<Project> = {}): Project {
  const base = createDraftProject();
  return recalculateProject({
    ...base,
    id: "project-1",
    name: "Alpha projekt",
    // ...fixed baseline fields...
    ...overrides,
    decisionScores: { ...base.decisionScores, ...(overrides.decisionScores ?? {}) },
    checklistAnswers: { ...base.checklistAnswers, ...(overrides.checklistAnswers ?? {}) },
    followUps: overrides.followUps ?? base.followUps
  });
}
```

- Builds on the real `createDraftProject()` factory rather than hand-writing a full `Project` literal, so fixtures stay in sync with domain defaults
- Accepts `Partial<Project>` overrides, with nested objects (`decisionScores`, `checklistAnswers`) merged rather than replaced
- Always passes through `recalculateProject` so derived `completion` fields are consistent with the rest of the fixture

**Fake storage factory:**

```typescript
export function makeMemoryStorage(initialValue = "") {
  const store = new Map<string, string>();
  if (initialValue) store.set("project-maker.projects.v1", initialValue);
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    dump: () => Object.fromEntries(store)
  };
}
```

**Location:** `src/test/builders.ts` — import from any test file with `import { makeProject, makeMemoryStorage } from "../test/builders"` (path depth varies by test file location).

## Coverage

**Requirements:** None enforced; no coverage tool configured in `vite.config.ts` or `package.json`.

**View Coverage:** Not applicable — would require adding `@vitest/coverage-v8` (or similar) and a `test.coverage` block before this becomes available.

## Test Types

**Unit Tests:**
- Pure domain logic in `src/lib/*.test.ts` — direct function calls, no rendering, no mocking (`project.test.ts`, `exportPlan.test.ts`)

**Integration/Storage Tests:**
- `src/lib/storage.test.ts` — exercises `ProjectRepository` against a real `LocalProjectStorageAdapter` with fake in-memory storage, covering the full save/list/archive/reopen/delete lifecycle and corrupted-data recovery

**Component Tests:**
- `src/features/projects/ProjectTable.test.tsx`, `src/features/project-detail/ProjectDetailView.test.tsx` — render with `@testing-library/react`, interact via `userEvent`, assert on rendered DOM via `screen`

**App-level Smoke Tests:**
- `src/App.test.tsx` — renders the full `App` with mocked `storage`/`export` modules, drives multi-step flows via `userEvent` (create project → edit → save; list → archive; export), asserts via `waitFor` + `screen` queries. This is the closest thing to an E2E test in this codebase; there is no separate E2E framework (no Playwright/Cypress detected).

**E2E Tests:** Not used — no browser-automation E2E framework configured.

## Common Patterns

**Async Testing:**

```typescript
async function renderAppWithProjects() {
  const { App } = await import("./App");
  render(<App />);
  await waitFor(() => expect(repositoryMock.init).toHaveBeenCalled());
}
```

- Dynamic `import()` inside the render helper ensures mocks registered via `vi.mock()` are applied before the module under test is loaded
- `waitFor` is used to await async state settling after mount (repository init, list refresh) rather than arbitrary timeouts

**Error/Resilience Testing:**

```typescript
it("ignores broken localStorage payloads instead of crashing", async () => {
  const storage = makeMemoryStorage("not-json");
  const adapter = new LocalProjectStorageAdapter(storage);
  await expect(adapter.listProjects(false)).resolves.toEqual([]);
});
```

- Use `expect(promise).resolves.toEqual(...)` for async functions that should fail soft rather than reject.

**Regex assertions for generated/templated values:**

```typescript
expect(project.name).toMatch(/^Névtelen projekt - /);
```

Used for fields with a fixed prefix plus a dynamic suffix (timestamp/counter), avoiding brittle exact-string matches.

---

*Testing analysis: 2026-07-08*
