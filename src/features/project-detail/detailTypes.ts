import type { ChecklistAnswer, FollowUpQuestion, Project } from "../../data/types";

export type DetailTab =
  | "cockpit"
  | "interview"
  | "overview"
  | "checklist"
  | "followups"
  | "decision";

export type ProjectFieldChange = <K extends keyof Project>(
  key: K,
  value: Project[K]
) => void;

export type ChecklistAnswerChange = (
  itemId: number,
  updater: (answer: ChecklistAnswer) => ChecklistAnswer
) => void;

export type FollowUpChange = (
  id: string,
  updater: (followUp: FollowUpQuestion) => FollowUpQuestion
) => void;

export type DecisionScoreChange = (
  key: keyof Project["decisionScores"],
  value: number
) => void;
