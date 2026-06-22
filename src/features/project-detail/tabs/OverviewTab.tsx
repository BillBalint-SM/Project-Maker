import { priorities, projectStatuses } from "../../../data/checklist";
import type { Priority, Project, ProjectStatus } from "../../../data/types";
import { SelectField, TextField } from "../../../ui/common";
import type { ProjectFieldChange } from "../detailTypes";
import { SectionTitle } from "../detailUi";

export function OverviewTab({
  project,
  disabled,
  onFieldChange
}: {
  project: Project;
  disabled: boolean;
  onFieldChange: ProjectFieldChange;
}) {
  return (
      <>
      <section className="form-section">
        <SectionTitle title="Projekt alapadatok" />
        <div className="form-grid">
          <TextField
            name="name"
            label="Projekt neve"
            value={project.name}
            disabled={disabled}
            onChange={(value) => onFieldChange("name", value)}
          />
          <TextField
            name="customerOrOrganization"
            label="Ügyfél / szervezet"
            value={project.customerOrOrganization}
            disabled={disabled}
            onChange={(value) => onFieldChange("customerOrOrganization", value)}
          />
          <SelectField
            name="status"
            label="Projekt státusza"
            value={project.status}
            options={projectStatuses}
            disabled={disabled}
            onChange={(value) => onFieldChange("status", value as ProjectStatus)}
          />
          <SelectField
            name="priority"
            label="Prioritás"
            value={project.priority}
            options={priorities}
            disabled={disabled}
            onChange={(value) => onFieldChange("priority", value as Priority)}
          />
          <TextField
            name="deadline"
            label="Határidő"
            type="date"
            value={project.deadline}
            disabled={disabled}
            onChange={(value) => onFieldChange("deadline", value)}
          />
          <TextField
            name="kickoffDate"
            label="Indító beszélgetés dátuma"
            type="date"
            value={project.kickoffDate}
            disabled={disabled}
            onChange={(value) => onFieldChange("kickoffDate", value)}
          />
          <TextField
            name="plannedDecisionDate"
            label="Tervezett döntési pont"
            type="date"
            value={project.plannedDecisionDate}
            disabled={disabled}
            onChange={(value) => onFieldChange("plannedDecisionDate", value)}
          />
          <TextField
            name="affectedTeams"
            label="Érintett csapat / szállító"
            value={project.affectedTeams.join(", ")}
            disabled={disabled}
            onChange={(value) =>
              onFieldChange(
                "affectedTeams",
                value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              )
            }
          />
        </div>
      </section>

      <section className="form-section">
        <SectionTitle title="Kapcsolat és felelősök" />
        <div className="form-grid">
          <TextField
            name="projectManager"
            label="Projekt Manager"
            value={project.projectManager}
            disabled={disabled}
            onChange={(value) => onFieldChange("projectManager", value)}
          />
          <TextField
            name="businessAnalyst"
            label="Business Analyst"
            value={project.businessAnalyst}
            disabled={disabled}
            onChange={(value) => onFieldChange("businessAnalyst", value)}
          />
          <TextField
            name="productOwner"
            label="Product Owner / üzleti felelős"
            value={project.productOwner}
            disabled={disabled}
            onChange={(value) => onFieldChange("productOwner", value)}
          />
          <TextField
            name="techLead"
            label="Tech Lead"
            value={project.techLead}
            disabled={disabled}
            onChange={(value) => onFieldChange("techLead", value)}
          />
          <TextField
            name="contactPhone"
            label="Telefonszám"
            value={project.contactPhone}
            disabled={disabled}
            onChange={(value) => onFieldChange("contactPhone", value)}
          />
          <TextField
            name="contactEmail"
            label="E-mail"
            type="email"
            value={project.contactEmail}
            disabled={disabled}
            onChange={(value) => onFieldChange("contactEmail", value)}
          />
          <TextField
            name="contactOther"
            label="Egyéb kapcsolat"
            value={project.contactOther}
            disabled={disabled}
            onChange={(value) => onFieldChange("contactOther", value)}
          />
        </div>
      </section>

      <section className="form-section">
        <SectionTitle title="Üzleti összefoglaló" />
        <div className="form-grid single">
          <TextField
            name="businessProblem"
            label="Rövid üzleti probléma"
            textarea
            value={project.businessProblem}
            disabled={disabled}
            onChange={(value) => onFieldChange("businessProblem", value)}
          />
          <TextField
            name="expectedBusinessOutcome"
            label="Elvárt üzleti eredmény"
            textarea
            value={project.expectedBusinessOutcome}
            disabled={disabled}
            onChange={(value) => onFieldChange("expectedBusinessOutcome", value)}
          />
          <TextField
            name="firstMvpGoal"
            label="Első MVP cél"
            textarea
            value={project.firstMvpGoal}
            disabled={disabled}
            onChange={(value) => onFieldChange("firstMvpGoal", value)}
          />
        </div>
      </section>
      </>
  );
}
