import type { Envelope } from "../model/envelope";
import type { Project, ProjectListItem } from "../model/types";

/**
 * Storage port — the hexagon's persistence seam. This plan (01-01) only
 * declares list/get/put. `softDelete` (01-02) and `exportBackup`/
 * `importBackup` (01-03) are added to this interface — and its adapter —
 * by later plans (interface-first, incremental extension). Do NOT declare
 * them here as stubs.
 *
 * Domain-purity rule: this file must never import from rxdb/dexie/react or
 * any adapters/features module.
 */
export interface StoragePort {
  list(): Promise<ProjectListItem[]>;
  get(id: string): Promise<Envelope<Project> | null>;
  put(record: Envelope<Project>): Promise<void>;
}
