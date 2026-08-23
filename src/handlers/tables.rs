use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::helpers;

#[derive(Serialize, Deserialize, Debug)]
pub struct TableReturn {
    pub id: i32,
    pub description: String,
    pub position: Option<i32>,
}

#[derive(Deserialize)]
pub struct Table {
    pub id: i32,
    pub description: String,
    pub user_id: i32,
}

#[derive(Deserialize, Debug)]
pub struct ReorderTablesPayload {
    pub ids: Vec<i32>,
}

#[axum::debug_handler]
pub async fn get(
    State(conn): State<helpers::types::Conn>,
    Path(id): Path<i32>,
) -> Json<Vec<TableReturn>> {
    let Ok(_conn) = conn.lock() else {
        return Json(vec![]);
    };

    let mut stmt = match _conn.prepare(
        "
            SELECT id, description, position
            FROM tables
            WHERE user_id = ?1
            ORDER BY position ASC, id ASC
        ",
    ) {
        Ok(stmt) => stmt,
        Err(err) => {
            println!("Error on prepare select tables: {}", err);
            return Json(vec![]);
        }
    };

    let tables: Vec<TableReturn> = stmt
        .query_map(params![id], |row| {
            Ok(TableReturn {
                id: row.get(0)?,
                description: row.get(1)?,
                position: row.get(2)?,
            })
        })
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap_or_default();

    Json(tables)
}

#[axum::debug_handler]
pub async fn post(
    State(conn): State<helpers::types::Conn>,
    Json(payload): Json<Table>,
) -> Result<(StatusCode, Json<TableReturn>), StatusCode> {
    let Ok(_conn) = conn.lock() else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };

    let next_position: i32 = _conn
        .query_row(
            "SELECT COALESCE(MAX(position), 0) + 1 FROM tables WHERE user_id = ?1",
            params![payload.user_id],
            |row| row.get(0),
        )
        .unwrap_or(1);

    match _conn.query_row(
        "
            INSERT INTO tables (description, user_id, position)
            VALUES (?1, ?2, ?3)
            RETURNING id, position
        ",
        params![payload.description, payload.user_id, next_position],
        |row| Ok((row.get::<_, i32>(0)?, row.get::<_, i32>(1)?)),
    ) {
        Ok((id, pos)) => Ok((
            StatusCode::CREATED,
            Json(TableReturn {
                id,
                description: payload.description,
                position: Some(pos),
            }),
        )),
        Err(_err) => {
            println!("Error on insert table, error: {}", _err);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[axum::debug_handler]
pub async fn put(
    State(conn): State<helpers::types::Conn>,
    Json(payload): Json<Table>,
) -> Result<StatusCode, StatusCode> {
    let Ok(_conn) = conn.lock() else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };
    match _conn.execute(
        "
                UPDATE tables
                SET description = ?1
                WHERE id = ?2
            ",
        params![payload.description, payload.id],
    ) {
        Ok(0) => Err(StatusCode::NOT_FOUND),
        Ok(_) => Ok(StatusCode::OK),
        Err(_err) => {
            println!("Error on update table, error: {}", _err);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[axum::debug_handler]
pub async fn reorder(
    State(conn): State<helpers::types::Conn>,
    Json(payload): Json<ReorderTablesPayload>,
) -> Result<StatusCode, StatusCode> {
    let Ok(mut _conn) = conn.lock() else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };

    let tx = match _conn.transaction() {
        Ok(tx) => tx,
        Err(err) => {
            println!("Error starting transaction for table reorder: {}", err);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    for (index, id) in payload.ids.iter().enumerate() {
        let pos = (index + 1) as i32;
        if let Err(err) = tx.execute(
            "UPDATE tables SET position = ?1 WHERE id = ?2",
            params![pos, id],
        ) {
            println!("Error updating position for table id {}: {}", id, err);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    if let Err(err) = tx.commit() {
        println!("Error committing table reorder transaction: {}", err);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    Ok(StatusCode::OK)
}

#[axum::debug_handler]
pub async fn delete(
    State(conn): State<helpers::types::Conn>,
    Json(payload): Json<Table>,
) -> Result<StatusCode, StatusCode> {
    let Ok(_conn) = conn.lock() else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };

    match _conn.execute(
        "
            DELETE FROM tables
            WHERE id = ?1;
        ",
        params![payload.id],
    ) {
        Ok(_) => Ok(StatusCode::OK),
        Err(_err) => {
            println!("Error on delete table, error: {}", _err);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
