export interface ProjectContact {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly note: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SaveProjectContactInput {
  readonly name: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly note?: string | null;
}

export const evidenceSourceKinds = [
  'ROUND_ANSWER',
  'CUSTOMER_MESSAGE_EXCERPT',
  'METRIC',
  'HTTPS_LINK',
  'ATTACHMENT',
  'CUSTOMER_RESPONSE',
] as const;

export type EvidenceSourceKind = (typeof evidenceSourceKinds)[number];

export interface EvidenceSourceInput {
  readonly kind: EvidenceSourceKind;
  readonly title?: string;
  readonly roundId?: string;
  readonly snapshotId?: string;
  readonly correspondenceId?: string;
  readonly excerpt?: string;
  readonly metricName?: string;
  readonly metricValue?: string;
  readonly metricUnit?: string;
  readonly url?: string;
  readonly attachmentId?: string;
  readonly responseAnswerId?: string;
}

export interface Evidence {
  readonly id: string;
  readonly projectId: string;
  readonly kind: EvidenceSourceKind;
  readonly title: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface Insight {
  readonly id: string;
  readonly projectId: string;
  readonly statement: string;
  readonly version: number;
  readonly evidence: readonly Evidence[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateInsightInput {
  readonly statement: string;
  readonly evidenceIds?: readonly string[];
  readonly sources?: readonly EvidenceSourceInput[];
}

export interface UpdateInsightInput {
  readonly expectedVersion: number;
  readonly statement: string;
  readonly evidenceIds: readonly string[];
}

export const governedAttachmentOwnerKinds = [
  'ROUND_SNAPSHOT',
  'DISCOVERY_FOLLOW_UP',
] as const;

export type GovernedAttachmentOwnerKind = (typeof governedAttachmentOwnerKinds)[number];

export interface GovernedAttachment {
  readonly id: string;
  readonly projectId: string;
  readonly ownerKind: GovernedAttachmentOwnerKind;
  readonly ownerId: string;
  readonly originalName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly createdAt: string;
}
