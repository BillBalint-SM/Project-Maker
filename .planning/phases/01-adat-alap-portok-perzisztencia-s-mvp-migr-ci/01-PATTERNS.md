# Phase 1: Adat-alap, portok, perzisztencia és MVP-migráció - Pattern Map

**Mapped:** 2026-07-09
**Files analyzed:** 17 (new files for the re-platformed web/PWA stack)
**Analogs found:** 6 exact/conceptual analog / 17 (remainder is genuinely new architecture — no 1:1 equivalent in the current Tauri/React codebase, per CONTEXT.md D-notes)

**Context note:** This phase is a re-platforming (Tauri/Rust/SQLite desktop → web/PWA, RxDB/Dexie). There is therefore no literal code to "copy" for most new files — the current codebase's value is as a **conceptual pattern source** (interface shape, layering discipline, derived-state philosophy), explicitly called out in `01-CONTEXT.md` (`code_context` section). Concrete new-file code should instead follow `.planning/research/ARCHITECTURE.md` (Patterns 1–4) and `.planning/research/STACK.md` (RxDB/Zod code snippets), which are HIGH confidence and already contain ready-to-adapt TypeScript signatures.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/domain/model/envelope.ts` (Envelope<T> type) | model | transform | *(none — new concept)* `src/data/types.ts` (Project type shapes, field-naming convention only) | partial (naming/style only) |
| `src/domain/model/types.ts` (domain Project/entity types) | model | CRUD | `src/data/types.ts` | role-match (same responsibility, new stack) |
| `src/domain/ports/StoragePort.ts` | service (port/interface) | CRUD | `src/lib/storageTypes.ts` (`ProjectStorageAdapter`) | **exact conceptual analog** |
| `src/domain/ports/ContentPort.ts` | service (port/interface) | request-response | *(none — new)* | no analog |
| `src/domain/ports/ExportPort.ts` | service (port/interface) | transform | `src/lib/export.ts` (export builder functions, informs shape) | role-match |
| `src/domain/ports/LlmPort.ts` | service (port/interface) | request-response | *(none — new)* | no analog |
| `src/domain/ports/SyncPort.ts` | service (port/interface) | event-driven | *(none — new)* | no analog |
| `src/adapters/storage/indexeddb/db.ts` (RxDB/Dexie setup + schema versions) | config/service | CRUD | `src-tauri/src/lib.rs` (`open_database`, `CREATE TABLE IF NOT EXISTS` — schema-init concept only) | partial (schema-init concept only, different stack) |
| `src/adapters/storage/indexeddb/StorageAdapter.ts` (RxDB-backed StoragePort impl) | service (adapter) | CRUD | `src/lib/storageAdapters.ts` (`TauriSqliteProjectStorageAdapter`, `LocalProjectStorageAdapter`) | **exact conceptual analog** |
| `src/adapters/storage/memory/InMemoryStorageAdapter.ts` (test adapter) | service (adapter) | CRUD | `src/lib/storageAdapters.ts` (`LocalProjectStorageAdapter`) | role-match |
| `src/adapters/storage/indexeddb/backup.ts` (exportBackup/importBackup) | utility | file-I/O | *(none — new; MVP has no backup)* — nearest concept: `src-tauri/src/lib.rs` `save_export_file` (file-write IPC pattern) | partial |
| `src/adapters/sync/noop.ts` (`NoopSyncAdapter`) | service (adapter) | event-driven | *(none — new)* | no analog |
| `src/lib/project.ts` → `src/domain/scoring/*` (recalculate/normalize logic) | service (domain logic) | transform | `src/lib/project.ts` (`recalculateProject`, `normalizeProject`) | **exact analog — direct porting source** |
| `src/domain/model/schema.ts` (Zod schemas for Project/Envelope) | utility (validation) | transform | *(none — MVP has zero validation; CONCERNS.md HIGH: `as Project` cast)* | no analog — replaces an anti-pattern |
| `src/app/container.ts` (composition root / DI wiring) | config | request-response | `src/lib/storageAdapters.ts` (`createProjectStorageAdapter()` factory function) | role-match (factory → DI upgrade) |
| `src/adapters/migration/legacyImport.ts` (MIG-01: parse+validate old SQLite `data` blob) | service (transform) | batch/file-I/O | `src/lib/storageAdapters.ts` (`parseProjectPayload`, `toProjectRecord` — blob (de)serialization shape) | role-match |
| `src/features/projects/ProjectListView.tsx` (Walking Skeleton proof-of-life UI) | component | CRUD (read) | `src/features/projects/ProjectTable.tsx` (list rendering, filter/status display conventions) | role-match |

