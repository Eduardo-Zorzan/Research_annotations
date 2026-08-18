use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::helpers;

#[derive(Serialize, Deserialize, Debug)]
pub struct TableDetailsReturn {
    pub id: i32,
    pub table_id: i32,
    pub annotation: Option<String>,
    pub name: String,
    pub link: Option<String>,
    pub position: Option<i32>,
}

#[derive(Deserialize, Debug)]
pub struct TableDetails {
    pub id: Option<i32>,
    pub table_id: i32,
    pub annotation: Option<String>,
    pub name: String,
    pub link: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct DeleteTableDetailsPayload {
    pub id: Option<i32>,
    pub ids: Option<Vec<i32>>,
}

#[derive(Deserialize, Debug)]
pub struct ReorderTableDetailsPayload {
    pub table_id: i32,
    pub ids: Vec<i32>,
}

#[axum::debug_handler]
pub async fn get(
    State(conn): State<helpers::types::Conn>,
    Path(table_id): Path<i32>,
) -> Json<Vec<TableDetailsReturn>> {
    let Ok(_conn) = conn.lock() else {
        return Json(vec![]);
    };

    let mut stmt = match _conn.prepare(
        "
            SELECT id, table_id, annotation, name, link, position
            FROM table_details
            WHERE table_id = ?1
            ORDER BY position ASC, id ASC
        ",
    ) {
        Ok(stmt) => stmt,
        Err(err) => {
            println!("Error on prepare select table_details: {}", err);
            return Json(vec![]);
        }
    };

    let details: Vec<TableDetailsReturn> = stmt
        .query_map(params![table_id], |row| {
            Ok(TableDetailsReturn {
                id: row.get(0)?,
                table_id: row.get(1)?,
                annotation: row.get(2)?,
                name: row.get(3)?,
                link: row.get(4)?,
                position: row.get(5)?,
            })
        })
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap_or_default();

    Json(details)
}

#[axum::debug_handler]
pub async fn post(
    State(conn): State<helpers::types::Conn>,
    Json(payload): Json<TableDetails>,
) -> Result<(StatusCode, Json<TableDetailsReturn>), StatusCode> {
    let Ok(_conn) = conn.lock() else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };

    let next_position: i32 = _conn
        .query_row(
            "SELECT COALESCE(MAX(position), 0) + 1 FROM table_details WHERE table_id = ?1",
            params![payload.table_id],
            |row| row.get(0),
        )
        .unwrap_or(1);

    match _conn.query_row(
        "
            INSERT INTO table_details (table_id, annotation, name, link, creation_date, position)
            VALUES (?1, ?2, ?3, ?4, datetime('now'), ?5)
            RETURNING id, position
        ",
        params![
            payload.table_id,
            payload.annotation,
            payload.name,
            payload.link,
            next_position
        ],
        |row| Ok((row.get::<_, i32>(0)?, row.get::<_, i32>(1)?)),
    ) {
        Ok((id, returned_position)) => Ok((
            StatusCode::CREATED,
            Json(TableDetailsReturn {
                id,
                table_id: payload.table_id,
                annotation: payload.annotation,
                name: payload.name,
                link: payload.link,
                position: Some(returned_position),
            }),
        )),
        Err(_err) => {
            println!("Error on insert table_details, error: {}", _err);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[axum::debug_handler]
pub async fn put(
    State(conn): State<helpers::types::Conn>,
    Json(payload): Json<TableDetails>,
) -> Result<StatusCode, StatusCode> {
    let Ok(_conn) = conn.lock() else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };

    let Some(id) = payload.id else {
        return Err(StatusCode::BAD_REQUEST);
    };

    match _conn.execute(
        "
            UPDATE table_details
            SET annotation = ?1, name = ?2, link = ?3
            WHERE id = ?4
        ",
        params![payload.annotation, payload.name, payload.link, id],
    ) {
        Ok(0) => Err(StatusCode::NOT_FOUND),
        Ok(_) => Ok(StatusCode::OK),
        Err(_err) => {
            println!("Error on update table_details, error: {}", _err);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[axum::debug_handler]
pub async fn reorder(
    State(conn): State<helpers::types::Conn>,
    Json(payload): Json<ReorderTableDetailsPayload>,
) -> Result<StatusCode, StatusCode> {
    let Ok(mut _conn) = conn.lock() else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };

    let tx = match _conn.transaction() {
        Ok(tx) => tx,
        Err(err) => {
            println!("Error starting transaction for reorder: {}", err);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    for (index, id) in payload.ids.iter().enumerate() {
        let pos = (index + 1) as i32;
        if let Err(err) = tx.execute(
            "UPDATE table_details SET position = ?1 WHERE id = ?2 AND table_id = ?3",
            params![pos, id, payload.table_id],
        ) {
            println!("Error updating position for id {}: {}", id, err);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    if let Err(err) = tx.commit() {
        println!("Error committing reorder transaction: {}", err);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    Ok(StatusCode::OK)
}

#[axum::debug_handler]
pub async fn delete(
    State(conn): State<helpers::types::Conn>,
    Json(payload): Json<DeleteTableDetailsPayload>,
) -> Result<StatusCode, StatusCode> {
    let Ok(mut _conn) = conn.lock() else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };

    let mut ids_to_delete: Vec<i32> = Vec::new();
    if let Some(id) = payload.id {
        ids_to_delete.push(id);
    }
    if let Some(ids) = payload.ids {
        ids_to_delete.extend(ids);
    }

    if ids_to_delete.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let tx = match _conn.transaction() {
        Ok(tx) => tx,
        Err(err) => {
            println!("Error starting transaction: {}", err);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    for id in ids_to_delete {
        if let Err(err) = tx.execute("DELETE FROM table_details WHERE id = ?1", params![id]) {
            println!("Error deleting table_details id {}: {}", id, err);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    if let Err(err) = tx.commit() {
        println!("Error committing delete transaction: {}", err);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    Ok(StatusCode::OK)
}
