import {
  Archive,
  ClipboardList,
  Edit3,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderOpen,
  RotateCcw,
  Trash2
} from "lucide-react";
import type { ExportPreset, ProjectListItem } from "../../data/types";
import type { ProjectListFilter } from "../../app/viewTypes";
import { ExportPresetSelect } from "../export/ExportPresetSelect";
import {
  CompletionBadge,
  DecisionScoreBadge,
  ReadinessBadge,
  StatusBadge,
  TooltipIconButton
} from "../../ui/common";

export function ProjectTable({
  archived,
  rows,
  query,
  selectedIds,
  filter,
  exportPreset,
  onQueryChange,
  onArchiveOpen,
  onActiveOpen,
  onView,
  onEdit,
  onArchive,
  onReopen,
  onDelete,
  onToggleSelection,
  onToggleVisibleSelection,
  onClearSelection,
  onFilterChange,
  onExportPresetChange,
  onExportPdf,
  onExportExcel
}: {
  archived: boolean;
  rows: ProjectListItem[];
  query: string;
  selectedIds: Set<string>;
  filter: ProjectListFilter;
  exportPreset: ExportPreset;
  onQueryChange: (value: string) => void;
  onArchiveOpen: () => void;
  onActiveOpen: () => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onArchive: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleSelection: (id: string) => void;
  onToggleVisibleSelection: (checked: boolean) => void;
  onClearSelection: () => void;
  onFilterChange: (filter: ProjectListFilter) => void;
  onExportPresetChange: (preset: ExportPreset) => void;
  onExportPdf: (ids: string[]) => void;
  onExportExcel: (ids: string[]) => void;
}) {
  const selectedVisibleIds = rows
    .map((row) => row.id)
    .filter((id) => selectedIds.has(id));
  const selectedCount = selectedVisibleIds.length;
  const hasRows = rows.length > 0;
  const allVisibleSelected = hasRows && selectedCount === rows.length;

  return (
    <main className="content-stack">
      <div className="toolbar">
        <input
          className="search-input"
          id="project-search"
          name="project-search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Keresés projektek között"
        />
        <div className="toolbar-actions">
          {selectedCount > 0 && (
            <>
              <span className="selection-pill">{selectedCount} kijelölve</span>
              <ExportPresetSelect value={exportPreset} onChange={onExportPresetChange} />
              <button
                className="secondary-button"
                type="button"
                onClick={() => onExportPdf(selectedVisibleIds)}
              >
                <FileText size={17} />
                PDF export
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => onExportExcel(selectedVisibleIds)}
              >
                <FileSpreadsheet size={17} />
                Excel export
              </button>
              <button className="secondary-button" type="button" onClick={onClearSelection}>
                Kijelölés törlése
              </button>
            </>
          )}
          {archived ? (
            <button className="secondary-button" type="button" onClick={onActiveOpen}>
              <FolderOpen size={17} />
              Aktív projektek
            </button>
          ) : (
            <button className="secondary-button" type="button" onClick={onArchiveOpen}>
              <Archive size={17} />
              Archívum
            </button>
          )}
        </div>
      </div>

      <ProjectFilters activeFilter={filter} onChange={onFilterChange} />

      <div className="table-wrap">
        <table className="project-table">
          <thead>
            <tr>
              <th className="selection-cell">
                <input
                  aria-label="Látható projektek kijelölése"
                  checked={allVisibleSelected}
                  disabled={!hasRows}
                  type="checkbox"
                  onChange={(event) => onToggleVisibleSelection(event.target.checked)}
                />
              </th>
              <th>Projekt Neve</th>
              <th>Kapcsolat elérhetősége</th>
              <th>Állapota</th>
              <th>Prioritás</th>
              <th>Határidő</th>
              <th>Kitöltöttség</th>
              <th>Readiness</th>
              <th>Decision Score</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="empty-cell">
                  Nincs megjeleníthető projekt.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="selection-cell" data-label="Kijelölés">
                  <input
                    aria-label={`${row.name} kijelölése`}
                    checked={selectedIds.has(row.id)}
                    type="checkbox"
                    onChange={() => onToggleSelection(row.id)}
                  />
                </td>
                <td data-label="Projekt Neve">{row.name}</td>
                <td data-label="Kapcsolat">{row.contact || "-"}</td>
                <td data-label="Állapota">
                  <StatusBadge label={row.status} />
                </td>
                <td data-label="Prioritás">{row.priority}</td>
                <td data-label="Határidő">{row.deadline || "-"}</td>
                <td data-label="Kitöltöttség">
                  <CompletionBadge
                    state={row.completionState}
                    percent={row.completionPercent}
                  />
                </td>
                <td data-label="Readiness">
                  <ReadinessBadge percent={row.readinessPercent} />
                </td>
                <td data-label="Decision Score">
                  <DecisionScoreBadge
                    score={row.decisionScore}
                    recommendation={row.decisionRecommendation}
                  />
                </td>
                <td className="row-actions">
                  <TooltipIconButton label="Megtekintés" onClick={() => onView(row.id)}>
                    <ClipboardList size={17} />
                  </TooltipIconButton>
                  {!archived && (
                    <>
                      <TooltipIconButton label="Szerkesztés" onClick={() => onEdit(row.id)}>
                        <Edit3 size={17} />
                      </TooltipIconButton>
                      <TooltipIconButton
                        label="Archiválás"
                        onClick={() => onArchive(row.id)}
                        variant="danger"
                      >
                        <Archive size={17} />
                      </TooltipIconButton>
                    </>
                  )}
                  {archived && (
                    <>
                      <TooltipIconButton label="Újra aktiválás" onClick={() => onReopen(row.id)}>
                        <RotateCcw size={17} />
                      </TooltipIconButton>
                      <TooltipIconButton
                        label="Végleges törlés"
                        onClick={() => onDelete(row.id)}
                        variant="danger"
                      >
                        <Trash2 size={17} />
                      </TooltipIconButton>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function ProjectFilters({
  activeFilter,
  onChange
}: {
  activeFilter: ProjectListFilter;
  onChange: (filter: ProjectListFilter) => void;
}) {
  const filters: Array<{
    id: ProjectListFilter;
    label: string;
  }> = [
    { id: "all", label: "Összes" },
    { id: "needsClarification", label: "Pontosítás kell" },
    { id: "readyForEstimate", label: "Becslésre vihető" },
    { id: "highScore", label: "Magas score" },
    { id: "deadline", label: "Határidős" }
  ];

  return (
    <div className="filter-strip" aria-label="Projektlista gyorsszűrők">
      <span>
        <Filter size={16} />
        Szűrők
      </span>
      {filters.map((filter) => (
        <button
          key={filter.id}
          className={activeFilter === filter.id ? "active" : ""}
          type="button"
          onClick={() => onChange(filter.id)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

