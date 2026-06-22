import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  Edit3,
  FileSpreadsheet,
  FileText
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  ChecklistAnswer,
  ExportPreset,
  FollowUpQuestion,
  Project,
  ReadinessGap
} from "../../data/types";
import type { DetailMode, SaveStatus } from "../../app/viewTypes";
import { checklistTemplate } from "../../data/checklist";
import { createFollowUpFromChecklist } from "../../lib/project";
import { SaveState } from "../../ui/common";
import { ExportPresetSelect } from "../export/ExportPresetSelect";
import { DetailTabs, Metric } from "./detailUi";
import type { DetailTab } from "./detailTypes";
import { ChecklistTab } from "./tabs/ChecklistTab";
import { DecisionCockpit } from "./tabs/CockpitTab";
import { DecisionTab } from "./tabs/DecisionTab";
import {
  buildInterviewSteps,
  InterviewTab,
  type InterviewMode
} from "./tabs/InterviewTab";
import { FollowUpsTab } from "./tabs/FollowUpsTab";
import { OverviewTab } from "./tabs/OverviewTab";

export function ProjectDetail({
  project,
  mode,
  saveStatus,
  lastSavedAt,
  onBack,
  onModeChange,
  onArchive,
  onExportPdf,
  onExportExcel,
  exportPreset,
  onExportPresetChange,
  onChange
}: {
  project: Project;
  mode: DetailMode;
  saveStatus: SaveStatus;
  lastSavedAt: string;
  onBack: () => void;
  onModeChange: (mode: DetailMode) => void;
  onArchive: () => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
  exportPreset: ExportPreset;
  onExportPresetChange: (preset: ExportPreset) => void;
  onChange: (updater: (project: Project) => Project) => void;
}) {
  const disabled = mode === "view";
  const [activeTab, setActiveTab] = useState<DetailTab>("cockpit");
  const [interviewMode, setInterviewMode] = useState<InterviewMode>("quick");
  const [interviewStepIndex, setInterviewStepIndex] = useState(0);
  const [expandedChecklistItems, setExpandedChecklistItems] = useState<Set<number>>(
    () => new Set([1])
  );

  const interviewSteps = useMemo(
    () => buildInterviewSteps(interviewMode),
    [interviewMode]
  );
  const interviewStep = interviewSteps[Math.min(interviewStepIndex, interviewSteps.length - 1)];

  useEffect(() => {
    setActiveTab("cockpit");
    setInterviewStepIndex(0);
    setExpandedChecklistItems(new Set([1]));
  }, [project.id]);

  useEffect(() => {
    setInterviewStepIndex((current) => Math.min(current, interviewSteps.length - 1));
  }, [interviewSteps.length]);

  function toggleChecklistItem(itemId: number) {
    setExpandedChecklistItems((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  function setAllChecklistItems(open: boolean) {
    setExpandedChecklistItems(
      open ? new Set(checklistTemplate.map((item) => item.id)) : new Set()
    );
  }

  function updateField<K extends keyof Project>(key: K, value: Project[K]) {
    onChange((current) => ({ ...current, [key]: value }));
  }

  function updateDecisionScore(
    key: keyof Project["decisionScores"],
    value: number
  ) {
    onChange((current) => ({
      ...current,
      decisionScores: {
        ...current.decisionScores,
        [key]: value
      }
    }));
  }

  function focusField(fieldName: string) {
    window.setTimeout(() => {
      const element = document.querySelector<HTMLElement>(`[name="${fieldName}"]`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      element?.focus();
    }, 80);
  }

  function fixGap(gap: ReadinessGap) {
    if (mode === "view") {
      onModeChange("edit");
    }

    setActiveTab(gap.targetTab);

    if (gap.checklistItemId) {
      setExpandedChecklistItems((current) => {
        const next = new Set(current);
        next.add(gap.checklistItemId as number);
        return next;
      });
      focusField(`checklist-${gap.checklistItemId}-status`);
      return;
    }

    if (gap.followUpId) {
      focusField(`followup-${gap.followUpId}-question`);
      return;
    }

    if (gap.targetField) {
      focusField(gap.targetField);
    }
  }

  function updateChecklist(
    itemId: number,
    updater: (answer: ChecklistAnswer) => ChecklistAnswer
  ) {
    onChange((current) => ({
      ...current,
      checklistAnswers: {
        ...current.checklistAnswers,
        [itemId]: updater(current.checklistAnswers[itemId])
      }
    }));
  }

  function addFollowUp(itemId: number) {
    onChange((current) => ({
      ...current,
      followUps: [...current.followUps, createFollowUpFromChecklist(current, itemId)]
    }));
  }

  function updateFollowUp(
    id: string,
    updater: (followUp: FollowUpQuestion) => FollowUpQuestion
  ) {
    onChange((current) => ({
      ...current,
      followUps: current.followUps.map((followUp) =>
        followUp.id === id ? updater(followUp) : followUp
      )
    }));
  }

  function deleteFollowUp(id: string) {
    onChange((current) => ({
      ...current,
      followUps: current.followUps.filter((followUp) => followUp.id !== id)
    }));
  }

  return (
    <main className="detail-layout">
      <section className="detail-header">
        <button className="secondary-button" type="button" onClick={onBack}>
          <ArrowLeft size={17} />
          Vissza
        </button>
        <div className="detail-actions">
          <SaveState status={saveStatus} lastSavedAt={lastSavedAt} />
          {mode === "view" ? (
            <>
              <ExportPresetSelect value={exportPreset} onChange={onExportPresetChange} />
              <button className="secondary-button" type="button" onClick={onExportPdf}>
                <FileText size={17} />
                PDF export
              </button>
              <button className="secondary-button" type="button" onClick={onExportExcel}>
                <FileSpreadsheet size={17} />
                Excel export
              </button>
              <button className="primary-button" type="button" onClick={() => onModeChange("edit")}>
                <Edit3 size={17} />
                Szerkesztés
              </button>
            </>
          ) : (
            <button className="secondary-button" type="button" onClick={() => onModeChange("view")}>
              <CheckCircle2 size={17} />
              Megtekintés
            </button>
          )}
          {!project.archivedAt && (
            <button className="secondary-button danger" type="button" onClick={onArchive}>
              <Archive size={17} />
              Archiválás
            </button>
          )}
        </div>
      </section>

      <section className="summary-band">
        <Metric label="Readiness" value={`${project.completion.readinessPercent}%`} />
        <Metric label="Decision Score" value={`${project.completion.decisionScore}/100`} />
        <Metric label="Javaslat" value={project.completion.decisionRecommendation} />
        <Metric
          label="Becslés adható?"
          value={project.completion.estimateReadiness}
        />
      </section>

      <DetailTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        openFollowUps={project.completion.openFollowUps}
        checklistPercent={project.completion.percent}
        decisionScore={project.completion.decisionScore}
        decisionRecommendation={project.completion.decisionRecommendation}
      />

      {activeTab === "cockpit" && <DecisionCockpit project={project} onFixGap={fixGap} />}

      {activeTab === "interview" && (
        <InterviewTab
          project={project}
          disabled={disabled}
          mode={interviewMode}
          step={interviewStep}
          stepIndex={interviewStepIndex}
          stepCount={interviewSteps.length}
          onModeChange={(nextMode) => {
            setInterviewMode(nextMode);
            setInterviewStepIndex(0);
          }}
          onPrevious={() => setInterviewStepIndex((current) => Math.max(0, current - 1))}
          onNext={() =>
            setInterviewStepIndex((current) =>
              Math.min(interviewSteps.length - 1, current + 1)
            )
          }
          onFieldChange={(key, value) => updateField(key, value as Project[typeof key])}
          onChecklistChange={updateChecklist}
          onOpenCockpit={() => setActiveTab("cockpit")}
        />
      )}

      {activeTab === "overview" && (
        <OverviewTab
          project={project}
          disabled={disabled}
          onFieldChange={updateField}
        />
      )}

      {activeTab === "checklist" && (
        <ChecklistTab
          project={project}
          disabled={disabled}
          expandedChecklistItems={expandedChecklistItems}
          onToggleChecklistItem={toggleChecklistItem}
          onSetAllChecklistItems={setAllChecklistItems}
          onChecklistChange={updateChecklist}
          onAddFollowUp={addFollowUp}
        />
      )}

      {activeTab === "followups" && (
        <FollowUpsTab
          project={project}
          disabled={disabled}
          onFollowUpChange={updateFollowUp}
          onDeleteFollowUp={deleteFollowUp}
        />
      )}

      {activeTab === "decision" && (
        <DecisionTab
          project={project}
          disabled={disabled}
          onFieldChange={updateField}
          onDecisionScoreChange={updateDecisionScore}
        />
      )}
    </main>
  );
}
