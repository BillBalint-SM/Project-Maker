export type ProjectStatus =
  | "Előkészítés"
  | "Becslés alatt"
  | "Fejlesztésre kész"
  | "Blokkolt";

export type Priority = "Kiemelt" | "Fontos" | "Alap" | "Alacsony";

export type CompletionState = "Kész" | "Folyamatban" | "Pontosítás szükséges";

export type ChecklistStatus =
  | "Nincs meg"
  | "Részben megvan"
  | "Kész"
  | "Nem releváns";

export type FollowUpStatus =
  | "Nyitott"
  | "Folyamatban"
  | "Megválaszolva"
  | "Blokkolt"
  | "Nem releváns";

export type Decision = "Go" | "Feltételes Go" | "No-Go" | "";

export type ReadinessGapSeverity = "Kritikus" | "Fontos" | "Pontosítás";

export type DecisionScoreLabel = "Magas" | "Közepes" | "Alacsony";

export type GapTargetTab = "overview" | "checklist" | "followups" | "decision";

export type ExportPreset = "executive" | "full" | "gaps";

export interface ChecklistTemplateItem {
  id: number;
  category: string;
  controlPoint: string;
  exampleQuestion: string;
  hint: string;
  requiredForMvp: boolean;
  requiredForEstimate: boolean;
  blockingIfMissing: boolean;
}

export interface ChecklistAnswer {
  status: ChecklistStatus;
  owner: string;
  dueDate: string;
  answer: string;
  openQuestion: string;
  nextStep: string;
  updatedAt: string;
}

export interface FollowUpQuestion {
  id: string;
  sourceChecklistItemId: number | null;
  category: string;
  question: string;
  owner: string;
  dueDate: string;
  status: FollowUpStatus;
  decisionOrAnswer: string;
  nextStep: string;
}

export interface DecisionScores {
  businessValue: number;
  strategicAlignment: number;
  urgency: number;
  confidence: number;
  complexity: number;
  risk: number;
}

export interface ReadinessGap {
  severity: ReadinessGapSeverity;
  category: string;
  message: string;
  nextStep: string;
  targetTab: GapTargetTab;
  targetField?: string;
  checklistItemId?: number;
  followUpId?: string;
}

export interface ProjectCompletion {
  percent: number;
  state: CompletionState;
  readinessPercent: number;
  readinessState: string;
  totalItems: number;
  doneItems: number;
  partialItems: number;
  missingItems: number;
  notRelevantItems: number;
  mvpCriticalMissing: number;
  estimateBlockingMissing: number;
  openFollowUps: number;
  estimateReadiness: string;
  developmentReadiness: string;
  decisionScore: number;
  decisionScoreLabel: DecisionScoreLabel;
  decisionRecommendation: string;
  nextRecommendedAction: string;
  readinessGaps: ReadinessGap[];
}

export interface Project {
  id: string;
  name: string;
  customerOrOrganization: string;
  projectManager: string;
  businessAnalyst: string;
  productOwner: string;
  techLead: string;
  affectedTeams: string[];
  contactPhone: string;
  contactEmail: string;
  contactOther: string;
  kickoffDate: string;
  plannedDecisionDate: string;
  status: ProjectStatus;
  priority: Priority;
  deadline: string;
  businessProblem: string;
  expectedBusinessOutcome: string;
  firstMvpGoal: string;
  finalDecision: Decision;
  decisionDate: string;
  decisionMaker: string;
  decisionNote: string;
  decisionScores: DecisionScores;
  checklistAnswers: Record<number, ChecklistAnswer>;
  followUps: FollowUpQuestion[];
  completion: ProjectCompletion;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListItem {
  id: string;
  name: string;
  contact: string;
  status: ProjectStatus;
  priority: Priority;
  deadline: string;
  completionState: CompletionState;
  completionPercent: number;
  readinessPercent: number;
  decisionScore: number;
  decisionRecommendation: string;
  archivedAt: string | null;
  updatedAt: string;
}
