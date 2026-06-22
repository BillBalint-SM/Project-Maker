import type { Project } from "../data/types";

export type ProjectStorageInfo = {
  mode: "SQLite" | "localStorage";
  databasePath?: string;
};

export interface ProjectStorageAdapter {
  readonly info: ProjectStorageInfo;
  listProjects(archived: boolean): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  saveProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;
}

export type ProjectStorageAdapterFactory = () => Promise<ProjectStorageAdapter>;
