import type { Envelope } from "../../../domain/model/envelope";
import type { Project, ProjectListItem } from "../../../domain/model/types";
import type { StoragePort } from "../../../domain/ports/StoragePort";
import { parseBackup, serializeBackup } from "../indexeddb/backup";

/**
 * Fast, RxDB-free StoragePort test double. Used ONLY by this plan's own
 * unit tests (legacyImport.test.ts) — the real perzisztencia-stacket a
 * legacyImport.integration.test.ts a valós RxdbStorageAdapter ellen
 * gyakorolja (createStorageAdapter() a src/app/container.ts-ből).
 *
 * Implements the FULL current StoragePort surface
 * (list/get/put/softDelete/exportBackup/importBackup) — every method added
 * to StoragePort since 01-01 must be implemented here too, even though this
 * plan's own tests never call some of them. `exportBackup`/`importBackup`
 * reuse the same pure `backup.ts` helpers the real RxdbStorageAdapter uses,
 * so both implementations share one validation/serialization path.
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
    // Mirrors RxdbStorageAdapter.put()'s cross-field invariant check: the
    // envelope's storage key (id) must match the domain payload's own
    // embedded id (data.id), since list()/toProjectListItem() below source
    // ProjectListItem.id from data.id while get()/put()/softDelete() key off
    // the envelope's id.
    if (record.data.id !== record.id) {
      throw new Error(`Envelope id (${record.id}) does not match data.id (${record.data.id})`);
    }

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

  async exportBackup(): Promise<Blob> {
    return serializeBackup(Array.from(this.store.values()).map((envelope) => ({ ...envelope })));
  }

  async importBackup(blob: Blob): Promise<void> {
    const text = await blob.text();
    const envelopes = parseBackup(text);

    for (const envelope of envelopes) {
      this.store.set(envelope.id, { ...envelope });
    }
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
