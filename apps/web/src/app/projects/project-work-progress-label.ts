import type { ProjectWorkProgress } from '@project-maker/contracts';

export function projectWorkProgressLabel(
  progress: ProjectWorkProgress | undefined,
): string | null {
  if (!progress) return null;
  return progress.kind === 'INTERVIEW_ANSWERS'
    ? `${progress.answeredQuestions} / ${progress.totalQuestions} questions answered`
    : `${progress.completedInputs} / ${progress.totalInputs} decision criteria completed`;
}
