use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::helpers;

#[derive(Serialize)]
pub struct TableReturn {
    id: i32,
    description: String,
}

#[derive(Deserialize)]
pub struct Table {
    id: i32,
    description: String,
    user_id: i32,
}

#[axum::debug_handler]
pub async fn get(
    State(conn): State<helpers::types::Conn>,
    Path(id): Path<i32>,
) -> Json<Vec<TableReturn>> {
    let _conn = conn.lock().unwrap();

    let mut stmt = _conn
        .prepare(
            "
                SELECT id, description
                FROM tables
                WHERE user_id = ?1
            ",
        )
        .unwrap();
    let tables: Vec<TableReturn> = stmt
        .query_map(params![id], |row| {
            Ok(TableReturn {
                id: row.get(0)?,
                description: row.get(1)?,
            })
        })
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();

    Json(tables)
}

#[axum::debug_handler]
pub async fn post(
    State(conn): State<helpers::types::Conn>,
    Json(payload): Json<Table>,
) -> Result<StatusCode, StatusCode> {
    let Ok(_conn) = conn.lock() else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };

    match _conn.execute(
        "
            INSERT INTO tables
            (description, user_id)
            VALUES (?1, ?2)
        ",
        params![payload.description, payload.user_id],
    ) {
        Ok(_) => Ok(StatusCode::OK),
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
