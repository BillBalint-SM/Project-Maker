import type { RxCollection, RxDatabase } from "rxdb";
import type { Envelope } from "../../../domain/model/envelope";
import { ProjectEnvelopeSchema } from "../../../domain/model/schema";
import type { Project, ProjectListItem } from "../../../domain/model/types";
import type { StoragePort } from "../../../domain/ports/StoragePort";

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
    const docs = await this.collection.find().exec();
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

    const existing = await this.collection.findOne(validated.id).exec();
    const revision = existing
      ? (existing.toJSON() as PersistedProjectEnvelope).revision + 1
      : 1;

    const toWrite: Envelope<Project> = {
      ...validated,
      revision,
      updatedAt: new Date().toISOString(),
      // ALWAYS "local-user", regardless of what the caller passed — there
      // is exactly one local actor in this milestone (D-06 stub).
      updatedBy: "local-user",
      dirty: true
    };

    await this.collection.upsert(toPersisted(toWrite));
  }
}
