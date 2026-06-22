import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProjectListFilter } from "../../app/viewTypes";
import { toProjectListItem } from "../../lib/project";
import { makeProject } from "../../test/builders";
import { ProjectTable } from "./ProjectTable";

function renderTable(overrides: Partial<Parameters<typeof ProjectTable>[0]> = {}) {
  const row = toProjectListItem(makeProject());
  const props: Parameters<typeof ProjectTable>[0] = {
    archived: false,
    rows: [row],
    query: "",
    selectedIds: new Set(),
    filter: "all",
    exportPreset: "executive",
    onQueryChange: vi.fn(),
    onArchiveOpen: vi.fn(),
    onActiveOpen: vi.fn(),
    onView: vi.fn(),
    onEdit: vi.fn(),
    onArchive: vi.fn(),
    onReopen: vi.fn(),
    onDelete: vi.fn(),
    onToggleSelection: vi.fn(),
    onToggleVisibleSelection: vi.fn(),
    onClearSelection: vi.fn(),
    onFilterChange: vi.fn(),
    onExportPresetChange: vi.fn(),
    onExportPdf: vi.fn(),
    onExportExcel: vi.fn(),
    ...overrides
  };

  render(<ProjectTable {...props} />);
  return { props, row };
}

describe("ProjectTable", () => {
  it("covers active list buttons: search, filters, view, edit and archive", async () => {
    const user = userEvent.setup();
    const { props, row } = renderTable();

    await user.type(screen.getByPlaceholderText("Keresés projektek között"), "alpha");
    expect(props.onQueryChange).toHaveBeenLastCalledWith("a");

    await user.click(screen.getByRole("button", { name: "Pontosítás kell" }));
    expect(props.onFilterChange).toHaveBeenCalledWith(
      "needsClarification" satisfies ProjectListFilter
    );

    await user.click(screen.getByLabelText("Megtekintés"));
    expect(props.onView).toHaveBeenCalledWith(row.id);

    await user.click(screen.getByLabelText("Szerkesztés"));
    expect(props.onEdit).toHaveBeenCalledWith(row.id);

    await user.click(screen.getByLabelText("Archiválás"));
    expect(props.onArchive).toHaveBeenCalledWith(row.id);

    await user.click(screen.getByRole("button", { name: "Archívum" }));
    expect(props.onArchiveOpen).toHaveBeenCalledOnce();
  });

  it("covers selection and export actions", async () => {
    const user = userEvent.setup();
    const selectedProject = toProjectListItem(makeProject());
    const { props } = renderTable({
      rows: [selectedProject],
      selectedIds: new Set([selectedProject.id])
    });

    await user.click(screen.getByRole("button", { name: "PDF export" }));
    expect(props.onExportPdf).toHaveBeenCalledWith([selectedProject.id]);

    await user.click(screen.getByRole("button", { name: "Excel export" }));
    expect(props.onExportExcel).toHaveBeenCalledWith([selectedProject.id]);

    await user.selectOptions(screen.getByLabelText("Export csomag"), "full");
    expect(props.onExportPresetChange).toHaveBeenCalledWith("full");

    await user.click(screen.getByRole("button", { name: "Kijelölés törlése" }));
    expect(props.onClearSelection).toHaveBeenCalledOnce();

    await user.click(screen.getByLabelText("Látható projektek kijelölése"));
    expect(props.onToggleVisibleSelection).toHaveBeenCalledWith(false);
  });

  it("covers archived list buttons: reopen, delete and active-list navigation", async () => {
    const user = userEvent.setup();
    const archivedRow = toProjectListItem(makeProject({ archivedAt: "2026-06-22T10:00:00.000Z" }));
    const { props } = renderTable({
      archived: true,
      rows: [archivedRow]
    });

    await user.click(screen.getByLabelText("Újra aktiválás"));
    expect(props.onReopen).toHaveBeenCalledWith(archivedRow.id);

    await user.click(screen.getByLabelText("Végleges törlés"));
    expect(props.onDelete).toHaveBeenCalledWith(archivedRow.id);

    await user.click(screen.getByRole("button", { name: "Aktív projektek" }));
    expect(props.onActiveOpen).toHaveBeenCalledOnce();
  });
});
