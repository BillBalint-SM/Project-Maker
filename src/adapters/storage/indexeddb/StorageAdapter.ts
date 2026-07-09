import type { RxCollection, RxDatabase } from "rxdb";
import type { Envelope } from "../../../domain/model/envelope";
import { ProjectEnvelopeSchema } from "../../../domain/model/schema";
import type { Project, ProjectListItem } from "../../../domain/model/types";
import type { StoragePort } from "../../../domain/ports/StoragePort";
import { parseBackup, serializeBackup } from "./backup";

type PersistedProjectEnvelope = {
  id: string;
  schemaVersion: number;
  data: unknown;
  revision: number;
  updatedAt: string;
  updatedBy: string;
  dirty: boolean;
  deletedAt?: string;
};

/**
 * Maps a plain RxDB document (from `.toJSON()`) into the shape Zod expects
 * before parsing: `deletedAt` is OPTIONAL/absent in the RxDB schema
 * (see db.ts), but the domain `Envelope.deletedAt` field is `nullable()`,
 * never `optional()` — so a missing key must become an explicit `null`
 * before `ProjectEnvelopeSchema.parse()` runs.
 */
function toEnvelopeInput(raw: PersistedProjectEnvelope): unknown {
  return {
    ...raw,
    deletedAt: raw.deletedAt ?? null
  };
}

/**
 * Maps a Zod-validated Envelope<Project> into the object handed to
 * `collection.upsert()`. The RxDB schema's `deletedAt` field is typed
 * `string` (not nullable) — a literal `null` must never be written into
 * RxDB; when the envelope's `deletedAt` is `null`, the key is omitted
 * entirely from the upserted object.
 */
function toPersisted(envelope: Envelope<Project>): PersistedProjectEnvelope {
  const { deletedAt, ...rest } = envelope;
  return deletedAt === null ? rest : { ...rest, deletedAt };
}

function toProjectListItem(data: Project): ProjectListItem {
  return {
    id: data.id,
    name: data.name,
    // Placeholder — contact-concatenation is Phase 2 territory (walking
    // skeleton only needs id/name/status/priority/deadline/completion here).
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

/**
 * RxDB-backed StoragePort implementation. Every read/write round-trips
 * through Zod (`ProjectEnvelopeSchema`) — invalid data throws, it is never
 * written or returned silently (DATA-05).
 */
export class RxdbStorageAdapter implements StoragePort {
  constructor(private readonly db: RxDatabase) {}

  private get collection(): RxCollection {
    return this.db.projects as RxCollection;
  }

  async list(): Promise<ProjectListItem[]> {
    // Tombstoned records (deletedAt present) are hidden from list() —
    // soft-delete, not a physical DELETE (DATA-03). `deletedAt` is declared
    // optional (not `required`) in the RxDB schema (db.ts); its absence is
    // the "not deleted" signal.
    const docs = await this.collection
      .find({ selector: { deletedAt: { $exists: false } } })
      .exec();
    return docs.map((doc) => {
      const envelope = ProjectEnvelopeSchema.parse(
        toEnvelopeInput(doc.toJSON() as PersistedProjectEnvelope)
      );
      return toProjectListItem(envelope.data);
    });
  }

  async get(id: string): Promise<Envelope<Project> | null> {
    const doc = await this.collection.findOne(id).exec();
    if (!doc) return null;

    return ProjectEnvelopeSchema.parse(
      toEnvelopeInput(doc.toJSON() as PersistedProjectEnvelope)
    ) as Envelope<Project>;
  }

  async put(record: Envelope<Project>): Promise<void> {
    // Validate FIRST — invalid data throws here, propagating to the
    // caller. There is no silent partial write (DATA-05).
    const validated = ProjectEnvelopeSchema.parse(record) as Envelope<Project>;

    // Enforce the invariant that the envelope's storage key (id, used by
    // get()/put()/softDelete() as the RxDB primaryKey) and the domain
    // payload's own embedded id (data.id, used by list() to build
    // ProjectListItem.id) never diverge. Nothing in the Zod schema checks
    // this cross-field relationship, so a caller-constructed mismatch would
    // otherwise be silently written and later cause "Project not found" or
    // lookups against the wrong record.
    if (validated.data.id !== validated.id) {
      throw new Error(
        `Envelope id (${validated.id}) does not match data.id (${validated.data.id})`
      );
    }

    const existing = await this.collection.findOne(validated.id).exec();

    if (!existing) {
      // First write for this id — there is no existing revision to race
      // against, so a plain upsert is safe.
      const toWrite: Envelope<Project> = {
        ...validated,
        revision: 1,
        updatedAt: new Date().toISOString(),
        // ALWAYS "local-user", regardless of what the caller passed — there
        // is exactly one local actor in this milestone (D-06 stub).
        updatedBy: "local-user",
        dirty: true
      };

      await this.collection.upsert(toPersisted(toWrite));
      return;
    }

    // Existing doc: bump the revision via incrementalModify() rather than a
    // separate findOne() + upsert(). RxDB queues incrementalModify() calls
    // per-document (collection.incrementalWriteQueue), so the mutation
    // function below always runs against the LATEST written state — this
    // closes the lost-update race where two concurrent put() calls for the
    // same id could both read the same `existing.revision`, both compute the
    // same "next" value, and the second upsert() would silently clobber the
    // first's increment.
    await existing.incrementalModify((current: unknown) => {
      const currentRevision = (current as PersistedProjectEnvelope).revision;
      const toWrite: Envelope<Project> = {
        ...validated,
        revision: currentRevision + 1,
        updatedAt: new Date().toISOString(),
        updatedBy: "local-user",
        dirty: true
      };
      return toPersisted(toWrite);
    });
  }

  async softDelete(id: string): Promise<void> {
    const doc = await this.collection.findOne(id).exec();
    if (!doc) {
      throw new Error(`Project not found: ${id}`);
    }

    const existing = ProjectEnvelopeSchema.parse(
      toEnvelopeInput(doc.toJSON() as PersistedProjectEnvelope)
    ) as Envelope<Project>;

    // Tombstone: deletedAt is ALWAYS a concrete, non-null ISO string here —
    // no null-omission branch needed (that only applies to put(), where the
    // caller may pass deletedAt: null). All other fields (data, id,
    // schemaVersion, updatedBy) stay unchanged.
    const toWrite: Envelope<Project> = {
      ...existing,
      deletedAt: new Date().toISOString(),
      revision: existing.revision + 1,
      updatedAt: new Date().toISOString(),
      dirty: true
    };

    await this.collection.upsert(toPersisted(toWrite));
  }

  async exportBackup(): Promise<Blob> {
    // No selector — unlike list(), a backup MUST include tombstoned records
    // too, or a restore would silently lose deletion state (DATA-06).
    const docs = await this.collection.find().exec();
    const envelopes = docs.map(
      (doc) =>
        ProjectEnvelopeSchema.parse(
          toEnvelopeInput(doc.toJSON() as PersistedProjectEnvelope)
        ) as Envelope<Project>
    );

    return serializeBackup(envelopes);
  }

  async importBackup(blob: Blob): Promise<void> {
    const text = await blob.text();
    // parseBackup() validates EVERY entry before returning anything — if it
    // throws, execution never reaches the write loop below, so there is no
    // partial write (atomic, all-or-nothing).
    const envelopes = parseBackup(text);

    for (const envelope of envelopes) {
      // Raw upsert — deliberately NOT this.put(), which would bump
      // revision/updatedAt and force updatedBy to "local-user". A restore
      // must write back the ORIGINAL exported values unchanged.
      await this.collection.upsert(toPersisted(envelope));
    }
  }
}
