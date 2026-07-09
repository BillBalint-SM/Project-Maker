import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { CURRENT_APP_SCHEMA_VERSION } from "../../domain/model/envelope";
import type { Envelope } from "../../domain/model/envelope";
import { createEmptyProject } from "../../domain/model/factory";
import type { Project, ProjectListItem } from "../../domain/model/types";
import { getStorage } from "../../main";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Walking Skeleton proof-of-life UI (D-03/D-04): a minimal projects list
 * that reads from and writes to the real IndexedDB (via RxDB) through the
 * StoragePort. This is deliberately NOT the real survey/interview UI
 * (Phase 2) — only enough to prove build → domain-model → RxDB
 * persistence → routing → UI end to end.
 *
 * Also hosts the DATA-06 backup/restore UI (D-05): real, visible, clickable
 * "Adatmentés exportálása" / "Visszaállítás" buttons — not just internal
 * StoragePort logic.
 */
export function ProjectListView() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const storage = await getStorage();
      const items = await storage.list();
      setProjects(items);
    } catch (err) {
      setError(`Projektlista betöltése sikertelen: ${errorMessage(err)}`);
    }
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

  async function handleDelete(id: string) {
    const storage = await getStorage();
    await storage.softDelete(id);
    await refresh();
  }

  async function handleExportBackup() {
    setError("");
    setNotice("");
    try {
      const storage = await getStorage();
      const blob = await storage.exportBackup();

      // Same browser-download pattern as the legacy src/lib/export.ts
      // saveExportBlob() — createObjectURL + <a> + click() +
      // revokeObjectURL. No Tauri IPC branch: this app has a single web
      // target now.
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `project-maker-backup-${new Date().toISOString()}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setNotice("Adatmentés exportálva.");
    } catch (err) {
      setError(`Exportálás sikertelen: ${errorMessage(err)}`);
    }
  }

  function handleRestoreClick() {
    fileInputRef.current?.click();
  }

  async function handleRestoreFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    // Reset immediately so selecting the same file again still fires
    // onChange next time.
    event.target.value = "";
    if (!file) return;

    setError("");
    setNotice("");
    try {
      const storage = await getStorage();
      // A File IS a Blob — importBackup() only ever needs Blob.text().
      await storage.importBackup(file);
      await refresh();
      setNotice("Visszaállítás sikeres.");
    } catch (err) {
      setError(`Visszaállítás sikertelen: ${errorMessage(err)}`);
    }
  }

  return (
    <main>
      <h1>Projektek</h1>
      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="notice-banner">{notice}</div>}
      <button type="button" onClick={handleAddTestProject}>
        Új teszt-projekt
      </button>
      <button type="button" onClick={handleExportBackup}>
        Adatmentés exportálása
      </button>
      <button type="button" onClick={handleRestoreClick}>
        Visszaállítás
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={handleRestoreFileChange}
      />
      {projects.length === 0 ? (
        <p>Nincs megjeleníthető projekt.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Projekt neve</th>
              <th>Állapota</th>
              <th>Utolsó módosítás</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>{project.name}</td>
                <td>{project.status}</td>
                <td>{project.updatedAt}</td>
                <td>
                  <button type="button" onClick={() => handleDelete(project.id)}>
                    Törlés
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
