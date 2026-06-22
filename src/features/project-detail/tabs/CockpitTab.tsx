import {
  Activity,
  AlertTriangle,
  ClipboardList,
  Gauge,
  Sparkles,
  Target
} from "lucide-react";
import type { ReactNode } from "react";
import type { Project, ReadinessGap } from "../../../data/types";
import { slug } from "../../../ui/common";
import { SectionTitle } from "../detailUi";

export function DecisionCockpit({
  project,
  onFixGap
}: {
  project: Project;
  onFixGap: (gap: ReadinessGap) => void;
}) {
  const completion = project.completion;
  const gaps = completion.readinessGaps.slice(0, 10);
  const criticalGaps = completion.readinessGaps.filter(
    (gap) => gap.severity === "Kritikus"
  ).length;
  const importantGaps = completion.readinessGaps.filter(
    (gap) => gap.severity === "Fontos"
  ).length;
  const firstGap = completion.readinessGaps[0];

  return (
    <>
      <section className="cockpit-panel decision-panel">
        <div className="decision-main">
          <div className="score-emblem">
            <Gauge size={24} />
            <span>Decision Score</span>
            <strong>{completion.decisionScore}/100</strong>
            <small>{completion.decisionScoreLabel}</small>
          </div>
          <div className="decision-copy">
            <p className="eyebrow">Döntési javaslat</p>
            <h2>{completion.decisionRecommendation}</h2>
            <p>{completion.nextRecommendedAction}</p>
            {firstGap && (
              <button className="primary-button compact-action" type="button" onClick={() => onFixGap(firstGap)}>
                <Sparkles size={16} />
                Következő teendő
              </button>
            )}
          </div>
        </div>
        <div className="decision-stats">
          <MiniStat icon={<Target size={17} />} label="Readiness" value={`${completion.readinessPercent}%`} />
          <MiniStat icon={<Activity size={17} />} label="Állapot" value={completion.readinessState} />
          <MiniStat icon={<AlertTriangle size={17} />} label="Kritikus hiány" value={String(criticalGaps)} />
          <MiniStat icon={<ClipboardList size={17} />} label="Fontos hiány" value={String(importantGaps)} />
        </div>
      </section>

      <section className="cockpit-panel">
        <SectionTitle title="Score faktorok" />
        <div className="factor-stack">
          <ScoreFactor label="Readiness" value={completion.readinessPercent} max={100} />
          <ScoreFactor label="Üzleti érték" value={project.decisionScores.businessValue} />
          <ScoreFactor label="Stratégiai illeszkedés" value={project.decisionScores.strategicAlignment} />
          <ScoreFactor label="Sürgősség" value={project.decisionScores.urgency} />
          <ScoreFactor label="Confidence" value={project.decisionScores.confidence} />
          <ScoreFactor label="Komplexitás" value={project.decisionScores.complexity} inverted />
          <ScoreFactor label="Kockázat" value={project.decisionScores.risk} inverted />
        </div>
      </section>

      <ScoreExplanation project={project} />
      <EstimateBlockers project={project} onFixGap={onFixGap} />

      <section className="cockpit-panel">
        <SectionTitle title="Hiányzó információk" />
        <div className="gap-list">
          {gaps.length === 0 && (
            <p className="empty-note">Nincs kritikus vagy fontos hiányzó információ.</p>
          )}
          {gaps.map((gap, index) => (
            <article className={`gap-item ${slug(gap.severity)}`} key={`${gap.category}-${index}`}>
              <span>{gap.severity}</span>
              <div>
                <strong>{gap.category}</strong>
                <p>{gap.message}</p>
                <small>{gap.nextStep}</small>
              </div>
              <button className="secondary-button compact" type="button" onClick={() => onFixGap(gap)}>
                Javítás
              </button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function ScoreExplanation({ project }: { project: Project }) {
  const items = [
    ["Üzleti érték", "25%", `${project.decisionScores.businessValue}/5`],
    ["Stratégiai illeszkedés", "15%", `${project.decisionScores.strategicAlignment}/5`],
    ["Sürgősség", "15%", `${project.decisionScores.urgency}/5`],
    ["Confidence", "15%", `${project.decisionScores.confidence}/5`],
    ["Komplexitás", "10%", `${project.decisionScores.complexity}/5, alacsonyabb jobb`],
    ["Kockázat", "10%", `${project.decisionScores.risk}/5, alacsonyabb jobb`],
    ["Readiness", "10%", `${project.completion.readinessPercent}%`]
  ];

  return (
    <section className="cockpit-panel">
      <SectionTitle title="Score magyarázat" />
      <div className="explanation-grid">
        {items.map(([label, weight, value]) => (
          <div className="explanation-item" key={label}>
            <span>{weight}</span>
            <strong>{label}</strong>
            <small>{value}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function EstimateBlockers({
  project,
  onFixGap
}: {
  project: Project;
  onFixGap: (gap: ReadinessGap) => void;
}) {
  const blockers = project.completion.readinessGaps
    .filter((gap) => gap.severity !== "Pontosítás")
    .slice(0, 5);

  return (
    <section className="cockpit-panel">
      <SectionTitle title="Miért nem becsülhető?" />
      {project.completion.estimateReadiness === "Igen" ? (
        <p className="empty-note">Nincs becslést blokkoló hiány. A projekt becslésre vihető.</p>
      ) : (
        <div className="gap-list">
          {blockers.map((gap, index) => (
            <article className={`gap-item ${slug(gap.severity)}`} key={`${gap.category}-${index}`}>
              <span>{gap.severity}</span>
              <div>
                <strong>{gap.category}</strong>
                <p>{gap.message}</p>
                <small>{gap.nextStep}</small>
              </div>
              <button className="secondary-button compact" type="button" onClick={() => onFixGap(gap)}>
                Javítás
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MiniStat({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="mini-stat">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ScoreFactor({
  label,
  value,
  max = 5,
  inverted = false
}: {
  label: string;
  value: number;
  max?: 5 | 100;
  inverted?: boolean;
}) {
  const percent = max === 100 ? value : (value / max) * 100;
  const display = max === 100 ? `${value}%` : `${value}/5`;

  return (
    <div className={`factor-row ${inverted ? "inverted" : ""}`}>
      <div>
        <strong>{label}</strong>
        <span>{display}</span>
      </div>
      <div className="factor-track" aria-hidden="true">
        <span style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
    </div>
  );
}
