import {
  discoveryFollowUpCategories,
  type DiscoveryFollowUpCategory,
} from '@project-maker/contracts';

const statusLabels: Readonly<Record<string, string>> = {
  Nyitott: 'Open',
  Folyamatban: 'In progress',
  Megválaszolva: 'Answered',
  Blokkolt: 'Blocked',
  'Nem releváns': 'Not applicable',
};

const categoryLabels: Readonly<Record<DiscoveryFollowUpCategory, string>> = {
  BUSINESS: 'Business',
  SCOPE: 'Scope',
  TECHNICAL: 'Technical',
  DATA: 'Data',
  INTEGRATION: 'Integration',
  SECURITY: 'Security',
  OPERATIONS: 'Operations',
  OTHER: 'Other',
};

export const discoveryFollowUpCategoryOptions = discoveryFollowUpCategories.map(
  (value) => ({ label: categoryLabels[value], value }),
);

export function discoveryFollowUpCategoryLabel(
  category: DiscoveryFollowUpCategory,
): string {
  return categoryLabels[category];
}

export function discoveryFollowUpStatusLabel(status: string): string {
  return statusLabels[status] ?? status;
}
