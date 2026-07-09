import { z } from "zod";

/**
 * Zod runtime-validation schemas mirroring src/domain/model/types.ts
 * field-for-field. These replace the legacy `as Project` cast
 * (src/lib/storageAdapters.ts) with real validation at every
 * read/write boundary (DATA-05) — invalid data throws, it is never
 * silently written.
 *
 * Domain-purity rule: this file must never import from rxdb/dexie/react or
 * any adapters/features module — only `zod` and sibling domain/model files.
 */

const ChecklistStatusSchema = z.enum(["Nincs meg", "Részben megvan", "Kész", "Nem releváns"]);

const FollowUpStatusSchema = z.enum([
  "Nyitott",
  "Folyamatban",
  "Megválaszolva",
  "Blokkolt",
  "Nem releváns"
]);

const ProjectStatusSchema = z.enum([
  "Előkészítés",
  "Becslés alatt",
  "Fejlesztésre kész",
  "Blokkolt"
]);

const PrioritySchema = z.enum(["Kiemelt", "Fontos", "Alap", "Alacsony"]);

const CompletionStateSchema = z.enum(["Kész", "Folyamatban", "Pontosítás szükséges"]);

// Note: the empty string "" IS a valid enum tag for Decision (legacy "no decision yet" state).
const DecisionSchema = z.enum(["Go", "Feltételes Go", "No-Go", ""]);

const ReadinessGapSeveritySchema = z.enum(["Kritikus", "Fontos", "Pontosítás"]);

const DecisionScoreLabelSchema = z.enum(["Magas", "Közepes", "Alacsony"]);

const GapTargetTabSchema = z.enum(["overview", "checklist", "followups", "decision"]);

export const ChecklistAnswerSchema = z.object({
  status: ChecklistStatusSchema,
  owner: z.string(),
  dueDate: z.string(),
  answer: z.string(),
  openQuestion: z.string(),
  nextStep: z.string(),
  updatedAt: z.string()
});

export const FollowUpQuestionSchema = z.object({
  id: z.string(),
  sourceChecklistItemId: z.number().nullable(),
  category: z.string(),
  question: z.string(),
  owner: z.string(),
  dueDate: z.string(),
  status: FollowUpStatusSchema,
  decisionOrAnswer: z.string(),
  nextStep: z.string()
});

export const DecisionScoresSchema = z.object({
  businessValue: z.number(),
  strategicAlignment: z.number(),
  urgency: z.number(),
  confidence: z.number(),
  complexity: z.number(),
  risk: z.number()
});

export const ReadinessGapSchema = z.object({
  severity: ReadinessGapSeveritySchema,
  category: z.string(),
  message: z.string(),
  nextStep: z.string(),
  targetTab: GapTargetTabSchema,
  targetField: z.string().optional(),
  checklistItemId: z.number().optional(),
  followUpId: z.string().optional()
});

export const ProjectCompletionSchema = z.object({
  percent: z.number(),
  state: CompletionStateSchema,
  readinessPercent: z.number(),
  readinessState: z.string(),
  totalItems: z.number(),
  doneItems: z.number(),
  partialItems: z.number(),
  missingItems: z.number(),
  notRelevantItems: z.number(),
  mvpCriticalMissing: z.number(),
  estimateBlockingMissing: z.number(),
  openFollowUps: z.number(),
  estimateReadiness: z.string(),
  developmentReadiness: z.string(),
  decisionScore: z.number(),
  decisionScoreLabel: DecisionScoreLabelSchema,
  decisionRecommendation: z.string(),
  nextRecommendedAction: z.string(),
  readinessGaps: z.array(ReadinessGapSchema)
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  customerOrOrganization: z.string(),
  projectManager: z.string(),
  businessAnalyst: z.string(),
  productOwner: z.string(),
  techLead: z.string(),
  affectedTeams: z.array(z.string()),
  contactPhone: z.string(),
  contactEmail: z.string(),
  contactOther: z.string(),
  kickoffDate: z.string(),
  plannedDecisionDate: z.string(),
  status: ProjectStatusSchema,
  priority: PrioritySchema,
  deadline: z.string(),
  businessProblem: z.string(),
  expectedBusinessOutcome: z.string(),
  firstMvpGoal: z.string(),
  finalDecision: DecisionSchema,
  decisionDate: z.string(),
  decisionMaker: z.string(),
  decisionNote: z.string(),
  decisionScores: DecisionScoresSchema,
  // JS object keys are always strings at runtime, even for numeric-literal
  // property names — so the Zod key schema must be z.string(), NOT
  // z.number(), even though the TS type declares checklistAnswers as
  // Record<number, ChecklistAnswer>.
  checklistAnswers: z.record(z.string(), ChecklistAnswerSchema),
  followUps: z.array(FollowUpQuestionSchema),
  completion: ProjectCompletionSchema,
  playbookId: z.string().min(1),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

/**
 * Builds a Zod object schema for Envelope<T> around an arbitrary payload
 * schema, validating all 8 Envelope fields.
 */
export function createEnvelopeSchema<DataSchema extends z.ZodType>(dataSchema: DataSchema) {
  return z.object({
    id: z.string().min(1),
    schemaVersion: z.number().int().nonnegative(),
    data: dataSchema,
    revision: z.number().int().nonnegative(),
    updatedAt: z.string(),
    updatedBy: z.string().min(1),
    deletedAt: z.string().nullable(),
    dirty: z.boolean()
  });
}

export const ProjectEnvelopeSchema = createEnvelopeSchema(ProjectSchema);
