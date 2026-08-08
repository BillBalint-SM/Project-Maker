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

export interface CreateDiscoveryFollowUpInput {
  readonly category: DiscoveryFollowUpCategory;
  readonly question: string;
  readonly owner: string;
  readonly dueDate: string;
  readonly nextStep: string;
}

export interface DiscoveryFollowUp {
  readonly id: string;
  readonly projectId: string;
  readonly category: DiscoveryFollowUpCategory;
  readonly question: string;
  readonly owner: string;
  readonly dueDate: string;
  readonly status: string;
  readonly nextStep: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
