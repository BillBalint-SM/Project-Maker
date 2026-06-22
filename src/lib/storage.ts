import type { Project, ProjectListItem } from "../data/types";
import { recalculateProject, toProjectListItem } from "./project";
import { createProjectStorageAdapter } from "./storageAdapters";
import type {
  ProjectStorageAdapter,
  ProjectStorageAdapterFactory
} from "./storageTypes";

function reviveProject(raw: Project): Project {
  return recalculateProject(raw);
}

export class ProjectRepository {
  private adapter: ProjectStorageAdapter | null = null;

  constructor(
    private readonly adapterFactory: ProjectStorageAdapterFactory = createProjectStorageAdapter
  ) {}

  async init() {
    this.adapter = await this.adapterFactory();
  }

  get mode() {
    return this.requireAdapter().info.mode;
  }

  async listProjects(archived: boolean): Promise<ProjectListItem[]> {
    const projects = await this.requireAdapter().listProjects(archived);

    return projects.map((project) => toProjectListItem(reviveProject(project)));
  }

  async getProject(id: string): Promise<Project | null> {
    const project = await this.requireAdapter().getProject(id);
    return project ? reviveProject(project) : null;
  }

  async saveProject(project: Project) {
    await this.requireAdapter().saveProject(reviveProject(project));
  }

  async archiveProject(id: string) {
    const project = await this.getProject(id);
    if (!project) return;
    await this.saveProject({
      ...project,
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  async reopenProject(id: string) {
    const project = await this.getProject(id);
    if (!project) return;
    await this.saveProject({
      ...project,
      archivedAt: null,
      updatedAt: new Date().toISOString()
    });
  }

  async deleteProject(id: string) {
    await this.requireAdapter().deleteProject(id);
  }

  private requireAdapter() {
    if (!this.adapter) {
      throw new Error("A projekt adattárolás még nincs inicializálva.");
    }

    return this.adapter;
  }
}

export const projectRepository = new ProjectRepository();
