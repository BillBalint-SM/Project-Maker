import { describe, expect, it } from "vitest";
import { ProjectRepository } from "./storage";
import { LocalProjectStorageAdapter } from "./storageAdapters";
import { makeMemoryStorage, makeProject } from "../test/builders";

describe("project storage repository", () => {
  it("saves, lists, archives, reopens and deletes projects through an adapter", async () => {
    const storage = makeMemoryStorage();
    const adapter = new LocalProjectStorageAdapter(storage);
    const repository = new ProjectRepository(async () => adapter);
    const project = makeProject();

    await repository.init();
    expect(repository.mode).toBe("localStorage");

    await repository.saveProject(project);
    expect(await repository.getProject(project.id)).toMatchObject({
      id: project.id,
      name: "Alpha projekt"
    });
    expect(await repository.listProjects(false)).toHaveLength(1);
    expect(await repository.listProjects(true)).toHaveLength(0);

    await repository.archiveProject(project.id);
    expect(await repository.listProjects(false)).toHaveLength(0);
    expect(await repository.listProjects(true)).toHaveLength(1);

    await repository.reopenProject(project.id);
    expect(await repository.listProjects(false)).toHaveLength(1);

    await repository.deleteProject(project.id);
    expect(await repository.getProject(project.id)).toBeNull();
  });

  it("ignores broken localStorage payloads instead of crashing", async () => {
    const storage = makeMemoryStorage("not-json");
    const adapter = new LocalProjectStorageAdapter(storage);

    await expect(adapter.listProjects(false)).resolves.toEqual([]);
  });
});
