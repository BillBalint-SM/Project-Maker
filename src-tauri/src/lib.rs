use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StorageInfo {
    mode: String,
    database_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectRecord {
    id: String,
    data: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectRecordInput {
    id: String,
    name: String,
    status: String,
    priority: String,
    deadline: String,
    completion_state: String,
    completion_percent: i64,
    archived_at: Option<String>,
    updated_at: String,
    data: String,
}

fn database_path() -> Result<PathBuf, String> {
    let exe_path = std::env::current_exe()
        .map_err(|error| format!("Nem található az alkalmazás futtatási útvonala: {error}"))?;
    let app_dir = exe_path
        .parent()
        .ok_or_else(|| "Nem határozható meg az alkalmazás mappája.".to_string())?;
    let data_dir = app_dir.join("data");

    fs::create_dir_all(&data_dir)
        .map_err(|error| format!("Nem hozható létre a data mappa: {error}"))?;

    Ok(data_dir.join("project-maker.db"))
}

fn app_directory() -> Result<PathBuf, String> {
    let exe_path = std::env::current_exe()
        .map_err(|error| format!("Nem található az alkalmazás futtatási útvonala: {error}"))?;
    exe_path
        .parent()
        .map(PathBuf::from)
        .ok_or_else(|| "Nem határozható meg az alkalmazás mappája.".to_string())
}

fn sanitize_file_name(file_name: &str) -> String {
    let sanitized = file_name
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => character,
        })
        .collect::<String>()
        .trim()
        .trim_matches('.')
        .to_string();

    if sanitized.is_empty() {
        "project-maker-export".to_string()
    } else {
        sanitized
    }
}

fn open_database() -> Result<Connection, String> {
    let path = database_path()?;
    let connection = Connection::open(path)
        .map_err(|error| format!("Nem nyitható meg a projekt adatbázis: {error}"))?;

    connection
        .execute(
            "
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                status TEXT NOT NULL,
                priority TEXT NOT NULL,
                deadline TEXT NOT NULL,
                completion_state TEXT NOT NULL,
                completion_percent INTEGER NOT NULL,
                archived_at TEXT,
                updated_at TEXT NOT NULL,
                data TEXT NOT NULL
            )
            ",
            [],
        )
        .map_err(|error| format!("Nem hozható létre a projekt tábla: {error}"))?;

    Ok(connection)
}

#[tauri::command]
fn save_export_file(file_name: String, bytes: Vec<u8>) -> Result<String, String> {
    let exports_dir = app_directory()?.join("exports");
    fs::create_dir_all(&exports_dir)
        .map_err(|error| format!("Nem hozható létre az exports mappa: {error}"))?;

    let path = exports_dir.join(sanitize_file_name(&file_name));
    fs::write(&path, bytes).map_err(|error| format!("Nem menthető az export fájl: {error}"))?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn project_storage_info() -> Result<StorageInfo, String> {
    open_database()?;
    let path = database_path()?;

    Ok(StorageInfo {
        mode: "SQLite".to_string(),
        database_path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn list_projects_native(archived: bool) -> Result<Vec<ProjectRecord>, String> {
    let connection = open_database()?;
    let sql = if archived {
        "SELECT id, data FROM projects WHERE archived_at IS NOT NULL ORDER BY updated_at DESC"
    } else {
        "SELECT id, data FROM projects WHERE archived_at IS NULL ORDER BY updated_at DESC"
    };

    let mut statement = connection
        .prepare(sql)
        .map_err(|error| format!("Nem olvasható a projektlista: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(ProjectRecord {
                id: row.get(0)?,
                data: row.get(1)?,
            })
        })
        .map_err(|error| format!("Nem olvasható a projektlista: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Nem dolgozható fel a projektlista: {error}"))
}

#[tauri::command]
fn get_project_native(id: String) -> Result<Option<ProjectRecord>, String> {
    let connection = open_database()?;
    let mut statement = connection
        .prepare("SELECT id, data FROM projects WHERE id = ?1 LIMIT 1")
        .map_err(|error| format!("Nem olvasható a projekt: {error}"))?;
    let mut rows = statement
        .query_map(params![id], |row| {
            Ok(ProjectRecord {
                id: row.get(0)?,
                data: row.get(1)?,
            })
        })
        .map_err(|error| format!("Nem olvasható a projekt: {error}"))?;

    rows.next()
        .transpose()
        .map_err(|error| format!("Nem dolgozható fel a projekt: {error}"))
}

#[tauri::command]
fn save_project_native(record: ProjectRecordInput) -> Result<(), String> {
    let connection = open_database()?;

    connection
        .execute(
            "
            INSERT INTO projects (
                id,
                name,
                status,
                priority,
                deadline,
                completion_state,
                completion_percent,
                archived_at,
                updated_at,
                data
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                status = excluded.status,
                priority = excluded.priority,
                deadline = excluded.deadline,
                completion_state = excluded.completion_state,
                completion_percent = excluded.completion_percent,
                archived_at = excluded.archived_at,
                updated_at = excluded.updated_at,
                data = excluded.data
            ",
            params![
                record.id,
                record.name,
                record.status,
                record.priority,
                record.deadline,
                record.completion_state,
                record.completion_percent,
                record.archived_at,
                record.updated_at,
                record.data
            ],
        )
        .map_err(|error| format!("Nem menthető a projekt: {error}"))?;

    Ok(())
}

#[tauri::command]
fn delete_project_native(id: String) -> Result<(), String> {
    let connection = open_database()?;
    connection
        .execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map_err(|error| format!("Nem törölhető a projekt: {error}"))?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            save_export_file,
            project_storage_info,
            list_projects_native,
            get_project_native,
            save_project_native,
            delete_project_native
        ])
        .run(tauri::generate_context!())
        .expect("error while running Project Maker");
}
