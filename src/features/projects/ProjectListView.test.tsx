import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectListItem } from "../../domain/model/types";

// Same vi.hoisted + vi.mock pattern as src/App.test.tsx: mock the module
// ProjectListView actually obtains storage from (main.tsx's lazy
// singleton `getStorage()`) — never import real RxDB/container.ts here.
const storageMock = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  softDelete: vi.fn(),
  exportBackup: vi.fn(),
  importBackup: vi.fn()
}));

vi.mock("../../main", () => ({
  getStorage: vi.fn(async () => storageMock)
}));

function makeListItem(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  return {
    id: "id-1",
    name: "Névtelen projekt",
    contact: "",
    status: "Előkészítés",
    priority: "Alap",
    deadline: "",
    completionState: "Folyamatban",
    completionPercent: 0,
    readinessPercent: 0,
    decisionScore: 0,
    decisionRecommendation: "Pontosítás szükséges",
    archivedAt: null,
    updatedAt: "2026-07-09T10:00:00.000Z",
    ...overrides
  };
}

async function renderView() {
  const { ProjectListView } = await import("./ProjectListView");
  render(<ProjectListView />);
}

describe("ProjectListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMock.put.mockResolvedValue(undefined);
    storageMock.softDelete.mockResolvedValue(undefined);
    storageMock.exportBackup.mockResolvedValue(
      new Blob(['{"projects":[]}'], { type: "application/json" })
    );
    storageMock.importBackup.mockResolvedValue(undefined);

    // jsdom's URL does not implement the Blob-URL APIs — assign fresh spies
    // directly on the real URL class (NOT vi.stubGlobal with a plain object
    // copy, which would break `new URL(...)` elsewhere in the app/router) so
    // the component's download flow (createObjectURL + <a> + revokeObjectURL)
    // is exercised without touching a real object-URL registry.
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();
  });

  it('shows "Nincs megjeleníthető projekt." when the list is empty', async () => {
    storageMock.list.mockResolvedValue([]);

    await renderView();

    expect(await screen.findByText("Nincs megjeleníthető projekt.")).toBeInTheDocument();
  });

  it("renders both project names when storage.list() returns two projects", async () => {
    storageMock.list.mockResolvedValue([
      makeListItem({ id: "1", name: "Alpha projekt" }),
      makeListItem({ id: "2", name: "Beta projekt" })
    ]);

    await renderView();

    expect(await screen.findByText("Alpha projekt")).toBeInTheDocument();
    expect(screen.getByText("Beta projekt")).toBeInTheDocument();
  });

  it("clicking \"Új teszt-projekt\" calls put() with a valid envelope, then refreshes the list", async () => {
    storageMock.list
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeListItem({ id: "3", name: "Friss teszt projekt" })]);
    const user = userEvent.setup();

    await renderView();
    await screen.findByText("Nincs megjeleníthető projekt.");

    await user.click(screen.getByRole("button", { name: "Új teszt-projekt" }));

    await waitFor(() => expect(storageMock.put).toHaveBeenCalledOnce());
    const [envelope] = storageMock.put.mock.calls[0];
    expect(envelope.data).toBeDefined();
    expect(envelope.deletedAt).toBeNull();

    expect(storageMock.list).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("Friss teszt projekt")).toBeInTheDocument();
  });

  it('clicking "Törlés" calls storage.softDelete(id) and the row disappears from the list', async () => {
    storageMock.list
      .mockResolvedValueOnce([makeListItem({ id: "1", name: "Alpha projekt" })])
      .mockResolvedValueOnce([]);
    const user = userEvent.setup();

    await renderView();
    await screen.findByText("Alpha projekt");

    await user.click(screen.getByRole("button", { name: "Törlés" }));

    await waitFor(() => expect(storageMock.softDelete).toHaveBeenCalledWith("1"));
    expect(storageMock.list).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Alpha projekt")).not.toBeInTheDocument();
  });

  it('clicking "Adatmentés exportálása" calls storage.exportBackup() and downloads the resulting Blob via URL.createObjectURL', async () => {
    storageMock.list.mockResolvedValue([]);
    const user = userEvent.setup();

    await renderView();
    await screen.findByText("Nincs megjeleníthető projekt.");

    await user.click(screen.getByRole("button", { name: "Adatmentés exportálása" }));

    await waitFor(() => expect(storageMock.exportBackup).toHaveBeenCalledOnce());
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it('selecting a valid backup file calls storage.importBackup(file), refreshes the list, and shows a success notice', async () => {
    storageMock.list
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeListItem({ id: "1", name: "Visszaállított projekt" })]);
    const user = userEvent.setup();

    await renderView();
    await screen.findByText("Nincs megjeleníthető projekt.");

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['{"projects":[]}'], "backup.json", { type: "application/json" });
    await user.upload(fileInput, file);

    await waitFor(() => expect(storageMock.importBackup).toHaveBeenCalledWith(file));
    expect(storageMock.list).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("Visszaállított projekt")).toBeInTheDocument();
    expect(await screen.findByText("Visszaállítás sikeres.")).toBeInTheDocument();
  });

  it("selecting an invalid backup file shows an error message and does not touch the rendered list", async () => {
    storageMock.list.mockResolvedValue([makeListItem({ id: "1", name: "Alpha projekt" })]);
    storageMock.importBackup.mockRejectedValueOnce(
      new Error("Invalid backup entry at index 0: name Required")
    );
    const user = userEvent.setup();

    await renderView();
    await screen.findByText("Alpha projekt");

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["not valid json"], "backup.json", { type: "application/json" });
    await user.upload(fileInput, file);

    await waitFor(() => expect(storageMock.importBackup).toHaveBeenCalledWith(file));
    expect(
      await screen.findByText(
        "Visszaállítás sikertelen: Invalid backup entry at index 0: name Required"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Alpha projekt")).toBeInTheDocument();
  });
});
