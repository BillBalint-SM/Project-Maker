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
  softDelete: vi.fn()
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
});
