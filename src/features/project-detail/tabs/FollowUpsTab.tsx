import { Trash2 } from "lucide-react";
import { followUpStatuses } from "../../../data/checklist";
import type { FollowUpStatus, Project } from "../../../data/types";
import { SelectField, TextField, TooltipIconButton } from "../../../ui/common";
import type { FollowUpChange } from "../detailTypes";
import { SectionTitle } from "../detailUi";

export function FollowUpsTab({
  project,
  disabled,
  onFollowUpChange,
  onDeleteFollowUp
}: {
  project: Project;
  disabled: boolean;
  onFollowUpChange: FollowUpChange;
  onDeleteFollowUp: (id: string) => void;
}) {
  return (
      <section className="form-section">
        <SectionTitle title="Nyitott kérdések" />
        <div className="followup-stack">
          {project.followUps.length === 0 && (
            <p className="empty-note">Nincs nyitott follow-up kérdés.</p>
          )}
          {project.followUps.map((followUp) => (
            <article className="followup-item" data-followup-id={followUp.id} key={followUp.id}>
              <TextField
                name={`followup-${followUp.id}-question`}
                label="Kérdés / hiányzó információ"
                textarea
                value={followUp.question}
                disabled={disabled}
                onChange={(value) =>
                  onFollowUpChange(followUp.id, (current) => ({
                    ...current,
                    question: value
                  }))
                }
              />
              <TextField
                name={`followup-${followUp.id}-owner`}
                label="Felelős"
                value={followUp.owner}
                disabled={disabled}
                onChange={(value) =>
                  onFollowUpChange(followUp.id, (current) => ({
                    ...current,
                    owner: value
                  }))
                }
              />
              <TextField
                name={`followup-${followUp.id}-dueDate`}
                label="Határidő"
                type="date"
                value={followUp.dueDate}
                disabled={disabled}
                onChange={(value) =>
                  onFollowUpChange(followUp.id, (current) => ({
                    ...current,
                    dueDate: value
                  }))
                }
              />
              <SelectField
                name={`followup-${followUp.id}-status`}
                label="Státusz"
                value={followUp.status}
                options={followUpStatuses}
                disabled={disabled}
                onChange={(value) =>
                  onFollowUpChange(followUp.id, (current) => ({
                    ...current,
                  status: value as FollowUpStatus
                  }))
                }
              />
              <TextField
                name={`followup-${followUp.id}-decisionOrAnswer`}
                label="Döntés / válasz"
                textarea
                value={followUp.decisionOrAnswer}
                disabled={disabled}
                onChange={(value) =>
                  onFollowUpChange(followUp.id, (current) => ({
                    ...current,
                    decisionOrAnswer: value
                  }))
                }
              />
              <TextField
                name={`followup-${followUp.id}-nextStep`}
                label="Következő lépés"
                textarea
                value={followUp.nextStep}
                disabled={disabled}
                onChange={(value) =>
                  onFollowUpChange(followUp.id, (current) => ({
                    ...current,
                    nextStep: value
                  }))
                }
              />
              {!disabled && (
                <TooltipIconButton
                  label="Follow-up törlése"
                  onClick={() => onDeleteFollowUp(followUp.id)}
                  variant="danger"
                >
                  <Trash2 size={17} />
                </TooltipIconButton>
              )}
            </article>
          ))}
        </div>
      </section>
  );
}
