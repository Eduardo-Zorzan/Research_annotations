use std::path::Path;

use axum::{
    Json,
    extract::{Extension, State},
    http::{HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::handlers::auth::AuthUser;
use crate::helpers;

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
pub struct BackupPayload {
    pub version: Option<String>,
    pub export_date: Option<String>,
    pub tables: Vec<BackupTable>,
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

pub fn perform_backup_for_user(
    conn: &rusqlite::Connection,
    user_id: i64,
) -> Result<(String, String), Box<dyn std::error::Error + Send + Sync>> {
    let mut table_stmt = conn.prepare(
        "SELECT id, description, position FROM tables WHERE user_id = ?1 ORDER BY position ASC, id ASC",
    )?;

    let tables_raw: Vec<(i64, String, Option<i32>)> = table_stmt
        .query_map(params![user_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })?
        .filter_map(Result::ok)
        .collect();

    let mut backup_tables: Vec<BackupTable> = Vec::new();

    for (table_id, description, position) in tables_raw {
        let mut detail_stmt = conn.prepare(
            "SELECT name, link, annotation, creation_date, position FROM table_details WHERE table_id = ?1 ORDER BY position ASC, id ASC",
        )?;

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

    let created_at = Utc::now().to_rfc3339();
    let payload = BackupPayload {
        version: Some("1.0".to_string()),
        export_date: Some(created_at.clone()),
        tables: backup_tables,
    };

    let json_bytes = serde_json::to_vec_pretty(&payload)?;

    let dir_path = format!("backups/{}", user_id);
    std::fs::create_dir_all(&dir_path)?;

    let file_path = format!("{}/backup.json", dir_path);
    std::fs::write(&file_path, &json_bytes)?;

    conn.execute(
        "
        INSERT INTO backups (user_id, created_at, file_path)
        VALUES (?1, ?2, ?3)
        ON CONFLICT(user_id) DO UPDATE SET
            created_at = excluded.created_at,
            file_path = excluded.file_path
        ",
        params![user_id, created_at, file_path],
    )?;

    Ok((created_at, file_path))
}

pub async fn get_info(
    State(conn): State<helpers::types::Conn>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<BackupInfoResponse>, StatusCode> {
    let Ok(_conn) = conn.lock() else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };

    let mut stmt = match _conn.prepare(
        "SELECT created_at, file_path FROM backups WHERE user_id = ?1",
    ) {
        Ok(s) => s,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let record: Option<(String, String)> = stmt
        .query_row(params![auth_user.user_id], |row| Ok((row.get(0)?, row.get(1)?)))
        .ok();

    if let Some((created_at, file_path)) = record {
        if Path::new(&file_path).exists() {
            return Ok(Json(BackupInfoResponse {
                last_backup: Some(created_at),
            }));
        }
    }

    Ok(Json(BackupInfoResponse { last_backup: None }))
}

pub async fn generate(
    State(conn): State<helpers::types::Conn>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<(StatusCode, Json<BackupGenerateResponse>), StatusCode> {
    let Ok(_conn) = conn.lock() else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };

    match perform_backup_for_user(&_conn, auth_user.user_id) {
        Ok((created_at, _)) => Ok((
            StatusCode::CREATED,
            Json(BackupGenerateResponse { created_at }),
        )),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn download(
    State(conn): State<helpers::types::Conn>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Response, (StatusCode, Json<BackupErrorResponse>)> {
    let Ok(_conn) = conn.lock() else {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(BackupErrorResponse {
                error: "Internal server error".to_string(),
            }),
        ));
    };

    let mut stmt = match _conn.prepare(
        "SELECT file_path, created_at FROM backups WHERE user_id = ?1",
    ) {
        Ok(s) => s,
        Err(_) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(BackupErrorResponse {
                    error: "Internal server error".to_string(),
                }),
            ));
        }
    };

    let record: Option<(String, String)> = stmt
        .query_row(params![auth_user.user_id], |row| Ok((row.get(0)?, row.get(1)?)))
        .ok();

    let Some((file_path, _)) = record else {
        return Err((
            StatusCode::NOT_FOUND,
            Json(BackupErrorResponse {
                error: "No backup available on server. Please generate a backup first.".to_string(),
            }),
        ));
    };

    if !Path::new(&file_path).exists() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(BackupErrorResponse {
                error: "No backup available on server. Please generate a backup first.".to_string(),
            }),
        ));
    }

    let bytes = match std::fs::read(&file_path) {
        Ok(b) => b,
        Err(_) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(BackupErrorResponse {
                    error: "Failed to read backup file".to_string(),
                }),
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

pub async fn import(
    State(conn): State<helpers::types::Conn>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<BackupPayload>,
) -> Result<Json<BackupImportResponse>, StatusCode> {
    let Ok(mut _conn) = conn.lock() else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };

    let tx = match _conn.transaction() {
        Ok(t) => t,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    if let Err(_) = tx.execute(
        "DELETE FROM table_details WHERE table_id IN (SELECT id FROM tables WHERE user_id = ?1)",
        params![auth_user.user_id],
    ) {

        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    if let Err(_) = tx.execute(
        "DELETE FROM tables WHERE user_id = ?1",
        params![auth_user.user_id],
    ) {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    let mut tables_count = 0;

    for table in &payload.tables {
        let table_position = table.position.unwrap_or(tables_count as i32);
        if let Err(_) = tx.execute(
            "INSERT INTO tables (description, user_id, position) VALUES (?1, ?2, ?3)",
            params![table.description, auth_user.user_id, table_position],
        ) {
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }


        let table_id = tx.last_insert_rowid();
        tables_count += 1;

        let mut detail_index = 0;
        for detail in &table.details {
            let detail_position = detail.position.unwrap_or(detail_index as i32);
            let creation_date = if detail.creation_date.trim().is_empty() {
                Utc::now().to_rfc3339()
            } else {
                detail.creation_date.clone()
            };

            if let Err(_) = tx.execute(
                "INSERT INTO table_details (table_id, annotation, name, link, creation_date, position) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    table_id,
                    detail.annotation,
                    detail.name,
                    detail.link,
                    creation_date,
                    detail_position
                ],
            ) {
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
            detail_index += 1;
        }
    }

    if let Err(_) = tx.commit() {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    let _ = perform_backup_for_user(&_conn, auth_user.user_id);

    Ok(Json(BackupImportResponse {
        status: "success".to_string(),
        tables_imported: tables_count,
    }))
}
