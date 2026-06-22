import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toProjectListItem } from "./lib/project";
import { makeProject } from "./test/builders";

const repositoryMock = vi.hoisted(() => ({
  init: vi.fn(),
  listProjects: vi.fn(),
  getProject: vi.fn(),
  saveProject: vi.fn(),
  archiveProject: vi.fn(),
  reopenProject: vi.fn(),
  deleteProject: vi.fn(),
  mode: "localStorage"
}));

const exportMock = vi.hoisted(() => ({
  buildProjectsPdfBlob: vi.fn(),
  buildProjectsExcelBlob: vi.fn(),
  makeExportFileName: vi.fn(),
  saveExportBlob: vi.fn()
}));

vi.mock("./lib/storage", () => ({
  projectRepository: repositoryMock
}));

vi.mock("./lib/export", () => exportMock);

async function renderAppWithProjects() {
  const { App } = await import("./App");
  render(<App />);
  await waitFor(() => expect(repositoryMock.init).toHaveBeenCalled());
}

describe("App smoke workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const project = makeProject();
    repositoryMock.init.mockResolvedValue(undefined);
    repositoryMock.listProjects.mockImplementation(async (archived: boolean) =>
      archived ? [] : [toProjectListItem(project)]
    );
    repositoryMock.getProject.mockResolvedValue(project);
    repositoryMock.saveProject.mockResolvedValue(undefined);
    repositoryMock.archiveProject.mockResolvedValue(undefined);
    repositoryMock.reopenProject.mockResolvedValue(undefined);
    repositoryMock.deleteProject.mockResolvedValue(undefined);
    exportMock.buildProjectsPdfBlob.mockResolvedValue(new Blob(["pdf"]));
    exportMock.buildProjectsExcelBlob.mockResolvedValue(new Blob(["xlsx"]));
    exportMock.makeExportFileName.mockReturnValue("alpha-projekt.pdf");
    exportMock.saveExportBlob.mockResolvedValue("exports/alpha-projekt.pdf");
  });

  it("starts a new project from the home screen and opens detail edit mode", async () => {
    const user = userEvent.setup();
    repositoryMock.listProjects.mockResolvedValue([]);

    await renderAppWithProjects();

    expect(screen.getByRole("heading", { name: "Projektindítás" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Új projekt felmérése" }));

    await screen.findByRole("button", { name: "Megtekintés" });
    expect(repositoryMock.saveProject).toHaveBeenCalledOnce();
    expect(screen.getByText("Böngészős mentés aktív")).toBeInTheDocument();
  });

  it("opens an existing project, toggles edit mode and exports from detail view", async () => {
    const user = userEvent.setup();

    await renderAppWithProjects();
    await user.click(screen.getByRole("button", { name: "Meglévő projektek" }));

    expect(await screen.findByText("Alpha projekt")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Megtekintés"));

    expect(await screen.findByRole("heading", { name: "Alpha projekt" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "PDF export" }));

    await screen.findByText(/export elkészült/);
    expect(exportMock.buildProjectsPdfBlob).toHaveBeenCalledOnce();
    expect(exportMock.saveExportBlob).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Szerkesztés" }));
    expect(screen.getByRole("button", { name: "Megtekintés" })).toBeInTheDocument();
  });

  it("moves through active and archive screens using list-level actions", async () => {
    const user = userEvent.setup();
    const project = makeProject();
    let activeProjects = [project];
    let archivedProjects = [] as typeof activeProjects;
    repositoryMock.listProjects.mockImplementation(async (archived: boolean) =>
      (archived ? archivedProjects : activeProjects).map(toProjectListItem)
    );
    repositoryMock.archiveProject.mockImplementation(async (id: string) => {
      const match = activeProjects.find((item) => item.id === id);
      activeProjects = activeProjects.filter((item) => item.id !== id);
      if (match) archivedProjects = [{ ...match, archivedAt: "2026-06-22T10:00:00.000Z" }];
    });
    repositoryMock.reopenProject.mockImplementation(async (id: string) => {
      const match = archivedProjects.find((item) => item.id === id);
      archivedProjects = archivedProjects.filter((item) => item.id !== id);
      if (match) activeProjects = [{ ...match, archivedAt: null }];
    });

    await renderAppWithProjects();
    await user.click(screen.getByRole("button", { name: "Meglévő projektek" }));
    await screen.findByText("Alpha projekt");

    await user.click(screen.getByLabelText("Archiválás"));
    await screen.findByText("Nincs megjeleníthető projekt.");

    await user.click(screen.getByRole("button", { name: "Archívum" }));
    expect(await screen.findByText("Alpha projekt")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Újra aktiválás"));
    await screen.findByText("Nincs megjeleníthető projekt.");

    await user.click(screen.getByRole("button", { name: "Aktív projektek" }));
    expect(await screen.findByText("Alpha projekt")).toBeInTheDocument();
  });
});
