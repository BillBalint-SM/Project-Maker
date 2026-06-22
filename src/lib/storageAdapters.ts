import type { Project } from "../data/types";
import type { ProjectStorageAdapter, ProjectStorageInfo } from "./storageTypes";

type InvokeFn = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

type ProjectRow = {
  id: string;
  data: string;
};

type NativeStorageInfo = {
  mode: string;
  databasePath: string;
};

type ProjectRecordInput = {
  id: string;
  name: string;
  status: string;
  priority: string;
  deadline: string;
  completionState: string;
  completionPercent: number;
  archivedAt: string | null;
  updatedAt: string;
  data: string;
};

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

const localStorageKey = "project-maker.projects.v1";

function isTauriRuntime() {
  return Boolean(
    typeof window !== "undefined" &&
      ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

function parseProjectPayload(data: string): Project | null {
  try {
    return JSON.parse(data) as Project;
  } catch {
    return null;
  }
}

function byUpdatedDesc(a: Project, b: Project) {
  return b.updatedAt.localeCompare(a.updatedAt);
}

function toProjectRecord(project: Project): ProjectRecordInput {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    priority: project.priority,
    deadline: project.deadline,
    completionState: project.completion.state,
    completionPercent: project.completion.percent,
    archivedAt: project.archivedAt,
    updatedAt: project.updatedAt,
    data: JSON.stringify(project)
  };
}

export class LocalProjectStorageAdapter implements ProjectStorageAdapter {
  readonly info: ProjectStorageInfo = { mode: "localStorage" };

  constructor(private readonly storage: KeyValueStorage = localStorage) {}

  async listProjects(archived: boolean): Promise<Project[]> {
    return this.readProjects()
      .filter((project) => (archived ? project.archivedAt : !project.archivedAt))
      .sort(byUpdatedDesc);
  }

  async getProject(id: string): Promise<Project | null> {
    return this.readProjects().find((project) => project.id === id) ?? null;
  }

  async saveProject(project: Project): Promise<void> {
    const projects = this.readProjects().filter((item) => item.id !== project.id);
    projects.push(project);
    this.writeProjects(projects);
  }

  async deleteProject(id: string): Promise<void> {
    this.writeProjects(this.readProjects().filter((project) => project.id !== id));
  }

  private readProjects(): Project[] {
    const raw = this.storage.getItem(localStorageKey);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw) as Project[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeProjects(projects: Project[]) {
    this.storage.setItem(localStorageKey, JSON.stringify(projects));
  }
}

export class TauriSqliteProjectStorageAdapter implements ProjectStorageAdapter {
  readonly info: ProjectStorageInfo;

  private constructor(
    private readonly invoke: InvokeFn,
    storageInfo: NativeStorageInfo
  ) {
    this.info = {
      mode: "SQLite",
      databasePath: storageInfo.databasePath
    };
  }

  static async create(invoke: InvokeFn): Promise<TauriSqliteProjectStorageAdapter> {
    const storageInfo = await invoke<NativeStorageInfo>("project_storage_info");
    return new TauriSqliteProjectStorageAdapter(invoke, storageInfo);
  }

  async listProjects(archived: boolean): Promise<Project[]> {
    const rows = await this.invoke<ProjectRow[]>("list_projects_native", { archived });
    return rows
      .map((row) => parseProjectPayload(row.data))
      .filter((project): project is Project => Boolean(project));
  }

  async getProject(id: string): Promise<Project | null> {
    const row = await this.invoke<ProjectRow | null>("get_project_native", { id });
    return row ? parseProjectPayload(row.data) : null;
  }

  async saveProject(project: Project): Promise<void> {
    await this.invoke("save_project_native", {
      record: toProjectRecord(project)
    });
  }

  async deleteProject(id: string): Promise<void> {
    await this.invoke("delete_project_native", { id });
  }
}

export async function createProjectStorageAdapter(): Promise<ProjectStorageAdapter> {
  if (isTauriRuntime()) {
    try {
      const module = await import("@tauri-apps/api/core");
      return await TauriSqliteProjectStorageAdapter.create(module.invoke);
    } catch (error) {
      console.warn("Natív SQLite nem érhető el, localStorage fallback aktív.", error);
    }
  }

  return new LocalProjectStorageAdapter();
}
