export const discoveryFollowUpCategories = [
  'BUSINESS',
  'SCOPE',
  'TECHNICAL',
  'DATA',
  'INTEGRATION',
  'SECURITY',
  'OPERATIONS',
  'OTHER',
] as const;

export type DiscoveryFollowUpCategory =
  (typeof discoveryFollowUpCategories)[number];

export interface DiscoveryFollowUpSourceOption {
  readonly snapshotId: string;
  readonly order: number;
  readonly topic: string;
  readonly controlPoint: string;
  readonly text: string;
}

export interface DiscoveryFollowUpSourceReference {
  readonly snapshotId: string;
  readonly order: number;
  readonly topic: string;
  readonly controlPoint: string;
}

export interface CreateDiscoveryFollowUpInput {
  readonly category: DiscoveryFollowUpCategory;
  readonly question: string;
  readonly owner: string;
  readonly dueDate: string;
  readonly nextStep: string;
  readonly sourceSnapshotId?: string;
}

export interface ResolveDiscoveryFollowUpInput {
  readonly status: string;
  readonly decisionOrAnswer: string;
}

export interface UpdateDiscoveryFollowUpInput {
  readonly category: DiscoveryFollowUpCategory;
  readonly question: string;
  readonly owner: string;
  readonly dueDate: string;
  readonly nextStep: string;
  readonly expectedVersion: number;
}

export interface SetDiscoveryFollowUpSourceLinkInput {
  readonly sourceSnapshotId: string | null;
  readonly expectedVersion: number;
}

export interface DiscoveryFollowUp {
  readonly id: string;
  readonly projectId: string;
  readonly category: DiscoveryFollowUpCategory;
  readonly question: string;
  readonly owner: string;
  readonly dueDate: string;
  readonly status: string;
  readonly decisionOrAnswer: string | null;
  readonly nextStep: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
  readonly source: DiscoveryFollowUpSourceReference | null;
}
