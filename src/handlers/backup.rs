use std::path::Path;

use axum::{
    Json,
    extract::{Extension, State},
    http::{HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use base64::Engine;
use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::handlers::{auth::AuthUser, uploads};
use crate::helpers::{
    access::{db_error, lock_db},
    types::Conn,
};

#[derive(Serialize, Deserialize, Debug)]
pub struct BackupDetail {
    pub name: String,
    pub link: Option<String>,
    pub annotation: Option<String>,
    pub creation_date: String,
    pub position: Option<i32>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct BackupTable {
    pub description: String,
    pub position: Option<i32>,
    pub details: Vec<BackupDetail>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct BackupImage {
    pub filename: String,
    pub data: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct BackupPayload {
    pub version: Option<String>,
    pub export_date: Option<String>,
    pub tables: Vec<BackupTable>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<BackupImage>>,
}

#[derive(Serialize)]
pub struct BackupInfoResponse {
    pub last_backup: Option<String>,
}

#[derive(Serialize)]
pub struct BackupGenerateResponse {
    pub created_at: String,
}

#[derive(Serialize)]
pub struct BackupImportResponse {
    pub status: String,
    pub tables_imported: usize,
}

#[derive(Serialize)]
pub struct BackupErrorResponse {
    pub error: String,
}

type BackupError = Box<dyn std::error::Error + Send + Sync>;

fn collect_tables(
    conn: &rusqlite::Connection,
    user_id: i64,
) -> rusqlite::Result<Vec<BackupTable>> {
    let mut table_stmt = conn.prepare(
        "SELECT id, description, position FROM tables WHERE user_id = ?1 ORDER BY position ASC, id ASC",
    )?;
    let mut detail_stmt = conn.prepare(
        "SELECT name, link, annotation, creation_date, position FROM table_details WHERE table_id = ?1 ORDER BY position ASC, id ASC",
    )?;

    let tables_raw: Vec<(i64, String, Option<i32>)> = table_stmt
        .query_map(params![user_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })?
        .filter_map(Result::ok)
        .collect();

    let mut backup_tables: Vec<BackupTable> = Vec::new();
    for (table_id, description, position) in tables_raw {
        let details: Vec<BackupDetail> = detail_stmt
            .query_map(params![table_id], |row| {
                Ok(BackupDetail {
                    name: row.get(0)?,
                    link: row.get(1)?,
                    annotation: row.get(2)?,
                    creation_date: row.get(3)?,
                    position: row.get(4)?,
                })
            })?
            .filter_map(Result::ok)
            .collect();

        backup_tables.push(BackupTable {
            description,
            position,
            details,
        });
    }

    Ok(backup_tables)
}

fn collect_images(user_id: i64) -> Vec<BackupImage> {
    let Ok(entries) = std::fs::read_dir(uploads::user_uploads_dir(user_id)) else {
        return Vec::new();
    };
    entries
        .flatten()
        .filter(|entry| entry.path().is_file())
        .filter_map(|entry| {
            let filename = entry.file_name().into_string().ok()?;
            if !uploads::is_stored_image_name(&filename) {
                return None;
            }
            let bytes = std::fs::read(entry.path()).ok()?;
            Some(BackupImage {
                filename,
                data: base64::engine::general_purpose::STANDARD.encode(&bytes),
            })
        })
        .collect()
}

fn write_backup_file(user_id: i64, tables: Vec<BackupTable>) -> Result<(String, String), BackupError> {
    let images = collect_images(user_id);
    let created_at = Utc::now().to_rfc3339();
    let payload = BackupPayload {
        version: Some("1.0".to_string()),
        export_date: Some(created_at.clone()),
        tables,
        images: (!images.is_empty()).then_some(images),
    };

    let json_bytes = serde_json::to_vec_pretty(&payload)?;

    let dir_path = format!("backups/{}", user_id);
    std::fs::create_dir_all(&dir_path)?;

    let file_path = format!("{}/backup.json", dir_path);
    let tmp_path = format!("{}/backup.json.tmp", dir_path);
    std::fs::write(&tmp_path, &json_bytes)?;
    std::fs::rename(&tmp_path, &file_path)?;

    Ok((created_at, file_path))
}

pub fn perform_backup_for_user(conn: &Conn, user_id: i64) -> Result<String, BackupError> {
    let tables = {
        let guard = conn.lock().map_err(|_| "Database lock poisoned")?;
        collect_tables(&guard, user_id)?
    };

    let (created_at, file_path) = write_backup_file(user_id, tables)?;

    conn.lock().map_err(|_| "Database lock poisoned")?.execute(
        "
        INSERT INTO backups (user_id, created_at, file_path)
        VALUES (?1, ?2, ?3)
        ON CONFLICT(user_id) DO UPDATE SET
            created_at = excluded.created_at,
            file_path = excluded.file_path
        ",
        params![user_id, created_at, file_path],
    )?;

    Ok(created_at)
}

pub fn backup_all_users(conn: &Conn) {
    let user_ids: Vec<i64> = match conn.lock() {
        Ok(guard) => match guard.prepare("SELECT id FROM users") {
            Ok(mut stmt) => match stmt.query_map([], |row| row.get(0)) {
                Ok(rows) => rows.filter_map(Result::ok).collect(),
                Err(_) => Vec::new(),
            },
            Err(_) => Vec::new(),
        },
        Err(_) => Vec::new(),
    };

    for user_id in user_ids {
        if let Err(err) = perform_backup_for_user(conn, user_id) {
            eprintln!("Error running backup for user {user_id}: {err}");
        }
    }
}

fn backup_record(conn: &Conn, user_id: i64) -> Result<Option<(String, String)>, StatusCode> {
    match lock_db(conn)?.query_row(
        "SELECT created_at, file_path FROM backups WHERE user_id = ?1",
        params![user_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ) {
        Ok(record) => Ok(Some(record)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(err) => Err(db_error("Error reading backup record", err)),
    }
}

fn backup_error(status: StatusCode, message: &str) -> (StatusCode, Json<BackupErrorResponse>) {
    (
        status,
        Json(BackupErrorResponse {
            error: message.to_string(),
        }),
    )
}

pub async fn get_info(
    State(conn): State<Conn>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<BackupInfoResponse>, StatusCode> {
    let last_backup = backup_record(&conn, auth_user.user_id)?
        .filter(|(_, file_path)| Path::new(file_path).exists())
        .map(|(created_at, _)| created_at);

    Ok(Json(BackupInfoResponse { last_backup }))
}

pub async fn generate(
    State(conn): State<Conn>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<(StatusCode, Json<BackupGenerateResponse>), StatusCode> {
    match tokio::task::spawn_blocking(move || perform_backup_for_user(&conn, auth_user.user_id))
        .await
    {
        Ok(Ok(created_at)) => Ok((
            StatusCode::CREATED,
            Json(BackupGenerateResponse { created_at }),
        )),
        _ => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn download(
    State(conn): State<Conn>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Response, (StatusCode, Json<BackupErrorResponse>)> {
    const NO_BACKUP: &str = "No backup available on server. Please generate a backup first.";

    let record = backup_record(&conn, auth_user.user_id)
        .map_err(|status| backup_error(status, "Internal server error"))?;

    let Some((_, file_path)) = record else {
        return Err(backup_error(StatusCode::NOT_FOUND, NO_BACKUP));
    };

    let bytes = match tokio::fs::read(&file_path).await {
        Ok(b) => b,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            return Err(backup_error(StatusCode::NOT_FOUND, NO_BACKUP));
        }
        Err(_) => {
            return Err(backup_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to read backup file",
            ));
        }
    };

    let filename = format!(
        "research_annotations_backup_{}.json",
        Utc::now().format("%Y%m%d_%H%M%S")
    );

    let mut response = bytes.into_response();
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/json"),
    );
    if let Ok(disposition_val) =
        HeaderValue::from_str(&format!("attachment; filename=\"{}\"", filename))
    {
        response
            .headers_mut()
            .insert(header::CONTENT_DISPOSITION, disposition_val);
    }

    Ok(response)
}

fn decode_images(images: Option<Vec<BackupImage>>) -> Result<Vec<(String, Vec<u8>)>, StatusCode> {
    images
        .unwrap_or_default()
        .into_iter()
        .filter(|img| uploads::is_stored_image_name(&img.filename))
        .map(|img| {
            base64::engine::general_purpose::STANDARD
                .decode(&img.data)
                .map(|bytes| (img.filename, bytes))
                .map_err(|_| StatusCode::BAD_REQUEST)
        })
        .collect()
}

fn stage_images(dir: &str, images: &[(String, Vec<u8>)]) -> std::io::Result<()> {
    let _ = std::fs::remove_dir_all(dir);
    std::fs::create_dir_all(dir)?;
    for (filename, bytes) in images {
        std::fs::write(format!("{dir}/{filename}"), bytes)?;
    }
    Ok(())
}

fn swap_in_staged_images(uploads_dir: &str, staged_dir: &str) -> std::io::Result<()> {
    let previous_dir = format!("{uploads_dir}.previous");
    let _ = std::fs::remove_dir_all(&previous_dir);
    match std::fs::rename(uploads_dir, &previous_dir) {
        Ok(()) => {}
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
        Err(err) => return Err(err),
    }
    std::fs::rename(staged_dir, uploads_dir)?;
    let _ = std::fs::remove_dir_all(&previous_dir);
    Ok(())
}

fn replace_user_data(conn: &Conn, user_id: i64, tables: &[BackupTable]) -> Result<usize, StatusCode> {
    let mut conn = lock_db(conn)?;
    let tx = conn
        .transaction()
        .map_err(|err| db_error("Error starting import transaction", err))?;

    tx.execute(
        "DELETE FROM table_details WHERE table_id IN (SELECT id FROM tables WHERE user_id = ?1)",
        params![user_id],
    )
    .map_err(|err| db_error("Error clearing table details", err))?;

    tx.execute("DELETE FROM tables WHERE user_id = ?1", params![user_id])
        .map_err(|err| db_error("Error clearing tables", err))?;

    for (table_index, table) in tables.iter().enumerate() {
        tx.execute(
            "INSERT INTO tables (description, user_id, position) VALUES (?1, ?2, ?3)",
            params![
                table.description,
                user_id,
                table.position.unwrap_or(table_index as i32)
            ],
        )
        .map_err(|err| db_error("Error importing table", err))?;

        let table_id = tx.last_insert_rowid();

        for (detail_index, detail) in table.details.iter().enumerate() {
            let creation_date = if detail.creation_date.trim().is_empty() {
                Utc::now().to_rfc3339()
            } else {
                detail.creation_date.clone()
            };

            tx.execute(
                "INSERT INTO table_details (table_id, annotation, name, link, creation_date, position) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    table_id,
                    detail.annotation,
                    detail.name,
                    detail.link,
                    creation_date,
                    detail.position.unwrap_or(detail_index as i32)
                ],
            )
            .map_err(|err| db_error("Error importing table detail", err))?;
        }
    }

    tx.commit()
        .map_err(|err| db_error("Error committing import", err))?;

    Ok(tables.len())
}

pub async fn import(
    State(conn): State<Conn>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<BackupPayload>,
) -> Result<Json<BackupImportResponse>, StatusCode> {
    let user_id = auth_user.user_id;

    let result = tokio::task::spawn_blocking(move || -> Result<usize, StatusCode> {
        let images = decode_images(payload.images)?;
        let uploads_dir = uploads::user_uploads_dir(user_id);
        let staged_dir = format!("{uploads_dir}.import");

        if !images.is_empty() {
            if let Err(err) = stage_images(&staged_dir, &images) {
                eprintln!("Error staging imported images for user {user_id}: {err}");
                let _ = std::fs::remove_dir_all(&staged_dir);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        }

        let tables_imported = match replace_user_data(&conn, user_id, &payload.tables) {
            Ok(count) => count,
            Err(status) => {
                let _ = std::fs::remove_dir_all(&staged_dir);
                return Err(status);
            }
        };

        if !images.is_empty() {
            if let Err(err) = swap_in_staged_images(&uploads_dir, &staged_dir) {
                eprintln!("Error replacing images for user {user_id}: {err}");
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        }

        if let Err(err) = perform_backup_for_user(&conn, user_id) {
            eprintln!("Error running backup after import for user {user_id}: {err}");
        }

        Ok(tables_imported)
    })
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(BackupImportResponse {
        status: "success".to_string(),
        tables_imported: result?,
    }))
}
