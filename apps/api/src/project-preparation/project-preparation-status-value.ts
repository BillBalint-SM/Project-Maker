import type {
  ProjectPreparationAction,
  ProjectPreparationState,
  ProjectPreparationStatus,
} from '@project-maker/contracts';

const interviewAction: ProjectPreparationAction = {
  label: 'Felmérés megnyitása',
  target: 'INTERVIEW',
};
const readinessAction: ProjectPreparationAction = {
  label: 'Becslési felkészültség megnyitása',
  target: 'READINESS',
};
const decisionReviewAction: ProjectPreparationAction = {
  label: 'Döntési értékelés megnyitása',
  target: 'DECISION_REVIEW',
};

export function toProjectPreparationStatus(
  projectId: string,
  state: ProjectPreparationState,
): ProjectPreparationStatus {
  switch (state) {
    case 'SCHEMA_REQUIRED':
      return status(projectId, state, 'Kérdésséma szükséges', interviewAction);
    case 'INTAKE_IN_PROGRESS':
      return status(projectId, state, 'Felmérés folyamatban', interviewAction);
    case 'CLARIFICATION_REQUIRED':
      return status(projectId, state, 'Tisztázás szükséges', readinessAction);
    case 'DECISION_REVIEW_REQUIRED':
      return status(projectId, state, 'Döntési értékelés szükséges', decisionReviewAction);
    case 'ESTIMATE_PREPARABLE':
      return status(projectId, state, 'Becslés előkészíthető', decisionReviewAction);
    case 'ESTIMATE_READY':
      return status(projectId, state, 'Becslésre kész', decisionReviewAction);
  }
}

function status(
  projectId: string,
  state: ProjectPreparationState,
  label: string,
  primaryAction: ProjectPreparationAction,
): ProjectPreparationStatus {
  return { projectId, state, label, primaryAction };
}
