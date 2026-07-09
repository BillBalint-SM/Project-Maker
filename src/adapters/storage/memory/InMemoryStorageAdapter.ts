import type { Envelope } from "../../../domain/model/envelope";
import type { Project, ProjectListItem } from "../../../domain/model/types";
import type { StoragePort } from "../../../domain/ports/StoragePort";

/**
 * Fast, RxDB-free StoragePort test double. Used ONLY by this plan's own
 * unit tests (legacyImport.test.ts) — the real perzisztencia-stacket a
 * legacyImport.integration.test.ts a valós RxdbStorageAdapter ellen
 * gyakorolja (createStorageAdapter() a src/app/container.ts-ből).
 *
 * Implements the FULL current StoragePort surface (list/get/put/softDelete)
 * — softDelete already exists on StoragePort as of 01-02, so a test double
 * declaring `implements StoragePort` must implement it too, even though this
 * plan's own tests never call it.
 */
export class InMemoryStorageAdapter implements StoragePort {
  private readonly store = new Map<string, Envelope<Project>>();

  async list(): Promise<ProjectListItem[]> {
    return Array.from(this.store.values())
      .filter((envelope) => envelope.deletedAt === null)
      .map((envelope) => toProjectListItem(envelope.data));
  }

  async get(id: string): Promise<Envelope<Project> | null> {
    const found = this.store.get(id);
    return found ? { ...found } : null;
  }

  async put(record: Envelope<Project>): Promise<void> {
    this.store.set(record.id, { ...record });
  }

  async softDelete(id: string): Promise<void> {
    const existing = this.store.get(id);
    if (!existing) {
      throw new Error(`Project not found: ${id}`);
    }

    this.store.set(id, {
      ...existing,
      deletedAt: new Date().toISOString(),
      revision: existing.revision + 1,
      updatedAt: new Date().toISOString(),
      dirty: true
    });
  }
}

function toProjectListItem(data: Project): ProjectListItem {
  return {
    id: data.id,
    name: data.name,
    // Placeholder — same non-goal as RxdbStorageAdapter's toProjectListItem
    // (contact-concatenation is Phase 2 territory); this test double never
    // renders a list UI.
    contact: "",
    status: data.status,
    priority: data.priority,
    deadline: data.deadline,
    completionState: data.completion.state,
    completionPercent: data.completion.percent,
    readinessPercent: data.completion.readinessPercent,
    decisionScore: data.completion.decisionScore,
    decisionRecommendation: data.completion.decisionRecommendation,
    archivedAt: data.archivedAt,
    updatedAt: data.updatedAt
  };
}
