import { useCallback, useEffect, useState } from "react";
import { CURRENT_APP_SCHEMA_VERSION } from "../../domain/model/envelope";
import type { Envelope } from "../../domain/model/envelope";
import { createEmptyProject } from "../../domain/model/factory";
import type { Project, ProjectListItem } from "../../domain/model/types";
import { getStorage } from "../../main";

/**
 * Walking Skeleton proof-of-life UI (D-03/D-04): a minimal projects list
 * that reads from and writes to the real IndexedDB (via RxDB) through the
 * StoragePort. This is deliberately NOT the real survey/interview UI
 * (Phase 2) — only enough to prove build → domain-model → RxDB
 * persistence → routing → UI end to end.
 */
export function ProjectListView() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);

  const refresh = useCallback(async () => {
    const storage = await getStorage();
    const items = await storage.list();
    setProjects(items);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleAddTestProject() {
    const storage = await getStorage();
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const data = createEmptyProject({ id, name: `Teszt projekt ${timestamp}` });

    const envelope: Envelope<Project> = {
      id,
      schemaVersion: CURRENT_APP_SCHEMA_VERSION,
      data,
      // The adapter's put() bumps this to 1 (or existing.revision + 1) —
      // the value passed here is irrelevant, only its presence matters.
      revision: 0,
      updatedAt: timestamp,
      updatedBy: "local-user",
      deletedAt: null,
      dirty: true
    };

    await storage.put(envelope);
    await refresh();
  }

  return (
    <main>
      <h1>Projektek</h1>
      <button type="button" onClick={handleAddTestProject}>
        Új teszt-projekt
      </button>
      {projects.length === 0 ? (
        <p>Nincs megjeleníthető projekt.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Projekt neve</th>
              <th>Állapota</th>
              <th>Utolsó módosítás</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>{project.name}</td>
                <td>{project.status}</td>
                <td>{project.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
