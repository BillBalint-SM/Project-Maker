import { CURRENT_APP_SCHEMA_VERSION } from "../../domain/model/envelope";
import type { Envelope } from "../../domain/model/envelope";
import { ProjectSchema } from "../../domain/model/schema";
import type { Project } from "../../domain/model/types";
import type { StoragePort } from "../../domain/ports/StoragePort";

/**
 * The legacy Tauri-MVP row shape (`ProjectRow` in
 * src/lib/storageAdapters.ts). Declared independently here because the
 * legacy file does not export that type.
 */
export type LegacyProjectRow = {
  id: string;
  data: string;
};

export type LegacyImportResult = {
  imported: number;
  skippedExisting: number;
  skippedInvalid: Array<{ id: string; issues: string[] }>;
};

/**
 * Parses, Zod-validates, and idempotently imports a legacy Tauri-MVP export
 * (array of `{id, data}` JSON-blob rows) into the web StoragePort (MIG-01).
 *
 * - Each row is processed independently — one row's failure (bad JSON or
 *   failed Zod validation) never aborts the rest of the batch (T-01-05-01).
 * - Idempotent: a row whose `id` already exists in storage is counted as
 *   `skippedExisting` and is NEVER overwritten.
 * - Never tombstones anything — the soft-delete StoragePort method is never
 *   invoked here; the envelope's `deletedAt` is always `null` on import. The
 *   legacy
 *   `data.archivedAt` field is a domain-payload concept and is preserved
 *   unchanged as part of the (Zod-validated) `data` — it must never be
 *   conflated with the envelope-level sync tombstone.
 */
export async function importLegacyExport(
  rows: LegacyProjectRow[],
  storage: Pick<StoragePort, "get" | "put">
): Promise<LegacyImportResult> {
  const result: LegacyImportResult = {
    imported: 0,
    skippedExisting: 0,
    skippedInvalid: []
  };

  for (const row of rows) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.data);
    } catch (error) {
      result.skippedInvalid.push({
        id: row.id,
        issues: [`JSON parse error: ${error instanceof Error ? error.message : String(error)}`]
      });
      continue;
    }

    // Backfill playbookId BEFORE validation: the legacy Tauri-MVP export
    // format predates this concept entirely, so `parsed` never carries it.
    // This is the SAME "general" default applied by the RxDB
    // migrationStrategies[1] step in db.ts's createProjectDatabase() — that
    // fixes ALREADY-PERSISTED RxDB documents, this fixes legacy JSON-blob
    // rows that never went through RxDB at all. Both entry points need
    // their own fix: patching only one would leave the other producing
    // Zod validation failures against the now-required `playbookId` field.
    const withPlaybookId =
      typeof parsed === "object" && parsed !== null && !("playbookId" in parsed)
        ? { ...parsed, playbookId: "general" }
        : parsed;

    const validation = ProjectSchema.safeParse(withPlaybookId);
    if (!validation.success) {
      result.skippedInvalid.push({
        id: row.id,
        issues: validation.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`
        )
      });
      continue;
    }

    const existing = await storage.get(row.id);
    if (existing !== null) {
      result.skippedExisting += 1;
      continue;
    }

    const envelope: Envelope<Project> = {
      // The legacy ID is preserved verbatim — the current codebase's
      // makeId() already uses crypto.randomUUID(), so the legacy ID already
      // satisfies DATA-01's stable-UUID requirement. No new ID is generated.
      id: row.id,
      schemaVersion: CURRENT_APP_SCHEMA_VERSION,
      data: validation.data,
      revision: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: "local-user",
      // Envelope-level tombstone is ALWAYS null on import — see doc comment
      // above re: not conflating this with data.archivedAt.
      deletedAt: null,
      // NOTE: storage.put() (RxdbStorageAdapter) unconditionally overrides
      // this to `true` on write, regardless of what is passed here — there
      // is currently no "already synced" write path. `true` is used here so
      // this literal doesn't claim a guarantee ("freshly-imported data is
      // dirty: false") the code cannot actually deliver.
      dirty: true
    };

    await storage.put(envelope);
    result.imported += 1;
  }

  return result;
}
