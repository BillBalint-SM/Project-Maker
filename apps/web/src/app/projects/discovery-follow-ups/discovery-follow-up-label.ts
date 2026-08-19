import {
  discoveryFollowUpCategories,
  type DiscoveryFollowUpCategory,
} from '@project-maker/contracts';

const categoryLabels: Readonly<Record<DiscoveryFollowUpCategory, string>> = {
  BUSINESS: 'Üzleti',
  SCOPE: 'Terjedelem',
  TECHNICAL: 'Technikai',
  DATA: 'Adatok',
  INTEGRATION: 'Integráció',
  SECURITY: 'Biztonság',
  OPERATIONS: 'Üzemeltetés',
  OTHER: 'Egyéb',
};

export const discoveryFollowUpCategoryOptions = discoveryFollowUpCategories.map(
  (value) => ({ label: categoryLabels[value], value }),
);

export function discoveryFollowUpCategoryLabel(
  category: DiscoveryFollowUpCategory,
): string {
  return categoryLabels[category];
}
