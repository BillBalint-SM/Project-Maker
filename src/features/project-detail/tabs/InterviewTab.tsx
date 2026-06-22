import { checklistStatuses, checklistTemplate } from "../../../data/checklist";
import type { ChecklistAnswer, ChecklistStatus, Project } from "../../../data/types";
import { SelectField, TextField, slug } from "../../../ui/common";
import type { ChecklistAnswerChange } from "../detailTypes";
import { Metric } from "../detailUi";

export type InterviewMode = "quick" | "full";
export type InterviewStep =
  | {
      type: "field";
      key: (typeof interviewFieldSteps)[number]["key"];
      label: string;
      prompt: string;
      textarea?: boolean;
      inputType?: string;
    }
  | {
      type: "checklist";
      itemId: number;
    }
  | {
      type: "review";
    };

const scoreOptions = ["1", "2", "3", "4", "5"] as const;
const quickInterviewChecklistIds = [1, 2, 3, 7, 9, 13, 21, 22, 25, 26];
export const interviewFieldSteps = [
  {
    key: "businessProblem",
    label: "Rövid üzleti probléma",
    prompt: "Milyen üzleti problémát akarunk megszüntetni?",
    textarea: true
  },
  {
    key: "expectedBusinessOutcome",
    label: "Elvárt üzleti eredmény",
    prompt: "Milyen mérhető vagy validálható eredmény jelzi, hogy megérte?",
    textarea: true
  },
  {
    key: "firstMvpGoal",
    label: "Első MVP cél",
    prompt: "Mi legyen az első szállítható, működő verzió?",
    textarea: true
  },
  {
    key: "productOwner",
    label: "Product Owner / üzleti felelős",
    prompt: "Ki hoz üzleti döntést és ki fogadja el az eredményt?"
  },
  {
    key: "deadline",
    label: "Határidő",
    prompt: "Van fix üzleti, jogi vagy szerződéses dátum?",
    inputType: "date"
  }
] as const;

export function buildInterviewSteps(mode: InterviewMode): InterviewStep[] {
  const checklistIds =
    mode === "quick"
      ? quickInterviewChecklistIds
      : checklistTemplate.map((item) => item.id);

  return [
    ...interviewFieldSteps.map((step) => ({ ...step, type: "field" as const })),
    ...checklistIds.map((itemId) => ({ type: "checklist" as const, itemId })),
    { type: "review" as const }
  ];
}

function generateDecisionSummary(project: Project) {
  const topGaps = project.completion.readinessGaps
    .slice(0, 3)
    .map((gap, index) => `${index + 1}. ${gap.category}: ${gap.message}`)
    .join("\n");

  return [
    `Döntési javaslat: ${project.completion.decisionRecommendation}`,
    `Readiness: ${project.completion.readinessPercent}% (${project.completion.readinessState})`,
    `Decision Score: ${project.completion.decisionScore}/100 (${project.completion.decisionScoreLabel})`,
    `Becslés adható: ${project.completion.estimateReadiness}`,
    `Következő lépés: ${project.completion.nextRecommendedAction}`,
    topGaps ? `Top hiányok:\n${topGaps}` : "Top hiányok: nincs kritikus hiány."
  ].join("\n");
}

export function InterviewTab({
  project,
  disabled,
  mode,
  step,
  stepIndex,
  stepCount,
  onModeChange,
  onPrevious,
  onNext,
  onFieldChange,
  onChecklistChange,
  onOpenCockpit
}: {
  project: Project;
  disabled: boolean;
  mode: InterviewMode;
  step: InterviewStep;
  stepIndex: number;
  stepCount: number;
  onModeChange: (mode: InterviewMode) => void;
  onPrevious: () => void;
  onNext: () => void;
  onFieldChange: (key: (typeof interviewFieldSteps)[number]["key"], value: string) => void;
  onChecklistChange: (
    itemId: number,
    updater: (answer: ChecklistAnswer) => ChecklistAnswer
  ) => void;
  onOpenCockpit: () => void;
}) {
  const progress = Math.round(((stepIndex + 1) / stepCount) * 100);

  return (
    <section className="interview-panel">
      <div className="interview-header">
        <div>
          <p className="eyebrow">Vezetett PM/PO workflow</p>
          <h2>Interjú mód</h2>
        </div>
        <div className="mode-toggle" aria-label="Interjú mód választása">
          <button
            className={mode === "quick" ? "active" : ""}
            type="button"
            onClick={() => onModeChange("quick")}
          >
            Gyors felmérés
          </button>
          <button
            className={mode === "full" ? "active" : ""}
            type="button"
            onClick={() => onModeChange("full")}
          >
            Teljes felmérés
          </button>
        </div>
      </div>

      <div className="interview-progress">
        <span>{stepIndex + 1} / {stepCount}</span>
        <div aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="interview-step">
        {step.type === "field" && (
          <>
            <p className="interview-prompt">{step.prompt}</p>
            <TextField
              name={`interview-${step.key}`}
              label={step.label}
              textarea={step.textarea}
              type={step.inputType ?? "text"}
              value={String(project[step.key] ?? "")}
              disabled={disabled}
              onChange={(value) => onFieldChange(step.key, value)}
            />
          </>
        )}

        {step.type === "checklist" && (
          <InterviewChecklistStep
            project={project}
            disabled={disabled}
            itemId={step.itemId}
            onChecklistChange={onChecklistChange}
          />
        )}

        {step.type === "review" && (
          <InterviewReview project={project} onOpenCockpit={onOpenCockpit} />
        )}
      </div>

      <div className="interview-actions">
        <button
          className="secondary-button"
          type="button"
          disabled={stepIndex === 0}
          onClick={onPrevious}
        >
          Előző
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={stepIndex === stepCount - 1}
          onClick={onNext}
        >
          Következő
        </button>
      </div>
    </section>
  );
}

