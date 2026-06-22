import { Sparkles } from "lucide-react";
import { decisions } from "../../../data/checklist";
import type { Project } from "../../../data/types";
import { SelectField, TextField } from "../../../ui/common";
import type { DecisionScoreChange, ProjectFieldChange } from "../detailTypes";
import { SectionTitle } from "../detailUi";

const scoreOptions = ["1", "2", "3", "4", "5"] as const;

export function DecisionTab({
  project,
  disabled,
  onFieldChange,
  onDecisionScoreChange
}: {
  project: Project;
  disabled: boolean;
  onFieldChange: ProjectFieldChange;
  onDecisionScoreChange: DecisionScoreChange;
}) {
  return (
      <>
        <section className="form-section">
          <SectionTitle title="Decision Score faktorok" />
          <div className="score-grid">
            <ScoreSelect
              label="Üzleti érték"
              value={project.decisionScores.businessValue}
              disabled={disabled}
              onChange={(value) => onDecisionScoreChange("businessValue", value)}
            />
            <ScoreSelect
              label="Stratégiai illeszkedés"
              value={project.decisionScores.strategicAlignment}
              disabled={disabled}
              onChange={(value) => onDecisionScoreChange("strategicAlignment", value)}
            />
            <ScoreSelect
              label="Sürgősség"
              value={project.decisionScores.urgency}
              disabled={disabled}
              onChange={(value) => onDecisionScoreChange("urgency", value)}
            />
            <ScoreSelect
              label="Confidence"
              value={project.decisionScores.confidence}
              disabled={disabled}
              onChange={(value) => onDecisionScoreChange("confidence", value)}
            />
            <ScoreSelect
              label="Komplexitás"
              value={project.decisionScores.complexity}
              disabled={disabled}
              onChange={(value) => onDecisionScoreChange("complexity", value)}
            />
            <ScoreSelect
              label="Kockázat"
              value={project.decisionScores.risk}
              disabled={disabled}
              onChange={(value) => onDecisionScoreChange("risk", value)}
            />
          </div>
        </section>

        <section className="form-section">
          <SectionTitle
            title="Döntési blokk"
            actions={
              !disabled && (
                <button
                  className="secondary-button compact"
                  type="button"
                  onClick={() => onFieldChange("decisionNote", generateDecisionSummary(project))}
                >
                  <Sparkles size={15} />
                  Összefoglaló generálása
                </button>
              )
            }
          />
          <div className="form-grid">
            <SelectField
              name="finalDecision"
              label="Végső döntés"
              value={project.finalDecision}
              options={decisions}
              disabled={disabled}
              onChange={(value) => onFieldChange("finalDecision", value as Project["finalDecision"])}
            />
            <TextField
              name="decisionDate"
              label="Döntés dátuma"
              type="date"
              value={project.decisionDate}
              disabled={disabled}
              onChange={(value) => onFieldChange("decisionDate", value)}
            />
            <TextField
              name="decisionMaker"
              label="Döntéshozó"
              value={project.decisionMaker}
              disabled={disabled}
              onChange={(value) => onFieldChange("decisionMaker", value)}
            />
            <TextField
              name="decisionNote"
              label="Megjegyzés"
              textarea
              value={project.decisionNote}
              disabled={disabled}
              onChange={(value) => onFieldChange("decisionNote", value)}
            />
          </div>
        </section>
      </>
  );
}

export function generateDecisionSummary(project: Project) {
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

function ScoreSelect({
  label,
  value,
  disabled,
  onChange
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <SelectField
      label={`${label} (1-5)`}
      value={String(value)}
      options={scoreOptions}
      disabled={disabled}
      onChange={(nextValue) => onChange(Number(nextValue))}
    />
  );
}