## Pattern Assignments

### `src/domain/ports/StoragePort.ts` (service/port, CRUD)

**Analog:** `src/lib/storageTypes.ts` (current `ProjectStorageAdapter` interface — the MVP's existing hexagonal seam)

**Full current interface** (`src/lib/storageTypes.ts` lines 1-17):
```typescript
import type { Project } from "../data/types";

export type ProjectStorageInfo = {
  mode: "SQLite" | "localStorage";
  databasePath?: string;
};

export interface ProjectStorageAdapter {
  readonly info: ProjectStorageInfo;
  listProjects(archived: boolean): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  saveProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;
}

export type ProjectStorageAdapterFactory = () => Promise<ProjectStorageAdapter>;
```

**What to keep from this pattern:**
- One cohesive interface per persistence concern, injected via a factory (extend to full DI in `app/container.ts`).
- Method surface shape (`list`, `get`, `save`, `delete`) — extend with `softDelete`, `exportBackup`, `importBackup` per RESEARCH ARCHITECTURE.md Pattern 1.
- `info`/mode metadata field pattern → not needed in new arch (single IndexedDB backend), drop it.

**What must change (per RESEARCH.md, HIGH confidence — do not re-litigate):**
```typescript
// domain/ports/StoragePort.ts — target shape (from ARCHITECTURE.md Pattern 1)
export interface StoragePort {
  list(filter?: ListFilter): Promise<ProjectListItem[]>;
  get(id: string): Promise<Envelope<Project> | null>;
  put(record: Envelope<Project>): Promise<void>;   // upsert; adapter bumps revision
  softDelete(id: string): Promise<void>;            // tombstone, not physical delete
  exportBackup(): Promise<Blob>;
  importBackup(blob: Blob): Promise<void>;
}
```
Note: return type changes from bare `Project` to `Envelope<Project>` — this is the single biggest structural change vs. the MVP's port, and is the entire point of DATA-02.

---

### `src/domain/model/envelope.ts` (model, transform) and `src/domain/model/schema.ts` (Zod validation)

**No direct analog** — the current codebase stores an untyped JSON blob (`CONCERNS.md` MEDIUM: `src/lib/storageAdapters.ts:40-44,52-65` — `JSON.stringify(project)` / `as Project` cast with zero validation). This is the anti-pattern DATA-05/DATA-02 exist to eliminate. Do not port this logic — replace it.

**Current anti-pattern being replaced** (`src/lib/storageAdapters.ts` lines 40-46, 52-65):
```typescript
function parseProjectPayload(data: string): Project | null {
  try {
    return JSON.parse(data) as Project;   // <-- no validation, silently wrong
  } catch {
    return null;
  }
}
...
function toProjectRecord(project: Project): ProjectRecordInput {
  return {
    id: project.id,
    ...
    data: JSON.stringify(project)          // <-- whole object as opaque blob
  };
}
```

**Target pattern** (from `.planning/research/ARCHITECTURE.md` Pattern 2 and `.planning/research/STACK.md`):
```typescript
// domain/model/envelope.ts
export interface Envelope<T> {
  id: string;
  schemaVersion: number;
  data: T;
  revision: number;
  updatedAt: string;
  updatedBy: string;       // "local-user" stub per CONTEXT.md D-06
  deletedAt: string | null;
  dirty: boolean;
}
```
Validation replaces the `as Project` cast with a Zod schema parsed on every read/write boundary (DATA-05). Use `Envelope<Project>` schema composition — a `ProjectSchema` (mirrors `src/data/types.ts` field shapes) nested inside an `EnvelopeSchema<T>`.

---

### `src/lib/project.ts` → `src/domain/scoring/*` (service/domain logic, transform)

**Analog:** `src/lib/project.ts` — **this is a direct porting source, not just inspiration.** CONTEXT.md and RESEARCH.md both single out `recalculateProject()` as the pattern to carry forward almost unchanged (pure function, no IO, always-recomputed derived state).

**Core pattern to port** (`src/lib/project.ts` lines 103-127):
```typescript
export function recalculateProject(project: Project): Project {
  const normalized = normalizeProject(project);

  return {
    ...normalized,
    completion: calculateCompletion(normalized)
  };
}

function normalizeProject(project: Project): Project {
  return {
    ...project,
    affectedTeams: project.affectedTeams ?? [],
    decisionScores: {
      ...defaultDecisionScores,
      ...(project.decisionScores ?? {})
    },
    checklistAnswers: {
      ...createDefaultChecklistAnswers(),
      ...(project.checklistAnswers ?? {})
    },
    followUps: project.followUps ?? [],
    archivedAt: project.archivedAt ?? null
  };
}
```

**Principle to preserve exactly:** "never stored, always recomputed" derived state (`project.completion` is never authoritative — it's recalculated every save). This maps directly onto the domain-core purity rule in ARCHITECTURE.md (`domain/` = pure TS, no IO). When adapting for Phase 1, keep this function pure and untouched by envelope/IO concerns — it operates on the unwrapped `data: T` payload inside the envelope, not on the envelope itself.

**Call-site pattern to replicate** (`src/lib/storage.ts` lines 9-11, 39-41):
```typescript
function reviveProject(raw: Project): Project {
  return recalculateProject(raw);
}
...
async saveProject(project: Project) {
  await this.requireAdapter().saveProject(reviveProject(project));
}
```
New repository-equivalent (a thin RxDB-backed repository or the StoragePort caller) should call the ported `recalculateProject` equivalent before every `put()`, same as this MVP repository does before every `saveProject()`.

---

### `src/adapters/storage/indexeddb/StorageAdapter.ts` (service/adapter, CRUD)

**Analog:** `src/lib/storageAdapters.ts` (`TauriSqliteProjectStorageAdapter`, `LocalProjectStorageAdapter`)

**Structural pattern to keep** (adapter implements the port interface, constructor/factory-created, all IO isolated here):
```typescript
export class LocalProjectStorageAdapter implements ProjectStorageAdapter {
  readonly info: ProjectStorageInfo = { mode: "localStorage" };
  constructor(private readonly storage: KeyValueStorage = localStorage) {}

  async listProjects(archived: boolean): Promise<Project[]> {
    return this.readProjects()
      .filter((project) => (archived ? project.archivedAt : !project.archivedAt))
      .sort(byUpdatedDesc);
  }
  async getProject(id: string): Promise<Project | null> { ... }
  async saveProject(project: Project): Promise<void> { ... }
  async deleteProject(id: string): Promise<void> { ... }
  private readProjects(): Project[] { ... }
  private writeProjects(projects: Project[]) { ... }
}
```
Keep: class implements a port interface; filtering/sorting done in adapter (`byUpdatedDesc`); private read/write helpers encapsulate the actual storage mechanics.
Change: `archived` boolean filter → filter on `deletedAt == null` (soft-delete, DATA-03) instead of on `archivedAt`; storage mechanics become RxDB/Dexie collection calls instead of `localStorage`/SQLite IPC; every read/write now round-trips through Zod validation and the Envelope wrapper.

**Factory pattern to keep** (`src/lib/storageAdapters.ts` lines 150-161 — becomes `app/container.ts` DI wiring):
```typescript
export async function createProjectStorageAdapter(): Promise<ProjectStorageAdapter> {
  if (isTauriRuntime()) {
    try {
      const module = await import("@tauri-apps/api/core");
      return await TauriSqliteProjectStorageAdapter.create(module.invoke);
    } catch (error) {
      console.warn("Natív SQLite nem érhető el, localStorage fallback aktív.", error);
    }
  }
  return new LocalProjectStorageAdapter();
}
```
This runtime-detection-and-fallback shape is exactly what `app/container.ts` should do for `llmEnabled`/`syncEnabled` feature flags (per ARCHITECTURE.md Pattern 5), just without the Tauri detection (single web target now).

---

### `src/adapters/migration/legacyImport.ts` (service/transform, batch)

**Analog:** `src/lib/storageAdapters.ts` blob (de)serialization shape (`parseProjectPayload`, `toProjectRecord`) — describes the exact shape of the data MIG-01 must parse (the legacy SQLite `data` JSON blob column).

**What MIG-01 import must handle** (the shape being read, from `src/lib/storageAdapters.ts` lines 6-9, 16-27, 40-46):
```typescript
type ProjectRow = { id: string; data: string };   // data = JSON.stringify(Project), unvalidated

function parseProjectPayload(data: string): Project | null {
  try {
    return JSON.parse(data) as Project;
  } catch {
    return null;
  }
}
```
The legacy import adapter should replicate this parse step, but replace the unsafe cast with Zod validation (producing typed errors instead of silent `null`), then wrap the result in a fresh `Envelope<Project>` with `schemaVersion: 0` → migrate to current, `updatedBy: "local-user"`, `dirty: false` (imported data is already "synced" with itself). Per CONTEXT.md D-01/D-02: this is format+validation only, no live migration UX; test against a synthetic fixture representing this exact `{id, data}` row shape.

---

### `src/features/projects/ProjectListView.tsx` (component, CRUD-read) — Walking Skeleton

**Analog:** `src/features/projects/ProjectTable.tsx` (not fully read — role-match only, listing/filtering conventions for a project list component)

**Guidance:** Per CONTEXT.md D-03/D-04, this is a deliberately minimal proof-of-life view: read projects from IndexedDB via the new StoragePort/reactive query, render a list. It is explicitly NOT meant to replicate `ProjectTable.tsx`'s full filtering/bulk-selection/export-trigger feature set — those come in Phase 2/5. Only borrow the basic "list container queries repository, maps to list items, renders rows" shape; do not port bulk-selection, archive filter UI, or export trigger.

---

## Shared Patterns

### Domain purity (no IO in domain/)
**Source:** `.planning/research/ARCHITECTURE.md` Anti-Pattern 1 + `src/lib/project.ts` (already pure — the one file in the current codebase that already follows this rule)
**Apply to:** All files under `domain/model`, `domain/scoring`, `domain/ports`. These files must never import Dexie/RxDB/fetch. Only `adapters/*` may perform IO.

### Envelope wrapping at the storage boundary
**Source:** `.planning/research/ARCHITECTURE.md` Pattern 2 (full code in Step above)
**Apply to:** `adapters/storage/indexeddb/StorageAdapter.ts`, `adapters/storage/memory/InMemoryStorageAdapter.ts`, `adapters/migration/legacyImport.ts`, `adapters/storage/indexeddb/backup.ts` — every place that reads/writes a persisted record must wrap/unwrap `Envelope<Project>`, never pass a bare `Project` across the StoragePort boundary.

### Zod validation replaces `as T` casts
**Source:** `.planning/codebase/CONCERNS.md` MEDIUM finding (`src/lib/storageAdapters.ts:40-44`) + `.planning/research/STACK.md` Zod recommendation
**Apply to:** All adapter read paths and the legacy migration import — every deserialization point gets a `schema.parse()`/`safeParse()` call producing typed errors instead of silent casts.

### Soft-delete instead of physical delete
**Source:** `.planning/research/PITFALLS.md` Pitfall 2, contrasted with current `src/App.tsx:183-195` hard-delete (`projectRepository.deleteProject` after `window.confirm`)
**Apply to:** `StoragePort.softDelete()`, the IndexedDB adapter's delete implementation, and all list queries (must filter `deletedAt == null` by default, replacing the current `archived` boolean filter convention seen in `LocalProjectStorageAdapter.listProjects`).

### Factory/composition-root wiring for adapter selection
**Source:** `src/lib/storageAdapters.ts` lines 150-161 (`createProjectStorageAdapter`) — conceptual analog only
**Apply to:** `app/container.ts`, which extends this single-factory pattern into full DI: StoragePort → RxDB adapter, LlmPort → `NoopLlmAdapter` (feature flag), SyncPort → `NoopSyncAdapter`, ContentPort → static catalog loader.

## No Analog Found

Files with no close match in the codebase — planner should rely on `.planning/research/ARCHITECTURE.md` (Patterns 1-6, full TypeScript signatures already provided) and `.planning/research/STACK.md` (RxDB/Zod installation + schema code) as the primary technical source instead:

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/domain/ports/ContentPort.ts` | service/port | request-response | No coaching/content layer exists in the current MVP at all |
| `src/domain/ports/LlmPort.ts` | service/port | request-response | No LLM integration exists in the current MVP |
| `src/domain/ports/SyncPort.ts` | service/port | event-driven | No sync/outbox concept exists in the current MVP |
| `src/adapters/sync/noop.ts` | service/adapter | event-driven | Net-new Null Object adapter, no precedent |
| `src/adapters/storage/indexeddb/backup.ts` | utility | file-I/O | Current MVP has zero backup/restore (CONCERNS.md HIGH: "No Data Backup") |
| `src/adapters/storage/indexeddb/db.ts` (RxDB schema + migrationStrategies) | config | CRUD | Current MVP has zero schema versioning (CONCERNS.md HIGH); RxDB's migration API has no SQLite equivalent in this codebase |

## Metadata

**Analog search scope:** `src/lib/`, `src/data/`, `src/features/`, `src-tauri/src/lib.rs` (entire current frontend + Rust backend surface)
**Files scanned:** `src/lib/storageTypes.ts`, `src/lib/storage.ts`, `src/lib/storageAdapters.ts`, `src/lib/project.ts`, `src/data/types.ts`, `src-tauri/src/lib.rs` (via `.planning/codebase/ARCHITECTURE.md`/`CONCERNS.md` summaries), `src/App.tsx` (via summaries), `src/features/projects/ProjectTable.tsx` (referenced, not fully read — role-match only)
**Pattern extraction date:** 2026-07-09