function InterviewChecklistStep({
  project,
  disabled,
  itemId,
  onChecklistChange
}: {
  project: Project;
  disabled: boolean;
  itemId: number;
  onChecklistChange: (
    itemId: number,
    updater: (answer: ChecklistAnswer) => ChecklistAnswer
  ) => void;
}) {
  const item = checklistTemplate.find((entry) => entry.id === itemId);
  if (!item) return null;
  const answer = project.checklistAnswers[itemId];

  return (
    <div className="interview-checklist">
      <div>
        <span className="checklist-index">{item.id}</span>
        <p className="eyebrow">{item.category}</p>
        <h2>{item.controlPoint}</h2>
        <p>{item.exampleQuestion}</p>
        <p className="hint">{item.hint}</p>
      </div>
      <div className="form-grid">
        <SelectField
          name={`interview-checklist-${item.id}-status`}
          label="Státusz"
          value={answer.status}
          options={checklistStatuses}
          disabled={disabled}
          onChange={(value) =>
            onChecklistChange(item.id, (current) => ({
              ...current,
              status: value as ChecklistStatus
            }))
          }
        />
        <TextField
          name={`interview-checklist-${item.id}-owner`}
          label="Felelős"
          value={answer.owner}
          disabled={disabled}
          onChange={(value) =>
            onChecklistChange(item.id, (current) => ({
              ...current,
              owner: value
            }))
          }
        />
        <TextField
          name={`interview-checklist-${item.id}-answer`}
          label="Válasz / megállapítás"
          textarea
          value={answer.answer}
          disabled={disabled}
          onChange={(value) =>
            onChecklistChange(item.id, (current) => ({
              ...current,
              answer: value
            }))
          }
        />
        <TextField
          name={`interview-checklist-${item.id}-openQuestion`}
          label="Nyitott kérdés"
          textarea
          value={answer.openQuestion}
          disabled={disabled}
          onChange={(value) =>
            onChecklistChange(item.id, (current) => ({
              ...current,
              openQuestion: value
            }))
          }
        />
      </div>
    </div>
  );
}

function InterviewReview({
  project,
  onOpenCockpit
}: {
  project: Project;
  onOpenCockpit: () => void;
}) {
  const topGaps = project.completion.readinessGaps.slice(0, 5);

  return (
    <div className="interview-review">
      <h2>Readiness review</h2>
      <div className="review-grid">
        <Metric label="Readiness" value={`${project.completion.readinessPercent}%`} />
        <Metric label="Decision Score" value={`${project.completion.decisionScore}/100`} />
        <Metric label="Javaslat" value={project.completion.decisionRecommendation} />
      </div>
      <div className="gap-list">
        {topGaps.length === 0 && <p className="empty-note">Nincs kritikus hiány.</p>}
        {topGaps.map((gap, index) => (
          <article className={`gap-item ${slug(gap.severity)}`} key={`${gap.message}-${index}`}>
            <span>{gap.severity}</span>
            <div>
              <strong>{gap.category}</strong>
              <p>{gap.message}</p>
              <small>{gap.nextStep}</small>
            </div>
          </article>
        ))}
      </div>
      <button className="primary-button" type="button" onClick={onOpenCockpit}>
        Cockpit megnyitása
      </button>
    </div>
  );
}
