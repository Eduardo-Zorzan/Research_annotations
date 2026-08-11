use axum::{
    Json,
    extract::{Path, State},
};

use rusqlite::params;
use serde::Serialize;

use crate::helpers;

#[derive(Serialize)]
pub struct Table {
    id: i32,
    description: String,
}

#[axum::debug_handler]
pub async fn get_tables(
    State(conn): State<helpers::types::Conn>,
    Path(id): Path<i32>,
) -> Json<Vec<Table>> {
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
    let tables: Vec<Table> = stmt
        .query_map(params![id], |row| {
            Ok(Table {
                id: row.get(0)?,
                description: row.get(1)?,
            })
        })
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();

    Json(tables)
}
