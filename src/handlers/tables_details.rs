use axum::{
    Json,
    extract::{Extension, Path, State},
    http::StatusCode,
};

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::handlers::auth::AuthUser;
use crate::helpers::{
    access::{db_error, decrypt_id, encrypt_id, ensure_table_owner, lock_db},
    types::Conn,
};

#[derive(Serialize, Deserialize, Debug)]
pub struct TableDetailsReturn {
    pub id: String,
    pub table_id: String,
    pub annotation: Option<String>,
    pub name: String,
    pub link: Option<String>,
    pub position: Option<i32>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct TableDetailsCheck {
    pub count: i64,
    pub max_id: i64,
}

#[derive(Deserialize, Debug)]
pub struct TableDetails {
    pub id: Option<String>,
    pub table_id: Option<String>,
    pub annotation: Option<String>,
    pub name: String,
    pub link: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct DeleteTableDetailsPayload {
    pub id: Option<String>,
    pub ids: Option<Vec<String>>,
}

#[derive(Deserialize, Debug)]
pub struct ReorderTableDetailsPayload {
    pub table_id: String,
    pub ids: Vec<String>,
}

const OWNED_BY_USER: &str = "table_id IN (SELECT id FROM tables WHERE user_id = ?)";

#[axum::debug_handler]
pub async fn check_status(
    State(conn): State<Conn>,
    Extension(auth_user): Extension<AuthUser>,
    Path(table_id): Path<String>,
) -> Result<Json<TableDetailsCheck>, StatusCode> {
    let table_id = decrypt_id(table_id)?;
    let conn = lock_db(&conn)?;
    ensure_table_owner(&conn, table_id, auth_user.user_id)?;

    let (count, max_id) = conn
        .query_row(
            "
            SELECT COUNT(*), COALESCE(MAX(id), 0)
            FROM table_details
            WHERE table_id = ?1
        ",
            params![table_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|err| db_error("Error checking table_details", err))?;

    Ok(Json(TableDetailsCheck { count, max_id }))
}

#[axum::debug_handler]
pub async fn get(
    State(conn): State<Conn>,
    Extension(auth_user): Extension<AuthUser>,
    Path(table_id): Path<String>,
) -> Result<Json<Vec<TableDetailsReturn>>, StatusCode> {
    let table_id = decrypt_id(table_id)?;
    let conn = lock_db(&conn)?;
    ensure_table_owner(&conn, table_id, auth_user.user_id)?;

    let mut stmt = conn
        .prepare(
            "
            SELECT id, annotation, name, link, position
            FROM table_details
            WHERE table_id = ?1
            ORDER BY position ASC, id ASC
        ",
        )
        .map_err(|err| db_error("Error on prepare select table_details", err))?;

    let rows = stmt
        .query_map(params![table_id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<i32>>(4)?,
            ))
        })
        .map_err(|err| db_error("Error querying table_details", err))?;

    let table_id_encrypted = encrypt_id(table_id)?;
    let mut details = Vec::new();
    for row in rows {
        let (id, annotation, name, link, position) =
            row.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        details.push(TableDetailsReturn {
            id: encrypt_id(id)?,
            table_id: table_id_encrypted.clone(),
            annotation,
            name,
            link,
            position,
        });
    }

    Ok(Json(details))
}

#[axum::debug_handler]
pub async fn post(
    State(conn): State<Conn>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<TableDetails>,
) -> Result<(StatusCode, Json<TableDetailsReturn>), StatusCode> {
    let table_id = decrypt_id(payload.table_id.ok_or(StatusCode::BAD_REQUEST)?)?;
    let conn = lock_db(&conn)?;
    ensure_table_owner(&conn, table_id, auth_user.user_id)?;

    let next_position: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(position), 0) + 1 FROM table_details WHERE table_id = ?1",
            params![table_id],
            |row| row.get(0),
        )
        .unwrap_or(1);

    let (id, returned_position) = conn
        .query_row(
            "
            INSERT INTO table_details (table_id, annotation, name, link, creation_date, position)
            VALUES (?1, ?2, ?3, ?4, datetime('now'), ?5)
            RETURNING id, position
        ",
            params![
                table_id,
                payload.annotation,
                payload.name,
                payload.link,
                next_position
            ],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i32>(1)?)),
        )
        .map_err(|err| db_error("Error on insert table_details", err))?;

    Ok((
        StatusCode::CREATED,
        Json(TableDetailsReturn {
            id: encrypt_id(id)?,
            table_id: encrypt_id(table_id)?,
            annotation: payload.annotation,
            name: payload.name,
            link: payload.link,
            position: Some(returned_position),
        }),
    ))
}

#[axum::debug_handler]
pub async fn put(
    State(conn): State<Conn>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<TableDetails>,
) -> Result<StatusCode, StatusCode> {
    let id = decrypt_id(payload.id.ok_or(StatusCode::BAD_REQUEST)?)?;

    match lock_db(&conn)?.execute(
        &format!(
            "UPDATE table_details SET annotation = ?, name = ?, link = ? WHERE id = ? AND {OWNED_BY_USER}"
        ),
        params![
            payload.annotation,
            payload.name,
            payload.link,
            id,
            auth_user.user_id
        ],
    ) {
        Ok(0) => Err(StatusCode::NOT_FOUND),
        Ok(_) => Ok(StatusCode::OK),
        Err(err) => Err(db_error("Error on update table_details", err)),
    }
}

#[axum::debug_handler]
pub async fn reorder(
    State(conn): State<Conn>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<ReorderTableDetailsPayload>,
) -> Result<StatusCode, StatusCode> {
    let table_id = decrypt_id(payload.table_id)?;
    let ids = payload
        .ids
        .into_iter()
        .map(decrypt_id)
        .collect::<Result<Vec<i64>, StatusCode>>()?;

    let mut conn = lock_db(&conn)?;
    ensure_table_owner(&conn, table_id, auth_user.user_id)?;

    let tx = conn
        .transaction()
        .map_err(|err| db_error("Error starting transaction for reorder", err))?;

    for (index, id) in ids.iter().enumerate() {
        tx.execute(
            "UPDATE table_details SET position = ?1 WHERE id = ?2 AND table_id = ?3",
            params![(index + 1) as i32, id, table_id],
        )
        .map_err(|err| db_error(&format!("Error updating position for id {id}"), err))?;
    }

    tx.commit()
        .map_err(|err| db_error("Error committing reorder transaction", err))?;

    Ok(StatusCode::OK)
}

#[axum::debug_handler]
pub async fn delete(
    State(conn): State<Conn>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<DeleteTableDetailsPayload>,
) -> Result<StatusCode, StatusCode> {
    let ids = payload
        .id
        .into_iter()
        .chain(payload.ids.unwrap_or_default())
        .map(decrypt_id)
        .collect::<Result<Vec<i64>, StatusCode>>()?;

    if ids.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let mut conn = lock_db(&conn)?;
    let tx = conn
        .transaction()
        .map_err(|err| db_error("Error starting transaction", err))?;

    for id in ids {
        tx.execute(
            &format!("DELETE FROM table_details WHERE id = ? AND {OWNED_BY_USER}"),
            params![id, auth_user.user_id],
        )
        .map_err(|err| db_error(&format!("Error deleting table_details id {id}"), err))?;
    }

    tx.commit()
        .map_err(|err| db_error("Error committing delete transaction", err))?;

    Ok(StatusCode::OK)
}
