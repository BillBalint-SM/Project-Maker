import type {
  ProjectPreparationAction,
  ProjectPreparationState,
  ProjectPreparationStatus,
} from '@project-maker/contracts';

const interviewAction: ProjectPreparationAction = {
  label: 'Open Initial Intake',
  target: 'INTERVIEW',
};
const readinessAction: ProjectPreparationAction = {
  label: 'Open Estimation Readiness',
  target: 'READINESS',
};
const decisionReviewAction: ProjectPreparationAction = {
  label: 'Open Decision Review',
  target: 'DECISION_REVIEW',
};

export function toProjectPreparationStatus(
  projectId: string,
  state: ProjectPreparationState,
): ProjectPreparationStatus {
  switch (state) {
    case 'SCHEMA_REQUIRED':
      return status(projectId, state, 'Question schema required', interviewAction);
    case 'INTAKE_IN_PROGRESS':
      return status(projectId, state, 'Initial Intake in progress', interviewAction);
    case 'CLARIFICATION_REQUIRED':
      return status(projectId, state, 'Clarification required', readinessAction);
    case 'DECISION_REVIEW_REQUIRED':
      return status(projectId, state, 'Decision Review required', decisionReviewAction);
    case 'ESTIMATE_PREPARABLE':
      return status(projectId, state, 'Ready for estimation preparation', decisionReviewAction);
    case 'ESTIMATE_READY':
      return status(projectId, state, 'Ready for estimation', decisionReviewAction);
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
