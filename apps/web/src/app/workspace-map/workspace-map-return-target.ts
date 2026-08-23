import { DefaultUrlSerializer, PRIMARY_OUTLET } from '@angular/router';

import { validatedProjectReturnTarget } from '../projects/project-context/project-return-target';

const serializer = new DefaultUrlSerializer();
const maximumReturnTargetLength = 8_192;
const projectPages = new Set([
  'status',
  'interview',
  'discovery',
  'readiness',
  'decision-review',
  'markdown',
  'delivery',
  'customer-correspondences',
  'settings',
]);

export function validatedWorkspaceMapReturnTarget(candidate: string | null): string {
  if (
    !candidate ||
    candidate.length > maximumReturnTargetLength ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\')
  ) {
    return '/';
  }

  try {
    const tree = serializer.parse(candidate);
    const primary = tree.root.children[PRIMARY_OUTLET];
    const segments = primary?.segments ?? [];
    const hasNestedOrNamedOutlet =
      Object.keys(tree.root.children).some((outlet) => outlet !== PRIMARY_OUTLET) ||
      Boolean(primary && Object.keys(primary.children).length > 0);
    const hasMatrixParameters = segments.some(
      (segment) => Object.keys(segment.parameters).length > 0,
    );
    if (tree.fragment !== null || hasNestedOrNamedOutlet || hasMatrixParameters) {
      return '/';
    }

    if (
      segments.length !== 3 ||
      segments[0]?.path !== 'projects' ||
      !segments[1]?.path ||
      !projectPages.has(segments[2]?.path ?? '')
    ) {
      return '/';
    }

    if (tree.queryParamMap.keys.some((key) => key !== 'returnTo')) {
      return '/';
    }
    const nestedReturnTargets = tree.queryParamMap.getAll('returnTo');
    if (
      nestedReturnTargets.length > 1 ||
      (nestedReturnTargets.length === 1 &&
        validatedProjectReturnTarget(nestedReturnTargets[0]) !== nestedReturnTargets[0])
    ) {
      return '/';
    }

    return serializer.serialize(tree);
  } catch {
    return '/';
  }
}
