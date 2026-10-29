use axum::{
    Json,
    extract::{Extension, State},
    http::StatusCode,
};

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::handlers::auth::AuthUser;
use crate::helpers::{
    access::{db_error, decrypt_id, encrypt_id, lock_db},
    types::Conn,
};

#[derive(Serialize, Deserialize, Debug)]
pub struct TableReturn {
    pub id: String,
    pub description: String,
    pub position: Option<i32>,
}

#[derive(Deserialize)]
pub struct Table {
    pub id: Option<String>,
    pub description: String,
}

#[derive(Deserialize, Debug)]
pub struct ReorderTablesPayload {
    pub ids: Vec<String>,
}

#[axum::debug_handler]
pub async fn get(
    State(conn): State<Conn>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<TableReturn>>, StatusCode> {
    let conn = lock_db(&conn)?;

    let mut stmt = conn
        .prepare(
            "
            SELECT id, description, position
            FROM tables
            WHERE user_id = ?1
            ORDER BY position ASC, id ASC
        ",
        )
        .map_err(|err| db_error("Error on prepare select tables", err))?;

    let rows = stmt
        .query_map(params![auth_user.user_id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<i32>>(2)?,
            ))
        })
        .map_err(|err| db_error("Error querying tables", err))?;

    let mut tables = Vec::new();
    for row in rows {
        let (id, description, position) = row.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        tables.push(TableReturn {
            id: encrypt_id(id)?,
            description,
            position,
        });
    }

    Ok(Json(tables))
}

#[axum::debug_handler]
pub async fn post(
    State(conn): State<Conn>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<Table>,
) -> Result<(StatusCode, Json<TableReturn>), StatusCode> {
    let conn = lock_db(&conn)?;

    let next_position: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(position), 0) + 1 FROM tables WHERE user_id = ?1",
            params![auth_user.user_id],
            |row| row.get(0),
        )
        .unwrap_or(1);

    let (id, pos) = conn
        .query_row(
            "
            INSERT INTO tables (description, user_id, position)
            VALUES (?1, ?2, ?3)
            RETURNING id, position
        ",
            params![payload.description, auth_user.user_id, next_position],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i32>(1)?)),
        )
        .map_err(|err| db_error("Error on insert table", err))?;

    Ok((
        StatusCode::CREATED,
        Json(TableReturn {
            id: encrypt_id(id)?,
            description: payload.description,
            position: Some(pos),
        }),
    ))
}

#[axum::debug_handler]
pub async fn put(
    State(conn): State<Conn>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<Table>,
) -> Result<StatusCode, StatusCode> {
    let id = decrypt_id(payload.id.ok_or(StatusCode::BAD_REQUEST)?)?;

    match lock_db(&conn)?.execute(
        "UPDATE tables SET description = ?1 WHERE id = ?2 AND user_id = ?3",
        params![payload.description, id, auth_user.user_id],
    ) {
        Ok(0) => Err(StatusCode::NOT_FOUND),
        Ok(_) => Ok(StatusCode::OK),
        Err(err) => Err(db_error("Error on update table", err)),
    }
}

#[axum::debug_handler]
pub async fn reorder(
    State(conn): State<Conn>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<ReorderTablesPayload>,
) -> Result<StatusCode, StatusCode> {
    let ids = payload
        .ids
        .into_iter()
        .map(decrypt_id)
        .collect::<Result<Vec<i64>, StatusCode>>()?;

    let mut conn = lock_db(&conn)?;
    let tx = conn
        .transaction()
        .map_err(|err| db_error("Error starting transaction for table reorder", err))?;

    for (index, id) in ids.iter().enumerate() {
        tx.execute(
            "UPDATE tables SET position = ?1 WHERE id = ?2 AND user_id = ?3",
            params![(index + 1) as i32, id, auth_user.user_id],
        )
        .map_err(|err| db_error(&format!("Error updating position for table id {id}"), err))?;
    }

    tx.commit()
        .map_err(|err| db_error("Error committing table reorder transaction", err))?;

    Ok(StatusCode::OK)
}

#[axum::debug_handler]
pub async fn delete(
    State(conn): State<Conn>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<Table>,
) -> Result<StatusCode, StatusCode> {
    let id = decrypt_id(payload.id.ok_or(StatusCode::BAD_REQUEST)?)?;

    match lock_db(&conn)?.execute(
        "DELETE FROM tables WHERE id = ?1 AND user_id = ?2",
        params![id, auth_user.user_id],
    ) {
        Ok(0) => Err(StatusCode::NOT_FOUND),
        Ok(_) => Ok(StatusCode::OK),
        Err(err) => Err(db_error("Error on delete table", err)),
    }
}
