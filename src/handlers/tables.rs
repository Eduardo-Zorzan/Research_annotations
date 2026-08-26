use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::helpers::{self, encryption::CryptoService};

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
    pub user_id: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct ReorderTablesPayload {
    pub ids: Vec<String>,
}

#[axum::debug_handler]
pub async fn get(
    State(conn): State<helpers::types::Conn>,
    Path(user_id): Path<String>,
) -> Result<Json<Vec<TableReturn>>, StatusCode> {
    let Ok(_conn) = conn.lock() else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };

    let crypto_service = match CryptoService::new(helpers::encryption::Keys::Token) {
        Ok(crypto) => crypto,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let user_id_decrypted: String = match crypto_service.decrypt(user_id) {
        Ok(user_id) => user_id,
        Err(_) => return Err(StatusCode::FORBIDDEN),
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
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let rows = match stmt.query_map(params![user_id_decrypted], |row| {
        Ok((
            row.get::<_, i32>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<i32>>(2)?,
        ))
    }) {
        Ok(rows) => rows,
        Err(err) => {
            println!("Error querying tables: {}", err);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let mut tables = Vec::new();
    for row in rows {
        let (id, description, position) = match row {
            Ok(data) => data,
            Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
        };
        let id_encrypted = match crypto_service.encrypt(id.to_string()) {
            Ok(enc) => enc,
            Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
        };
        tables.push(TableReturn {
            id: id_encrypted,
            description,
            position,
        });
    }

    Ok(Json(tables))
}

#[axum::debug_handler]
pub async fn post(
    State(conn): State<helpers::types::Conn>,
    Json(payload): Json<Table>,
) -> Result<(StatusCode, Json<TableReturn>), StatusCode> {
    let Ok(_conn) = conn.lock() else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };

    let crypto_service = match CryptoService::new(helpers::encryption::Keys::Token) {
        Ok(crypto) => crypto,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let Some(user_id_enc) = payload.user_id else {
        return Err(StatusCode::BAD_REQUEST);
    };

    let user_id_decrypted: String = match crypto_service.decrypt(user_id_enc) {
        Ok(user_id) => user_id,
        Err(_) => return Err(StatusCode::FORBIDDEN),
    };

    let next_position: i32 = _conn
        .query_row(
            "SELECT COALESCE(MAX(position), 0) + 1 FROM tables WHERE user_id = ?1",
            params![user_id_decrypted],
            |row| row.get(0),
        )
        .unwrap_or(1);

    match _conn.query_row(
        "
            INSERT INTO tables (description, user_id, position)
            VALUES (?1, ?2, ?3)
            RETURNING id, position
        ",
        params![payload.description, user_id_decrypted, next_position],
        |row| Ok((row.get::<_, i32>(0)?, row.get::<_, i32>(1)?)),
    ) {
        Ok((id, pos)) => {
            let id_encrypted = match crypto_service.encrypt(id.to_string()) {
                Ok(enc) => enc,
                Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
            };
            Ok((
                StatusCode::CREATED,
                Json(TableReturn {
                    id: id_encrypted,
                    description: payload.description,
                    position: Some(pos),
                }),
            ))
        }
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

    let crypto_service = match CryptoService::new(helpers::encryption::Keys::Token) {
        Ok(crypto) => crypto,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let Some(id_enc) = payload.id else {
        return Err(StatusCode::BAD_REQUEST);
    };

    let id_decrypted: String = match crypto_service.decrypt(id_enc) {
        Ok(id) => id,
        Err(_) => return Err(StatusCode::BAD_REQUEST),
    };

    match _conn.execute(
        "
            UPDATE tables
            SET description = ?1
            WHERE id = ?2
        ",
        params![payload.description, id_decrypted],
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

    let crypto_service = match CryptoService::new(helpers::encryption::Keys::Token) {
        Ok(crypto) => crypto,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let mut decrypted_ids = Vec::new();
    for id_enc in payload.ids {
        let id_decrypted: String = match crypto_service.decrypt(id_enc) {
            Ok(id) => id,
            Err(_) => return Err(StatusCode::BAD_REQUEST),
        };
        decrypted_ids.push(id_decrypted);
    }

    let tx = match _conn.transaction() {
        Ok(tx) => tx,
        Err(err) => {
            println!("Error starting transaction for table reorder: {}", err);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    for (index, id) in decrypted_ids.iter().enumerate() {
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

    let crypto_service = match CryptoService::new(helpers::encryption::Keys::Token) {
        Ok(crypto) => crypto,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let Some(id_enc) = payload.id else {
        return Err(StatusCode::BAD_REQUEST);
    };

    let id_decrypted: String = match crypto_service.decrypt(id_enc) {
        Ok(id) => id,
        Err(_) => return Err(StatusCode::BAD_REQUEST),
    };

    match _conn.execute(
        "
            DELETE FROM tables
            WHERE id = ?1;
        ",
        params![id_decrypted],
    ) {
        Ok(_) => Ok(StatusCode::OK),
        Err(_err) => {
            println!("Error on delete table, error: {}", _err);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
