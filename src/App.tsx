import { ArrowLeft, FilePlus2, FolderOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ExportPreset, Project, ProjectListItem } from "./data/types";
import { createDraftProject, touchProject } from "./lib/project";
import {
  buildProjectsExcelBlob,
  buildProjectsPdfBlob,
  makeExportFileName,
  saveExportBlob
} from "./lib/export";
import { projectRepository } from "./lib/storage";
import type { DetailMode, ProjectListFilter, SaveStatus } from "./app/viewTypes";
import { exportPresetLabels } from "./features/export/exportPreset";
import { ProjectDetail } from "./features/project-detail/ProjectDetailView";
import { ProjectTable } from "./features/projects/ProjectTable";
import { TooltipIconButton, formatTime } from "./ui/common";

type AppView = "home" | "projects" | "archive" | "detail";

export function App() {
  const [view, setView] = useState<AppView>("home");
  const [detailMode, setDetailMode] = useState<DetailMode>("view");
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [archive, setArchive] = useState<ProjectListItem[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [storageMode, setStorageMode] = useState("Betöltés...");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [appError, setAppError] = useState("");
  const [appNotice, setAppNotice] = useState("");
  const [query, setQuery] = useState("");
  const [listFilter, setListFilter] = useState<ProjectListFilter>("all");
  const [exportPreset, setExportPreset] = useState<ExportPreset>("executive");
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(
    () => new Set()
  );

  useEffect(() => {
    projectRepository
      .init()
      .then(() => {
        setStorageMode(projectRepository.mode);
        refreshLists();
      })
      .catch((error) => {
        console.error(error);
        setAppError("Az adattárolás inicializálása nem sikerült.");
      });
  }, []);

  const visibleProjects = useMemo(() => {
    const source = view === "archive" ? archive : projects;
    const today = new Date().toISOString().slice(0, 10);
    const filteredByView = source.filter((item) => {
      if (listFilter === "needsClarification") {
        return item.decisionRecommendation === "Pontosítás szükséges";
      }

      if (listFilter === "readyForEstimate") {
        return ["Becslésre vihető", "Feltételes becslés"].includes(
          item.decisionRecommendation
        );
      }

      if (listFilter === "highScore") {
        return item.decisionScore >= 75;
      }

      if (listFilter === "deadline") {
        return Boolean(item.deadline && item.deadline <= today);
      }

      return true;
    });
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return filteredByView;

    return filteredByView.filter((item) =>
      [
        item.name,
        item.contact,
        item.status,
        item.priority,
        item.completionState,
        item.decisionRecommendation
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [archive, listFilter, projects, query, view]);

  useEffect(() => {
    setSelectedProjectIds(new Set());
  }, [view]);

  async function refreshLists() {
    try {
      const [activeRows, archivedRows] = await Promise.all([
        projectRepository.listProjects(false),
        projectRepository.listProjects(true)
      ]);
      setProjects(activeRows);
      setArchive(archivedRows);
      setAppError("");
    } catch (error) {
      console.error(error);
      setAppError("A projektlista betöltése nem sikerült.");
    }
  }

  async function startNewProject() {
    try {
      const project = createDraftProject();
      await projectRepository.saveProject(project);
      await refreshLists();
      setSelectedProject(project);
      setDetailMode("edit");
      setSaveStatus("saved");
      setLastSavedAt(formatTime(new Date()));
      setAppError("");
      setAppNotice("");
      setView("detail");
    } catch (error) {
      console.error(error);
      setSaveStatus("error");
      setAppError("Az új projekt létrehozása nem sikerült.");
    }
  }

  async function openProject(id: string, mode: DetailMode) {
    const project = await projectRepository.getProject(id);
    if (!project) return;

    setSelectedProject(project);
    setDetailMode(mode);
    setSaveStatus("idle");
    setView("detail");
  }

  async function saveProject(project: Project) {
    setSaveStatus("saving");
    try {
      await projectRepository.saveProject(project);
      await refreshLists();
      setSaveStatus("saved");
      setLastSavedAt(formatTime(new Date()));
    } catch (error) {
      console.error(error);
      setSaveStatus("error");
    }
  }

  function updateSelectedProject(updater: (project: Project) => Project) {
    setSelectedProject((current) => {
      if (!current) return current;
      const next = touchProject(updater(current));
      void saveProject(next);
      return next;
    });
  }

  async function archiveProject(id: string) {
    await projectRepository.archiveProject(id);
    setSelectedProjectIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    await refreshLists();
    if (selectedProject?.id === id) {
      setSelectedProject(null);
      setView("projects");
    }
  }

  async function reopenProject(id: string) {
    await projectRepository.reopenProject(id);
    await refreshLists();
  }

  async function deleteProject(id: string) {
    const confirmed = window.confirm(
      "Biztosan végleg törlöd ezt az archivált projektet?"
    );
    if (!confirmed) return;

    await projectRepository.deleteProject(id);
    setSelectedProjectIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    await refreshLists();
  }

  function toggleProjectSelection(id: string) {
    setSelectedProjectIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleVisibleProjectSelection(checked: boolean) {
    const visibleIds = visibleProjects.map((project) => project.id);
    setSelectedProjectIds((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });
      return next;
    });
  }

  async function loadProjectsForExport(ids: string[]) {
    const loaded = await Promise.all(ids.map((id) => projectRepository.getProject(id)));
    return loaded.filter((project): project is Project => Boolean(project));
  }

  async function exportProjects(ids: string[], format: "pdf" | "excel") {
    try {
      setAppNotice("");
      setAppError("");
      const selectedProjects = await loadProjectsForExport(ids);
      if (selectedProjects.length === 0) {
        setAppError("Nincs exportálható kijelölt projekt.");
        return;
      }

      const blob =
        format === "pdf"
          ? await buildProjectsPdfBlob(selectedProjects, exportPreset)
          : await buildProjectsExcelBlob(selectedProjects, exportPreset);
      const fileName = makeExportFileName(
        selectedProjects,
        format === "pdf" ? "pdf" : "xlsx",
        exportPreset
      );
      const savedPath = await saveExportBlob(blob, fileName);
      setAppNotice(
        `${exportPresetLabels[exportPreset]} export elkészült: ${savedPath}`
      );
    } catch (error) {
      console.error(error);
      setAppError("Az export nem sikerült.");
    }
  }

  const shellClass = view === "home" ? "app-shell home-shell" : "app-shell";

  return (
    <div className={shellClass}>
      <header className="topbar">
        <div>
          <p className="eyebrow">Project Maker</p>
          <h1>
            {view === "home"
              ? "Projektindítás"
              : view === "archive"
                ? "Archívum"
                : view === "projects"
                  ? "Meglévő projektek"
                  : selectedProject?.name ?? "Projekt"}
          </h1>
        </div>
        <div className="topbar-actions">
          <span className="storage-pill">{formatStorageMode(storageMode)}</span>
          {view !== "home" && (
            <TooltipIconButton label="Főmenü" onClick={() => setView("home")}>
              <ArrowLeft size={18} />
            </TooltipIconButton>
          )}
        </div>
      </header>

      {appError && <div className="error-banner">{appError}</div>}
      {appNotice && <div className="notice-banner">{appNotice}</div>}

      {view === "home" && (
        <main className="home-grid">
          <button className="main-action" type="button" onClick={startNewProject}>
            <FilePlus2 size={30} />
            <span>Új projekt felmérése</span>
          </button>
          <button className="main-action" type="button" onClick={() => setView("projects")}>
            <FolderOpen size={30} />
            <span>Meglévő projektek</span>
          </button>
        </main>
      )}

      {(view === "projects" || view === "archive") && (
        <ProjectTable
          archived={view === "archive"}
          rows={visibleProjects}
          query={query}
          onQueryChange={setQuery}
          onArchiveOpen={() => setView("archive")}
          onActiveOpen={() => setView("projects")}
          onView={(id) => openProject(id, "view")}
          onEdit={(id) => openProject(id, "edit")}
          onArchive={archiveProject}
          onReopen={reopenProject}
          onDelete={deleteProject}
          selectedIds={selectedProjectIds}
          filter={listFilter}
          exportPreset={exportPreset}
          onToggleSelection={toggleProjectSelection}
          onToggleVisibleSelection={toggleVisibleProjectSelection}
          onClearSelection={() => setSelectedProjectIds(new Set())}
          onFilterChange={setListFilter}
          onExportPresetChange={setExportPreset}
          onExportPdf={(ids) => exportProjects(ids, "pdf")}
          onExportExcel={(ids) => exportProjects(ids, "excel")}
        />
      )}

      {view === "detail" && selectedProject && (
        <ProjectDetail
          project={selectedProject}
          mode={detailMode}
          saveStatus={saveStatus}
          lastSavedAt={lastSavedAt}
          onBack={() => setView(selectedProject.archivedAt ? "archive" : "projects")}
          onModeChange={setDetailMode}
          onArchive={() => archiveProject(selectedProject.id)}
          onExportPdf={() => exportProjects([selectedProject.id], "pdf")}
          onExportExcel={() => exportProjects([selectedProject.id], "excel")}
          exportPreset={exportPreset}
          onExportPresetChange={setExportPreset}
          onChange={updateSelectedProject}
        />
      )}
    </div>
  );
}


function formatStorageMode(mode: string) {
  if (mode === "SQLite") return "Helyi adatbázis aktív";
  if (mode === "localStorage") return "Böngészős mentés aktív";
  return mode;
}
