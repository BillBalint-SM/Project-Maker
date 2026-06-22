import { Save } from "lucide-react";
import { useId } from "react";
import type { ReactNode } from "react";
import type { SaveStatus } from "../app/viewTypes";
import type { CompletionState, ProjectStatus } from "../data/types";

export function TextField({
  name,
  label,
  value,
  disabled,
  onChange,
  textarea = false,
  type = "text"
}: {
  name?: string;
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  textarea?: boolean;
  type?: string;
}) {
  const generatedId = useId();
  const fieldName = name ?? slug(label);
  const fieldId = `${fieldName}-${generatedId.replace(/:/g, "")}`;

  return (
    <label className="field" htmlFor={fieldId}>
      <span>{label}</span>
      {textarea ? (
        <textarea
          id={fieldId}
          name={fieldName}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={fieldId}
          name={fieldName}
          type={type}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

export function SelectField<T extends readonly string[]>({
  name,
  label,
  value,
  options,
  disabled,
  onChange
}: {
  name?: string;
  label: string;
  value: string;
  options: T;
  disabled: boolean;
  onChange: (value: T[number]) => void;
}) {
  const generatedId = useId();
  const fieldName = name ?? slug(label);
  const fieldId = `${fieldName}-${generatedId.replace(/:/g, "")}`;

  return (
    <label className="field" htmlFor={fieldId}>
      <span>{label}</span>
      <select
        id={fieldId}
        name={fieldName}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T[number])}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option || "-"}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TooltipIconButton({
  label,
  onClick,
  children,
  variant = "default"
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  variant?: "default" | "danger";
}) {
  return (
    <span className="tooltip-wrap">
      <button
        className={`icon-button ${variant === "danger" ? "danger" : ""}`}
        type="button"
        aria-label={label}
        onClick={onClick}
      >
        {children}
        <span className="icon-button-label">{label}</span>
      </button>
      <span className="tooltip" role="tooltip">
        {label}
      </span>
    </span>
  );
}

export function SaveState({
  status,
  lastSavedAt
}: {
  status: SaveStatus;
  lastSavedAt: string;
}) {
  const labels: Record<SaveStatus, string> = {
    idle: "Nincs nem mentett változás",
    saving: "Mentés folyamatban",
    saved: lastSavedAt ? `Mentve ${lastSavedAt}` : "Mentve",
    error: "Mentési hiba"
  };
  const hints: Record<SaveStatus, string> = {
    idle: "Automata mentés aktív",
    saving: "A módosításokat helyben rögzíti",
    saved: "Minden változtatás biztonságban",
    error: "Ellenőrizd az adattárolást"
  };

  return (
    <span className={`save-state ${status}`}>
      <Save size={15} />
      <span>
        <strong>{labels[status]}</strong>
        <small>{hints[status]}</small>
      </span>
    </span>
  );
}

export function CompletionBadge({
  state,
  percent
}: {
  state: CompletionState;
  percent: number;
}) {
  return (
    <span className={`completion-badge ${slug(state)}`}>
      {state} · {percent}%
    </span>
  );
}

export function ReadinessBadge({ percent }: { percent: number }) {
  const tone = percent >= 75 ? "kesz" : percent >= 55 ? "folyamatban" : "pontositas-szukseges";

  return (
    <span className={`completion-badge ${tone}`}>
      {percent}%
    </span>
  );
}

export function DecisionScoreBadge({
  score,
  recommendation
}: {
  score: number;
  recommendation: string;
}) {
  const tone = score >= 75 ? "kesz" : score >= 55 ? "folyamatban" : "pontositas-szukseges";

  return (
    <span className={`completion-badge decision-score ${tone}`}>
      {score}/100 · {recommendation}
    </span>
  );
}

export function StatusBadge({ label }: { label: ProjectStatus }) {
  return <span className={`status-badge ${slug(label)}`}>{label}</span>;
}

export function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function formatTime(date: Date) {
  return date.toLocaleTimeString("hu-HU", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

