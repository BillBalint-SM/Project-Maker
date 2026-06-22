import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Project } from "../../data/types";
import { makeProject } from "../../test/builders";
import { ProjectDetail } from "./ProjectDetailView";

function renderDetail({
  project = makeProject(),
  mode = "edit"
}: {
  project?: Project;
  mode?: "edit" | "view";
} = {}) {
  const props = {
    project,
    mode,
    saveStatus: "idle" as const,
    lastSavedAt: "",
    onBack: vi.fn(),
    onModeChange: vi.fn(),
    onArchive: vi.fn(),
    onExportPdf: vi.fn(),
    onExportExcel: vi.fn(),
    exportPreset: "executive" as const,
    onExportPresetChange: vi.fn(),
    onChange: vi.fn()
  };

  render(<ProjectDetail {...props} />);
  return props;
}

function lastProjectUpdate(onChange: ReturnType<typeof vi.fn>, project: Project) {
  const updater = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as
    | ((project: Project) => Project)
    | undefined;
  if (!updater) throw new Error("Missing project updater callback.");
  return updater(project);
}

describe("ProjectDetail", () => {
  it("renders every detail tab and primary navigation button", async () => {
    const user = userEvent.setup();
    renderDetail();

    expect(screen.getAllByText("Decision Score").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /Interjú/ }));
    expect(screen.getByRole("heading", { name: "Interjú mód" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Teljes felmérés" }));
    await user.click(screen.getByRole("button", { name: "Következő" }));
    await user.click(screen.getByRole("button", { name: "Előző" }));

    await user.click(screen.getByRole("button", { name: /Alapadatok/ }));
    expect(screen.getByLabelText("Projekt neve")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Checklist/ }));
    expect(screen.getByRole("heading", { name: "Részletes checklist" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Összes zárása" }));
    expect(screen.getAllByRole("button", { name: "Válaszmezők megnyitása" }).length).toBeGreaterThan(
      0
    );

    await user.click(screen.getByRole("button", { name: /Nyitott kérdések/ }));
    expect(screen.getByText("Nincs nyitott follow-up kérdés.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Döntés/ }));
    expect(screen.getByRole("heading", { name: "Decision Score faktorok" })).toBeInTheDocument();
  });

  it("updates overview, checklist, follow-up and decision data through callbacks", async () => {
    const user = userEvent.setup();
    const project = makeProject({
      followUps: [
        {
          id: "follow-1",
          sourceChecklistItemId: null,
          category: "Teszt",
          question: "Mi hiányzik?",
          owner: "PM User",
          dueDate: "",
          status: "Nyitott",
          decisionOrAnswer: "",
          nextStep: ""
        }
      ]
    });
    const props = renderDetail({ project });

    await user.click(screen.getByRole("button", { name: /Alapadatok/ }));
    fireEvent.change(screen.getByLabelText("Projekt neve"), {
      target: { value: "Beta projekt" }
    });
    expect(lastProjectUpdate(props.onChange, project).name).toBe("Beta projekt");

    await user.click(screen.getByRole("button", { name: /Checklist/ }));
    fireEvent.change(screen.getAllByLabelText("Státusz")[0], {
      target: { value: "Kész" }
    });
    expect(lastProjectUpdate(props.onChange, project).checklistAnswers[1].status).toBe("Kész");

    await user.click(screen.getAllByRole("button", { name: "Follow-up" })[0]);
    expect(lastProjectUpdate(props.onChange, project).followUps).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: /Nyitott kérdések/ }));
    fireEvent.change(screen.getByLabelText("Felelős"), {
      target: { value: "BA User" }
    });
    expect(lastProjectUpdate(props.onChange, project).followUps[0].owner).toBe("BA User");

    await user.click(screen.getByLabelText("Follow-up törlése"));
    expect(lastProjectUpdate(props.onChange, project).followUps).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: /Döntés/ }));
    fireEvent.change(screen.getByLabelText("Üzleti érték (1-5)"), {
      target: { value: "5" }
    });
    expect(lastProjectUpdate(props.onChange, project).decisionScores.businessValue).toBe(5);

    await user.click(screen.getByRole("button", { name: "Összefoglaló generálása" }));
    expect(lastProjectUpdate(props.onChange, project).decisionNote).toContain("Döntési javaslat");
  });

  it("covers view-mode header buttons and cockpit fix action", async () => {
    const user = userEvent.setup();
    const props = renderDetail({ mode: "view" });

    await user.selectOptions(screen.getByLabelText("Export csomag"), "full");
    expect(props.onExportPresetChange).toHaveBeenCalledWith("full");

    await user.click(screen.getByRole("button", { name: "PDF export" }));
    expect(props.onExportPdf).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Excel export" }));
    expect(props.onExportExcel).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Szerkesztés" }));
    expect(props.onModeChange).toHaveBeenCalledWith("edit");

    await user.click(screen.getByRole("button", { name: "Archiválás" }));
    expect(props.onArchive).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Következő teendő" }));
    expect(props.onModeChange).toHaveBeenCalledWith("edit");
    expect(screen.getByRole("heading", { name: "Részletes checklist" })).toBeInTheDocument();
  });
});
