import { ChevronDown, ChevronRight, FilePlus2 } from "lucide-react";
import { checklistStatuses, checklistTemplate } from "../../../data/checklist";
import type { ChecklistStatus, Project } from "../../../data/types";
import { SelectField, TextField } from "../../../ui/common";
import type { ChecklistAnswerChange } from "../detailTypes";
import { SectionTitle } from "../detailUi";

export function ChecklistTab({
  project,
  disabled,
  expandedChecklistItems,
  onToggleChecklistItem,
  onSetAllChecklistItems,
  onChecklistChange,
  onAddFollowUp
}: {
  project: Project;
  disabled: boolean;
  expandedChecklistItems: Set<number>;
  onToggleChecklistItem: (itemId: number) => void;
  onSetAllChecklistItems: (open: boolean) => void;
  onChecklistChange: ChecklistAnswerChange;
  onAddFollowUp: (itemId: number) => void;
}) {
  return (
      <section className="form-section">
        <SectionTitle
          title="Részletes checklist"
          actions={
            <div className="section-actions">
              <button className="secondary-button compact" type="button" onClick={() => onSetAllChecklistItems(true)}>
                Összes nyitása
              </button>
              <button className="secondary-button compact" type="button" onClick={() => onSetAllChecklistItems(false)}>
                Összes zárása
              </button>
            </div>
          }
        />
        <div className="checklist-stack">
          {checklistTemplate.map((item) => {
            const answer = project.checklistAnswers[item.id];
            const isExpanded = expandedChecklistItems.has(item.id);

            return (
              <article
                className={`checklist-item ${isExpanded ? "expanded" : "collapsed"}`}
                data-checklist-item={item.id}
                key={item.id}
              >
                <div className="checklist-copy">
                  <span className="checklist-index">{item.id}</span>
                  <div>
                    <h3>{item.category}</h3>
                    <p className="control-point">{item.controlPoint}</p>
                    <p>{item.exampleQuestion}</p>
                    <p className="hint">{item.hint}</p>
                    <div className="flags">
                      {item.requiredForMvp && <span>MVP</span>}
                      {item.requiredForEstimate && <span>Becslés</span>}
                      {item.blockingIfMissing && <span>Blokkoló</span>}
                    </div>
                  </div>
                </div>
                <div className="checklist-fields">
                  <SelectField
                    name={`checklist-${item.id}-status`}
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
                    name={`checklist-${item.id}-owner`}
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
                    name={`checklist-${item.id}-due-date`}
                    label="Határidő"
                    type="date"
                    value={answer.dueDate}
                    disabled={disabled}
                    onChange={(value) =>
                      onChecklistChange(item.id, (current) => ({
                        ...current,
                        dueDate: value
                      }))
                    }
                  />
                  <button
                    className="secondary-button full-width checklist-toggle"
                    type="button"
                    onClick={() => onToggleChecklistItem(item.id)}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    {isExpanded ? "Részletek elrejtése" : "Válaszmezők megnyitása"}
                  </button>
                  {isExpanded && (
                  <>
                  <TextField
                    name={`checklist-${item.id}-answer`}
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
                    name={`checklist-${item.id}-open-question`}
                    label="Nyitott kérdés / follow-up"
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
                  <TextField
                    name={`checklist-${item.id}-next-step`}
                    label="Következő lépés"
                    textarea
                    value={answer.nextStep}
                    disabled={disabled}
                    onChange={(value) =>
                      onChecklistChange(item.id, (current) => ({
                        ...current,
                        nextStep: value
                      }))
                    }
                  />
                  {!disabled && (
                    <button
                      className="secondary-button full-width"
                      type="button"
                      onClick={() => onAddFollowUp(item.id)}
                    >
                      <FilePlus2 size={16} />
                      Follow-up
                    </button>
                  )}
                  </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
  );
}
