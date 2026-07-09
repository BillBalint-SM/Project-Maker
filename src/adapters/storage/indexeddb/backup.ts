import type { Envelope } from "../../../domain/model/envelope";
import { CURRENT_APP_SCHEMA_VERSION } from "../../../domain/model/envelope";
import { ProjectEnvelopeSchema } from "../../../domain/model/schema";
import type { Project } from "../../../domain/model/types";

/**
 * Pure backup serialization helpers (DATA-06). No RxDB/Zod side effects on
 * the caller's data beyond validation — StorageAdapter.ts is the only
 * caller, supplying its own RxDB-sourced envelopes / writing the validated
 * result back. This file never touches RxDB directly.
 *
 * Domain-purity rule: this module must never import from rxdb/dexie/react.
 */

interface BackupFile {
  schemaVersion: number;
  exportedAt: string;
  projects: Envelope<Project>[];
}

/**
 * Serializes ALL given envelopes (including tombstoned ones — the caller is
 * responsible for passing an unfiltered set) into a single JSON `Blob`.
 * Every envelope is re-validated with `ProjectEnvelopeSchema.parse()` as a
 * defensive safety net before it can ever reach a downloaded file.
 */
export function serializeBackup(envelopes: Envelope<Project>[]): Blob {
  const validated = envelopes.map(
    (envelope) => ProjectEnvelopeSchema.parse(envelope) as Envelope<Project>
  );

  const backup: BackupFile = {
    schemaVersion: CURRENT_APP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    projects: validated
  };

  return new Blob([JSON.stringify(backup)], { type: "application/json" });
}

/**
 * Parses and validates a backup file's text content. Every entry in
 * `projects` is validated with `ProjectEnvelopeSchema.safeParse()` BEFORE
 * this function returns anything — if ANY entry is invalid, it throws
 * (listing every failing index/issue) and returns nothing at all, so the
 * caller never has a chance to start a partial write.
 */
export function parseBackup(text: string): Envelope<Project>[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid backup file: not valid JSON");
  }

  const projects = (parsed as Partial<BackupFile> | null)?.projects;
  if (!Array.isArray(projects)) {
    throw new Error("Invalid backup file: missing projects array");
  }

  const validated: Envelope<Project>[] = [];
  const issues: string[] = [];

  projects.forEach((entry, index) => {
    const result = ProjectEnvelopeSchema.safeParse(entry);
    if (result.success) {
      const envelope = result.data as Envelope<Project>;
      // Same cross-field invariant enforced by RxdbStorageAdapter.put():
      // the envelope's storage key (id) must match the domain payload's own
      // embedded id (data.id). Zod's shape validation alone cannot catch a
      // divergence here, and a restore must not silently import a record
      // whose lookup key and payload id disagree.
      if (envelope.data.id !== envelope.id) {
        issues.push(
          `Invalid backup entry at index ${index}: envelope id (${envelope.id}) does not match data.id (${envelope.data.id})`
        );
      } else {
        validated.push(envelope);
      }
    } else {
      issues.push(`Invalid backup entry at index ${index}: ${result.error.message}`);
    }
  });

  if (issues.length > 0) {
    throw new Error(issues.join("; "));
  }

  return validated;
}
