import { DefaultUrlSerializer, PRIMARY_OUTLET } from '@angular/router';
import type { ParamMap } from '@angular/router';
import { activeProjectUrgencies } from '@project-maker/contracts/active-project-queue';
import { projectPreparationStates } from '@project-maker/contracts/project-preparation-status';

const serializer = new DefaultUrlSerializer();
const maximumReturnTargetLength = 8_192;
const queueQueryKeys = new Set(['q', 'urgency', 'preparation', 'cursor']);
const urgencyValues = new Set<string>(activeProjectUrgencies);
const preparationValues = new Set<string>(projectPreparationStates);

export function validatedProjectReturnTarget(candidate: string | null): string {
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

    const path = segments.map((segment) => segment.path).join('/');
    if (path === '') {
      return '/';
    }
    if (path !== 'projects/active' || !hasValidQueueQuery(tree.queryParamMap)) {
      return '/';
    }

    return serializer.serialize(tree);
  } catch {
    return '/';
  }
}

function hasValidQueueQuery(params: ParamMap): boolean {
  if (params.keys.some((key) => !queueQueryKeys.has(key))) {
    return false;
  }
  if (params.getAll('q').length > 1 || params.getAll('cursor').length > 1) {
    return false;
  }
  return (
    params.getAll('urgency').every((value) => urgencyValues.has(value)) &&
    params.getAll('preparation').every((value) => preparationValues.has(value))
  );
}
